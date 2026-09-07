import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { validatePublishedSourceMaps } from "../scripts/source-map-contract.js";

const work = mkdtempSync(resolve(tmpdir(), "eino-workflow-dag-maps-test-"));
try {
  mkdirSync(resolve(work, "dist"));
  mkdirSync(resolve(work, "src"));
  writeFileSync(resolve(work, "src", "index.js"), "export const value = 1;\n");
  const mapFreePaths = new Set(["dist/index.js", "src/index.js"]);
  writeFileSync(resolve(work, "dist", "index.js"), "export const value=1;\n");
  assert.deepEqual(validatePublishedSourceMaps(work, mapFreePaths), []);

  writeFileSync(
    resolve(work, "dist", "index.js.map"),
    JSON.stringify({ version: 3, sources: ["../src/index.js"], mappings: "" }),
  );
  const publishedMapPaths = new Set([
    "dist/index.js",
    "dist/index.js.map",
    "src/index.js",
  ]);
  assert(
    validatePublishedSourceMaps(work, publishedMapPaths).some((failure) =>
      failure.includes("must not be published"),
    ),
  );

  writeFileSync(
    resolve(work, "dist", "index.js.map"),
    JSON.stringify({
      version: 3,
      sourceRoot: "https://example.com/",
      sources: ["https://example.com/index.js", "../src/missing.js"],
      sourcesContent: ["source"],
      mappings: "",
    }),
  );
  const failures = validatePublishedSourceMaps(work, publishedMapPaths);
  assert(failures.some((failure) => failure.includes("must not be published")));

  writeFileSync(resolve(work, "dist", "index.js.map"), "not JSON");
  assert(
    validatePublishedSourceMaps(work, publishedMapPaths).some((failure) =>
      failure.includes("must not be published"),
    ),
  );

  writeFileSync(
    resolve(work, "dist", "index.js"),
    "export const value=1;\n//# sourceMappingURL=index.js.map\n",
  );
  assert(
    validatePublishedSourceMaps(work, mapFreePaths).some((failure) =>
      failure.includes("sourceMappingURL"),
    ),
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log("OK: published source-map contract tests passed");
