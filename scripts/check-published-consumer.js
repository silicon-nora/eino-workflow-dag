import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  readFileSync(resolve(projectRoot, "package.json"), "utf8"),
);
const version = process.argv[2];
const fixtureName = process.argv[3];

const snapshotSource = `const snapshot: EinoWorkflowSnapshot = {
  schemaVersion: 1,
  workflow: {
    nodes: [
      { id: "input", name: "Input", component: "Lambda" },
      { id: "output", name: "Output", component: "Lambda" },
    ],
    edges: [
      { from: "start", to: "input", channels: ["control", "data"] },
      { from: "input", to: "output", channels: ["control", "data"] },
      { from: "output", to: "end", channels: ["control", "data"] },
    ],
  },
};`;

const fixtures = {
  "react-18": {
    dependencies: [
      "react@18.2.0",
      "react-dom@18.2.0",
      "@types/react@18.2.79",
      "@types/react-dom@18.2.25",
    ],
    sourcePath: "src/main.ts",
    source: `import { createElement } from "react";
import { createRoot } from "react-dom/client";
import type { EinoWorkflowSnapshot } from "${manifest.name}";
import { validateWorkflowSnapshot } from "${manifest.name}/validation";
import { EinoWorkflowDAGReact } from "${manifest.name}/react";
import "${manifest.name}/styles.css";

${snapshotSource}
validateWorkflowSnapshot(snapshot);
const container = document.querySelector("#app");
if (!container) throw new Error("missing application container");
createRoot(container).render(
  createElement(EinoWorkflowDAGReact, { snapshot, style: { height: 320 } }),
);
`,
    cjsEntries: [manifest.name, `${manifest.name}/validation`, `${manifest.name}/react`],
  },
  "react-19": {
    dependencies: [
      "react@19.0.0",
      "react-dom@19.0.0",
      "@types/react@19.0.0",
      "@types/react-dom@19.0.0",
    ],
    sourcePath: "src/main.ts",
    source: `import { createElement } from "react";
import { createRoot } from "react-dom/client";
import type { EinoWorkflowSnapshot } from "${manifest.name}";
import { validateWorkflowSnapshot } from "${manifest.name}/validation";
import { EinoWorkflowDAGReact } from "${manifest.name}/react";
import "${manifest.name}/styles.css";

${snapshotSource}
validateWorkflowSnapshot(snapshot);
const container = document.querySelector("#app");
if (!container) throw new Error("missing application container");
createRoot(container).render(
  createElement(EinoWorkflowDAGReact, { snapshot, style: { height: 320 } }),
);
`,
    cjsEntries: [manifest.name, `${manifest.name}/validation`, `${manifest.name}/react`],
  },
  "vue-3": {
    dependencies: ["vue@3.4.0"],
    sourcePath: "src/main.ts",
    source: `import { createApp, h } from "vue";
import type { EinoWorkflowSnapshot } from "${manifest.name}";
import { validateWorkflowSnapshot } from "${manifest.name}/validation";
import { EinoWorkflowDAGVue } from "${manifest.name}/vue";
import "${manifest.name}/styles.css";

${snapshotSource}
validateWorkflowSnapshot(snapshot);
const container = document.querySelector("#app");
if (!container) throw new Error("missing application container");
createApp({
  render: () => h(EinoWorkflowDAGVue, { snapshot, style: { height: "320px" } }),
}).mount(container);
`,
    cjsEntries: [manifest.name, `${manifest.name}/validation`, `${manifest.name}/vue`],
  },
};

function fail(message) {
  throw new Error(`Published consumer check failed: ${message}`);
}

function executable(name) {
  return resolve(
    projectRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? `${name}.cmd` : name,
  );
}

function writeFixture(root, path, content) {
  const target = resolve(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function spawn(command, args, cwd, environment) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: environment,
    shell: process.platform === "win32",
  });
}

function run(command, args, cwd, environment) {
  const result = spawn(command, args, cwd, environment);
  if (result.status !== 0) {
    fail(
      `${basename(command)} ${args.join(" ")} exited with ${result.status}\n${
        result.stderr || result.stdout || "no output"
      }`,
    );
  }
  return result;
}

function installWithRetry(args, cwd, environment) {
  let result;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    result = spawn(process.platform === "win32" ? "npm.cmd" : "npm", args, cwd, environment);
    if (result.status === 0) return;
    if (attempt < 3) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 2000);
    }
  }
  fail(
    `npm install failed after 3 attempts\n${
      result?.stderr || result?.stdout || "no output"
    }`,
  );
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version || "")) {
  fail("an exact package version is required");
}
if (version !== manifest.version) {
  fail(`expected package.json version ${manifest.version}, received ${version}`);
}

const fixture = fixtures[fixtureName];
if (!fixture) {
  fail(`unknown fixture ${fixtureName || "<empty>"}; expected ${Object.keys(fixtures).join(", ")}`);
}

const work = mkdtempSync(resolve(tmpdir(), `eino-workflow-dag-${fixtureName}-`));
try {
  writeFixture(work, ".npmrc", "registry=https://registry.npmjs.org\n");
  writeFixture(
    work,
    "package.json",
    `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`,
  );
  writeFixture(
    work,
    "tsconfig.json",
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          strict: true,
          noEmit: true,
          skipLibCheck: false,
        },
        include: ["src/**/*.ts"],
      },
      null,
      2,
    )}\n`,
  );
  writeFixture(
    work,
    "index.html",
    '<!doctype html><html><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>\n',
  );
  writeFixture(work, fixture.sourcePath, fixture.source);

  const environment = {
    ...process.env,
    npm_config_audit: "false",
    npm_config_cache: resolve(work, "npm-cache"),
    npm_config_fund: "false",
    npm_config_ignore_scripts: "true",
    npm_config_registry: "https://registry.npmjs.org",
    npm_config_update_notifier: "false",
    npm_config_userconfig: resolve(work, ".npmrc"),
  };
  installWithRetry(
    [
      "install",
      "--ignore-scripts",
      "--no-package-lock",
      "--save-exact",
      `${manifest.name}@${version}`,
      ...fixture.dependencies,
    ],
    work,
    environment,
  );

  const installedManifest = JSON.parse(
    readFileSync(resolve(work, "node_modules", manifest.name, "package.json"), "utf8"),
  );
  if (installedManifest.name !== manifest.name || installedManifest.version !== version) {
    fail(
      `registry installed ${installedManifest.name}@${installedManifest.version}, expected ${manifest.name}@${version}`,
    );
  }

  run(executable("tsc"), ["-p", resolve(work, "tsconfig.json")], work, environment);
  run(
    executable("vite"),
    [
      "build",
      work,
      "--outDir",
      resolve(work, "build"),
      "--emptyOutDir",
      "--logLevel",
      "error",
    ],
    work,
    environment,
  );
  run(
    process.execPath,
    [
      "-e",
      `for (const name of ${JSON.stringify(fixture.cjsEntries)}) {
        const loaded = require(name);
        if (!loaded || typeof loaded !== "object") {
          throw new Error("invalid CommonJS entry: " + name);
        }
      }`,
    ],
    work,
    environment,
  );

  const assets = readdirSync(resolve(work, "build", "assets"));
  if (!assets.some((name) => name.endsWith(".js"))) {
    fail("Vite consumer build did not emit JavaScript");
  }
  if (!assets.some((name) => name.endsWith(".css"))) {
    fail("Vite consumer build did not emit package CSS");
  }

  console.log(
    `OK: ${manifest.name}@${version} installs from npm and type-checks, bundles, and loads in ${fixtureName}`,
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
