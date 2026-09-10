import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatReleaseValidationReport,
  parseReleaseValidationArguments,
} from "./release-validation.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"));
const fixture = JSON.parse(
  readFileSync(resolve(projectRoot, "fixtures/eino-workflow-v1.json"), "utf8"),
);
const nodeKindFixture = JSON.parse(
  readFileSync(resolve(projectRoot, "fixtures/eino-workflow-kind-v1.json"), "utf8"),
);

class CommandFailure extends Error {
  constructor(command, status, signal) {
    super(`${command} failed${signal ? ` with signal ${signal}` : ` with exit code ${status}`}`);
    this.status = status;
    this.signal = signal;
  }
}

function executable(name) {
  return resolve(
    projectRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? `${name}.cmd` : name,
  );
}

function runCommand(command, args, cwd, environment = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    env: environment,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new CommandFailure(`${command} ${args.join(" ")}`, result.status, result.signal);
  }
}

function commandOutput(command, args, cwd = projectRoot) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "unavailable";
}

function installPublishedPackage(work, packageSpec, registry) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const environment = {
    ...process.env,
    npm_config_audit: "false",
    npm_config_cache: resolve(work, "npm-cache"),
    npm_config_fund: "false",
    npm_config_fetch_retries: "2",
    npm_config_fetch_retry_maxtimeout: "5000",
    npm_config_fetch_retry_mintimeout: "1000",
    npm_config_fetch_timeout: "30000",
    npm_config_ignore_scripts: "true",
    npm_config_registry: registry,
    npm_config_update_notifier: "false",
    npm_config_userconfig: resolve(work, ".npmrc"),
  };
  let failure;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      runCommand(
        npm,
        [
          "install",
          "--ignore-scripts",
          "--no-package-lock",
          "--save-exact",
          packageSpec,
        ],
        work,
        environment,
      );
      return environment;
    } catch (error) {
      failure = error;
      if (attempt < 3) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 2000);
      }
    }
  }
  throw failure;
}

function browserConsumerSource(version, snapshot, explicitKindFixture) {
  const enriched = structuredClone(snapshot);
  enriched.metadata = { validation: "release-host" };
  const prepare = enriched.workflow.nodes.find((node) => node.id === "prepare");
  if (prepare) prepare.metadata = { validation: "node-callback" };
  const answerEdge = enriched.workflow.edges.find(
    (edge) => edge.from === "route" && edge.to === "answer",
  );
  if (answerEdge) answerEdge.metadata = { validation: "edge-callback" };

  return `import { createCytoscapeWorkflowDAG, getCytoscape } from "${manifest.name}/cytoscape";
import { parseWorkflowSnapshot } from "${manifest.name}/validation";
import "${manifest.name}/styles.css";

const baseSnapshot = parseWorkflowSnapshot(${JSON.stringify(enriched)});
const nodeKindSnapshot = parseWorkflowSnapshot(${JSON.stringify(explicitKindFixture)});
const host = document.querySelector("#dag");
const flow = document.querySelector("#flow");
let instance = null;
let snapshot = structuredClone(baseSnapshot);
const events = [];

function mount(options = {}) {
  instance = createCytoscapeWorkflowDAG(host, {
    snapshot,
    direction: "RIGHT",
    pinNodeTip: false,
    ...options,
    onNodeClick(node) { events.push({ type: "node", value: node }); },
    onEdgeClick(edge) { events.push({ type: "edge", value: edge }); },
    onError(error) { events.push({ type: "error", value: error.message }); },
  });
  return instance;
}

window.releaseHarness = {
  version: ${JSON.stringify(version)},
  baseSnapshot,
  nodeKindSnapshot,
  events,
  get instance() { return instance; },
  get cy() { return instance ? getCytoscape(instance) : null; },
  update(next) {
    snapshot = structuredClone(next);
    instance.update(snapshot);
  },
  remount() {
    if (instance) instance.destroy();
    host.replaceChildren();
    return mount();
  },
  mountNodeKindFixture() {
    if (instance) instance.destroy();
    host.replaceChildren();
    snapshot = structuredClone(nodeKindSnapshot);
    return mount({
      expanded: [["answer/flow"]],
      additionalStyles: [
        { selector: 'node[kind = "llm"]', style: { "border-width": 11 } },
      ],
    });
  },
  restoreBaseFixture() {
    if (instance) instance.destroy();
    host.replaceChildren();
    snapshot = structuredClone(baseSnapshot);
    return mount();
  },
  cycleLifecycle(count) {
    const failures = [];
    for (let index = 0; index < count; index += 1) {
      const previous = instance;
      previous.destroy();
      if (getCytoscape(previous) !== null) failures.push(index + ":engine-retained");
      if (host.childElementCount !== 0) failures.push(index + ":host-not-empty");
      if (host.querySelectorAll(":scope > .cy-overlays").length !== 0) {
        failures.push(index + ":overlay-retained");
      }
      host.replaceChildren();
      mount();
      if (!getCytoscape(instance)) failures.push(index + ":engine-missing");
      if (host.querySelectorAll("canvas").length === 0) failures.push(index + ":canvas-missing");
      if (host.querySelectorAll(":scope > .cy-overlays").length !== 1) {
        failures.push(index + ":overlay-count");
      }
    }
    return {
      failures,
      canvases: host.querySelectorAll("canvas").length,
      overlays: host.querySelectorAll(":scope > .cy-overlays").length,
    };
  },
};

mount();
window.releaseReady = true;
`;
}

