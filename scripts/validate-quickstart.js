import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { validateReleaseRegistry } from "./release-validation.js";
import {
  createQuickstartDocument,
  extractReadmeQuickstart,
} from "./readme-quickstart.js";

const projectRoot = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  readFileSync(resolve(projectRoot, "package.json"), "utf8"),
);
const registry = validateReleaseRegistry(
  process.env.QUICKSTART_REGISTRY || "https://registry.npmjs.org/",
);
const packageSpec = process.env.QUICKSTART_PACKAGE_SPEC || manifest.name;
const quickstart = extractReadmeQuickstart(
  readFileSync(resolve(projectRoot, "README.md"), "utf8"),
);

function executable(name) {
  return resolve(
    projectRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? `${name}.cmd` : name,
  );
}

function run(command, args, cwd, environment) {
  const result = spawnSync(command, args, {
    cwd,
    env: environment,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 180_000,
  });
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.status}` +
        `\n${output || "no output"}`,
    );
  }
  if (result.stdout.trim()) console.log(result.stdout.trim());
}

function installWithRetry(work, environment) {
  let failure;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      run(
        process.platform === "win32" ? "npm.cmd" : "npm",
        ["install", packageSpec],
        work,
        environment,
      );
      return;
    } catch (error) {
      failure = error;
      if (attempt < 3) {
        Atomics.wait(
          new Int32Array(new SharedArrayBuffer(4)),
          0,
          0,
          attempt * 2000,
        );
      }
    }
  }
  throw failure;
}

const work = realpathSync(
  mkdtempSync(resolve(tmpdir(), "eino-workflow-dag-quickstart-")),
);

try {
  mkdirSync(resolve(work, "src"), { recursive: true });
  writeFileSync(resolve(work, ".npmrc"), `registry=${registry}\n`);
  writeFileSync(
    resolve(work, "package.json"),
    `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`,
  );
  writeFileSync(
    resolve(work, "tsconfig.json"),
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
        include: ["src/main.ts"],
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    resolve(work, "index.html"),
    createQuickstartDocument(quickstart.html),
  );
  writeFileSync(
    resolve(work, "src/main.js"),
    `${quickstart.javascript}\nwindow.quickstartView = view;\n`,
  );
  writeFileSync(resolve(work, "src/main.ts"), `${quickstart.javascript}\n`);

  const environment = {
    ...process.env,
    npm_config_audit: "false",
    npm_config_cache: resolve(work, "npm-cache"),
    npm_config_fund: "false",
    npm_config_fetch_retries: "2",
    npm_config_fetch_retry_maxtimeout: "5000",
    npm_config_fetch_retry_mintimeout: "1000",
    npm_config_fetch_timeout: "30000",
    npm_config_registry: registry,
    npm_config_update_notifier: "false",
    npm_config_userconfig: resolve(work, ".npmrc"),
  };

  installWithRetry(work, environment);
  const installedManifest = JSON.parse(
    readFileSync(resolve(work, "node_modules", manifest.name, "package.json"), "utf8"),
  );
  if (installedManifest.name !== manifest.name) {
    throw new Error(`Expected ${manifest.name}, installed ${installedManifest.name}`);
  }

  run(executable("tsc"), ["-p", resolve(work, "tsconfig.json")], work, environment);
  const output = resolve(work, "build");
  run(
    executable("vite"),
    ["build", work, "--outDir", output, "--emptyOutDir", "--logLevel", "error"],
    work,
    environment,
  );
  run(
    executable("playwright"),
    ["test", "--config", "playwright.quickstart.config.js"],
    projectRoot,
    {
      ...environment,
      QUICKSTART_BUILD: output,
      QUICKSTART_PACKAGE_VERSION: installedManifest.version,
    },
  );

  console.log(
    `OK: README quick start type-checks, bundles, and renders with ${manifest.name}@${installedManifest.version}`,
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
