import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { findBrokenLocalDocumentationLinks } from "../scripts/document-links.js";

const work = mkdtempSync(resolve(tmpdir(), "eino-workflow-dag-docs-test-"));
try {
  mkdirSync(resolve(work, "guide"));
  writeFileSync(resolve(work, "target.md"), "# Target\n");
  writeFileSync(
    resolve(work, "guide", "index.md"),
    [
      "[valid](../target.md#section)",
      "[external](https://example.com/docs)",
      "[anchor](#local)",
      "[missing](missing.md)",
      "[escape](../../outside.md)",
      "[invalid](bad%ZZ.md)",
    ].join("\n"),
  );

  const failures = findBrokenLocalDocumentationLinks(work, ["guide/index.md"]);
  assert.equal(failures.length, 3);
  assert(failures.some((failure) => failure.includes("missing.md")));
  assert(failures.some((failure) => failure.includes("../../outside.md")));
  assert(failures.some((failure) => failure.includes("invalid URL encoding")));
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log("OK: documentation link tests passed");