function prepareBrowserConsumer(version, packageSpec, registry) {
  const work = realpathSync(
    mkdtempSync(resolve(tmpdir(), "eino-workflow-dag-release-browser-")),
  );
  mkdirSync(resolve(work, "src"), { recursive: true });
  writeFileSync(resolve(work, ".npmrc"), `registry=${registry}\n`);
  writeFileSync(
    resolve(work, "package.json"),
    `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`,
  );
  writeFileSync(
    resolve(work, "index.html"),
    '<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Release validation</title><link rel="icon" href="data:,"><style>html,body{height:100%}body{box-sizing:border-box;margin:0;padding:24px;background:#f6f8fa}#flow{height:calc(100% - 48px);min-height:640px}#dag{width:100%;height:100%}</style></head><body><main id="flow" class="eino-workflow-dag-flow"><div id="dag"></div></main><script type="module" src="/src/main.js"></script></body></html>\n',
  );
  writeFileSync(
    resolve(work, "src/main.js"),
    browserConsumerSource(version, fixture, nodeKindFixture),
  );
  const environment = installPublishedPackage(work, packageSpec, registry);
  const installedManifest = JSON.parse(
    readFileSync(resolve(work, "node_modules", manifest.name, "package.json"), "utf8"),
  );
  if (installedManifest.name !== manifest.name || installedManifest.version !== version) {
    throw new Error(
      `Registry installed ${installedManifest.name}@${installedManifest.version}, expected ${manifest.name}@${version}`,
    );
  }

  const output = resolve(work, "build");
  runCommand(
    executable("vite"),
    ["build", work, "--outDir", output, "--emptyOutDir", "--logLevel", "error"],
    work,
    environment,
  );
  return { work, output };
}

function writeReports(reportDirectory, report) {
  const resolvedDirectory = resolve(projectRoot, reportDirectory);
  mkdirSync(resolvedDirectory, { recursive: true });
  const stamp = report.finishedAt.replaceAll(":", "-").replace(".000Z", "Z");
  const base = `${report.version}-${stamp}`;
  const jsonPath = resolve(resolvedDirectory, `${base}.json`);
  const markdownPath = resolve(resolvedDirectory, `${base}.md`);
  const markdown = formatReleaseValidationReport(report);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdownPath, markdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  }
  return { jsonPath, markdownPath };
}

let options;
try {
  options = parseReleaseValidationArguments(
    process.argv.slice(2),
    manifest.version,
    process.env,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const started = new Date();
const localArtifact = options.localArtifact
  ? resolve(projectRoot, options.localArtifact)
  : null;
if (localArtifact && !existsSync(localArtifact)) {
  console.error(`Local release artifact does not exist: ${localArtifact}`);
  process.exit(1);
}
const packageSpec = localArtifact || `${manifest.name}@${options.version}`;
const report = {
  schemaVersion: 1,
  package: manifest.name,
  version: options.version,
  revision: commandOutput("git", ["rev-parse", "HEAD"]),
  status: "running",
  startedAt: started.toISOString(),
  finishedAt: started.toISOString(),
  cycles: options.cycles,
  registry: options.registry,
  packageSource: localArtifact ? "local-artifact" : "npm-registry",
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  },
  phases: [],
};
let browserConsumer = null;
let failurePhase = null;
let failure = null;

function phase(name, operation) {
  const phaseStarted = performance.now();
  console.log(`\n[release] ${name}`);
  try {
    operation();
    report.phases.push({
      name,
      status: "passed",
      durationMs: Math.round(performance.now() - phaseStarted),
    });
  } catch (error) {
    failurePhase = name;
    report.phases.push({
      name,
      status: "failed",
      durationMs: Math.round(performance.now() - phaseStarted),
      exitCode: error instanceof CommandFailure ? error.status : null,
      signal: error instanceof CommandFailure ? error.signal : null,
    });
    throw error;
  }
}

try {
  phase("Real Go Eino projection and execution", () => {
    runCommand("go", ["test", "./..."], resolve(projectRoot, "integrations/go"));
  });
  for (const consumer of ["react-18", "react-19", "vue-3"]) {
    phase(`Clean consumer: ${consumer}`, () => {
      runCommand(
        process.execPath,
        ["scripts/check-published-consumer.js", options.version, consumer],
        projectRoot,
        {
          ...process.env,
          PUBLISHED_CONSUMER_REGISTRY: options.registry,
          PUBLISHED_CONSUMER_PACKAGE_SPEC: packageSpec,
        },
      );
    });
  }
  phase("Build browser host from the exact published package", () => {
    browserConsumer = prepareBrowserConsumer(
      options.version,
      packageSpec,
      options.registry,
    );
  });
  phase("Chromium, Firefox, and WebKit interaction soak", () => {
    runCommand(
      executable("playwright"),
      ["test", "--config", "playwright.release.config.js"],
      projectRoot,
      {
        ...process.env,
        RELEASE_VALIDATION_BUILD: browserConsumer.output,
        RELEASE_VALIDATION_VERSION: options.version,
        RELEASE_SOAK_CYCLES: String(options.cycles),
      },
    );
  });
  report.status = "passed";
} catch (error) {
  failure = error;
  report.status = "failed";
  console.error(
    `\nRelease validation failed${failurePhase ? ` during ${failurePhase}` : ""}: ` +
      (error instanceof Error ? error.message : error),
  );
} finally {
  if (browserConsumer) {
    rmSync(browserConsumer.work, { recursive: true, force: true });
  }
  report.finishedAt = new Date().toISOString();
  const paths = writeReports(options.reportDirectory, report);
  console.log(`\nRelease report: ${paths.markdownPath}`);
  console.log(`Release data: ${paths.jsonPath}`);
}

if (failure) process.exitCode = 1;
