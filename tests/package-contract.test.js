import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  maximumPackedSize,
  validatePackageReport,
  validateUnpackedPackage,
} from "../scripts/package-contract.js";

const manifest = {
  name: "example-package",
  version: "1.2.3",
  exports: { ".": "./dist/index.js" },
};
const required = [
  "package.json",
  "API_SURFACE.json",
  "CHANGELOG.md",
  "LICENSE",
  "PROVENANCE.md",
  "PUBLIC_ASSETS.json",
  "README.md",
  "THIRD_PARTY_NOTICES.md",
  "TYPE_SURFACE.json",
  "dist/index.js",
];

const work = mkdtempSync(resolve(tmpdir(), "eino-workflow-dag-contract-test-"));
try {
  const tarball = resolve(work, "example-package-1.2.3.tgz");
  const bytes = Buffer.from("packed bytes");
  writeFileSync(tarball, bytes);
  const report = {
    name: manifest.name,
    version: manifest.version,
    filename: "example-package-1.2.3.tgz",
    size: bytes.length,
    shasum: createHash("sha1").update(bytes).digest("hex"),
    integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
    entryCount: required.length,
    files: required.map((path) => ({ path, size: 0 })),
  };
  assert.deepEqual(validatePackageReport(report, manifest, tarball), []);

  const tampered = { ...report, shasum: "0".repeat(40) };
  assert(
    validatePackageReport(tampered, manifest, tarball).some((failure) =>
      failure.includes("SHA-1"),
    ),
  );
  const tooLarge = { ...report, size: maximumPackedSize + 1 };
  assert(
    validatePackageReport(tooLarge, manifest).some((failure) =>
      failure.includes("exceeds 350 KiB"),
    ),
  );
  const unsafe = {
    ...report,
    entryCount: report.entryCount + 1,
    files: [...report.files, { path: "../escape.js", size: 0 }],
  };
  assert(
    validatePackageReport(unsafe, manifest).some((failure) =>
      failure.includes("unsafe reported paths"),
    ),
  );

  const unpacked = resolve(work, "package");
  mkdirSync(unpacked);
  writeFileSync(
    resolve(unpacked, "package.json"),
    `${JSON.stringify({ ...manifest, exports: {} })}\n`,
  );
  writeFileSync(resolve(unpacked, "PUBLIC_ASSETS.json"), '{"version":1,"assets":[]}\n');
  writeFileSync(resolve(unpacked, "TYPE_SURFACE.json"), "{}\n");
  for (const path of required.filter(
    (path) => !["package.json", "PUBLIC_ASSETS.json", "TYPE_SURFACE.json"].includes(path),
  )) {
    const directory = resolve(unpacked, path, "..");
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(unpacked, path), path.endsWith(".md") ? "# Doc\n" : "");
  }
  const actualReport = {
    ...report,
    files: required.map((path) => ({
      path,
      size: Buffer.byteLength(
        path === "package.json"
          ? `${JSON.stringify({ ...manifest, exports: {} })}\n`
          : path === "PUBLIC_ASSETS.json"
            ? '{"version":1,"assets":[]}\n'
            : path === "TYPE_SURFACE.json"
              ? "{}\n"
              : path.endsWith(".md")
                ? "# Doc\n"
                : "",
      ),
    })),
  };
  assert.deepEqual(validateUnpackedPackage(unpacked, actualReport, manifest), []);

  writeFileSync(resolve(unpacked, "unexpected.txt"), "surprise\n");
  assert(
    validateUnpackedPackage(unpacked, actualReport, manifest).some((failure) =>
      failure.includes("unreported file"),
    ),
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log("OK: exact package contract tests passed");
