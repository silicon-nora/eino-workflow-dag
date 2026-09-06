import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(resolve(projectRoot, ".packed-consumer-"));
const packageName = JSON.parse(
  readFileSync(resolve(projectRoot, "package.json"), "utf8"),
).name;

function fail(message) {
  throw new Error(`Packed consumer check failed: ${message}`);
}

function run(command, args, cwd = work) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_audit: "false",
      npm_config_cache: resolve(work, "npm-cache"),
      npm_config_dry_run: "false",
      npm_config_fund: "false",
      npm_config_update_notifier: "false",
    },
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    fail(
      `${basename(command)} ${args.join(" ")} exited with ${result.status}\n${
        result.stderr || result.stdout || "no output"
      }`,
    );
  }
  return result;
}

function executable(name) {
  return resolve(
    projectRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? `${name}.cmd` : name,
  );
}

function writeFixture(path, content) {
  const target = resolve(work, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

try {
  const packed = run(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["pack", "--json", "--ignore-scripts", "--pack-destination", work],
    projectRoot,
  );
  let report;
  try {
    report = JSON.parse(packed.stdout)[0];
  } catch {
    fail(`npm pack returned invalid JSON: ${packed.stdout}`);
  }
  if (report?.name !== packageName || !report?.filename) {
    fail("npm pack returned an unexpected package identity");
  }

  run("tar", ["-xzf", resolve(work, report.filename), "-C", work]);
  const installed = resolve(work, "node_modules", packageName);
  mkdirSync(dirname(installed), { recursive: true });
  renameSync(resolve(work, "package"), installed);

  writeFixture(
    "package.json",
    JSON.stringify({ private: true, type: "module" }, null, 2),
  );
  writeFixture(
    "tsconfig.json",
    JSON.stringify(
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
    ),
  );
  writeFixture(
    "index.html",
    '<!doctype html><html><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>\n',
  );
  writeFixture(
    "src/main.ts",
    `import {
  mountWorkflowDAG,
  type DAGData,
  type WorkflowDAGInstance,
} from "${packageName}";
import { buildVisibleGraph } from "${packageName}/model";
import { layoutVisibleGraph } from "${packageName}/layout";
import { validateDAG } from "${packageName}/validation";
import {
  EinoWorkflowDAGVue,
  type EinoWorkflowDAGVueRef,
} from "${packageName}/vue";
import {
  EinoWorkflowDAGReact,
  type EinoWorkflowDAGReactRef,
} from "${packageName}/react";
import "${packageName}/styles.css";

const root: DAGData = {
  version: 2,
  nodes: [{ id: "input", status: "degraded" }],
  edges: [],
};
const visible = buildVisibleGraph(root, {});
layoutVisibleGraph(visible, { direction: "RIGHT" });
validateDAG(root);

declare const dag: WorkflowDAGInstance;
declare const vueRef: EinoWorkflowDAGVueRef;
declare const reactRef: EinoWorkflowDAGReactRef;
if (false) {
  dag.setData(root);
  dag.setActiveNodeId("input");
  dag.getActiveNodeId();
  vueRef.setActiveNodeId("input");
  reactRef.setActiveNodeId(null);
  vueRef.getDiagnostics();
  reactRef.getDiagnostics();
}

Object.assign(globalThis, {
  packedConsumer: {
    mountWorkflowDAG,
    EinoWorkflowDAGVue,
    EinoWorkflowDAGReact,
    root,
  },
});
`,
  );

  run(executable("tsc"), ["-p", resolve(work, "tsconfig.json")]);
  run(executable("vite"), [
    "build",
    work,
    "--outDir",
    resolve(work, "build"),
    "--emptyOutDir",
    "--logLevel",
    "error",
  ]);

  const cjsEntries = [
    packageName,
    `${packageName}/model`,
    `${packageName}/layout`,
    `${packageName}/layout-worker`,
    `${packageName}/validation`,
    `${packageName}/vue`,
    `${packageName}/react`,
  ];
  run(process.execPath, [
    "-e",
    `for (const name of ${JSON.stringify(cjsEntries)}) {
      const loaded = require(name);
      if (!loaded || typeof loaded !== "object") throw new Error("invalid CommonJS entry: " + name);
    }`,
  ]);

  const assets = readdirSync(resolve(work, "build", "assets"));
  if (!assets.some((name) => name.endsWith(".js"))) {
    fail("Vite consumer build did not emit JavaScript");
  }
  if (!assets.some((name) => name.endsWith(".css"))) {
    fail("Vite consumer build did not emit package CSS");
  }

  console.log(
    `OK: exact packed artifact type-checks and bundles for ESM, Vue, React, and ${cjsEntries.length} CommonJS entries`,
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
