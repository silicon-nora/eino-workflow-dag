import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { assertPackedPackageContract } from "./package-contract.js";

const projectRoot = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  readFileSync(resolve(projectRoot, "package.json"), "utf8"),
);
const work = mkdtempSync(resolve(tmpdir(), "eino-workflow-dag-pack-"));

function fail(message) {
  throw new Error(`Package contract failed: ${message}`);
}

try {
  const result = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["pack", "--json", "--ignore-scripts", "--pack-destination", work],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        npm_config_audit: "false",
        npm_config_cache: resolve(work, "npm-cache"),
        // `npm publish --dry-run` exposes its dry-run flag to lifecycle
        // scripts. The nested, script-free `npm pack` must still write its
        // temporary tarball so this contract check can inspect it.
        npm_config_dry_run: "false",
        npm_config_fund: "false",
        npm_config_update_notifier: "false",
      },
    },
  );
  if (result.status !== 0) {
    fail((result.stderr || result.stdout || "npm pack failed").trim());
  }

  let report;
  try {
    report = JSON.parse(result.stdout)[0];
  } catch {
    fail(`npm pack returned invalid JSON: ${result.stdout.trim()}`);
  }
  const tarball = resolve(work, report.filename);
  if (!existsSync(tarball)) fail(`tarball was not created: ${basename(tarball)}`);
  assertPackedPackageContract(tarball, report, manifest);

  console.log(
    `OK: exact package bytes, archive paths, file contract, source-map exclusion, documentation links, sensitive-content scan, asset inventory, and type surface passed (${report.entryCount} files, ${(report.size / 1024).toFixed(1)} KiB, ${report.shasum})`,
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
