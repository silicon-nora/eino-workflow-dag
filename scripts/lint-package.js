import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(resolve(tmpdir(), "eino-workflow-dag-lint-"));
const executable = (name) =>
  resolve(
    projectRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? `${name}.cmd` : name,
  );

function run(name, args) {
  const result = spawnSync(executable(name), args, {
    cwd: projectRoot,
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
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) {
    throw new Error(`${name} package audit failed with exit code ${result.status}`);
  }
}

try {
  run("publint", []);
  run("attw", [
    "--pack",
    ".",
    "--profile",
    // The package requires Node 20+, so legacy Node10 module resolution is
    // intentionally outside the compatibility contract.
    "node16",
    "--exclude-entrypoints",
    "./styles.css",
  ]);
  console.log("OK: publint and package type-resolution audits passed");
} finally {
  rmSync(work, { recursive: true, force: true });
}
