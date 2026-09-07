import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const dist = resolve(projectRoot, "dist");

function snapshot(directory) {
  const hashes = new Map();

  function visit(current) {
    for (const entry of readdirSync(current).sort()) {
      const path = resolve(current, entry);
      if (statSync(path).isDirectory()) {
        visit(path);
        continue;
      }
      hashes.set(
        relative(directory, path),
        createHash("sha256").update(readFileSync(path)).digest("hex"),
      );
    }
  }

  visit(directory);
  return hashes;
}

function difference(before, after) {
  const names = new Set([...before.keys(), ...after.keys()]);
  return [...names]
    .sort()
    .filter((name) => before.get(name) !== after.get(name))
    .map((name) => {
      if (!before.has(name)) return `${name} (added)`;
      if (!after.has(name)) return `${name} (removed)`;
      return `${name} (content changed)`;
    });
}

const before = snapshot(dist);
const result = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "build"],
  {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_audit: "false",
      npm_config_fund: "false",
      npm_config_update_notifier: "false",
    },
  },
);
if (result.status !== 0) {
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  throw new Error(`Rebuild failed with exit code ${result.status}`);
}

const after = snapshot(dist);
const changed = difference(before, after);
if (changed.length) {
  throw new Error(`Build is not reproducible:\n${changed.join("\n")}`);
}

console.log(`OK: reproducible build passed (${after.size} files, SHA-256)`);
