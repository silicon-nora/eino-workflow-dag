import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  readFileSync(resolve(projectRoot, "package.json"), "utf8"),
);
const lockfile = JSON.parse(
  readFileSync(resolve(projectRoot, "package-lock.json"), "utf8"),
);
const notices = readFileSync(
  resolve(projectRoot, "THIRD_PARTY_NOTICES.md"),
  "utf8",
);
const projectLicense = readFileSync(resolve(projectRoot, "LICENSE"), "utf8");
const allowedLicenses = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "MIT",
]);

function fail(message) {
  throw new Error(`License contract failed: ${message}`);
}

if (manifest.license !== "Apache-2.0") {
  fail(`package license must be Apache-2.0, received ${manifest.license}`);
}
if (!projectLicense.includes("Apache License") || !projectLicense.includes("Version 2.0")) {
  fail("LICENSE does not contain the Apache License 2.0 text");
}

const productionPackages = Object.entries(lockfile.packages || {})
  .filter(([path, entry]) => path.startsWith("node_modules/") && !entry.dev)
  .map(([path, entry]) => {
    const marker = "node_modules/";
    const segments = path.slice(path.lastIndexOf(marker) + marker.length).split("/");
    const name = segments[0].startsWith("@")
      ? `${segments[0]}/${segments[1]}`
      : segments[0];
    return { name, version: entry.version, license: entry.license };
  })
  .sort((left, right) => left.name.localeCompare(right.name));

for (const dependency of productionPackages) {
  if (!dependency.version || !dependency.license) {
    fail(`${dependency.name} is missing version or SPDX license metadata`);
  }
  if (!allowedLicenses.has(dependency.license)) {
    fail(
      `${dependency.name}@${dependency.version} uses unreviewed license ${dependency.license}`,
    );
  }

  for (const marker of [
    `Package: ${dependency.name}`,
    `Version: ${dependency.version}`,
    `SPDX-License-Identifier: ${dependency.license}`,
  ]) {
    if (!notices.includes(marker)) {
      fail(`THIRD_PARTY_NOTICES.md is missing "${marker}"`);
    }
  }
}

console.log(
  `OK: license contract passed (${productionPackages.length} production package${productionPackages.length === 1 ? "" : "s"})`,
);
