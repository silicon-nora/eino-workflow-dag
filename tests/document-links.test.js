import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findBrokenLocalDocumentationLinks } from "../scripts/document-links.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

const customization = readFileSync(
  resolve(projectRoot, "CUSTOMIZATION.md"),
  "utf8",
);
const adapterContract = customization.match(
  /## React and Vue update contract\n([\s\S]*?)(?=\n## )/,
)?.[1];
assert(adapterContract, "CUSTOMIZATION.md must define the adapter update contract");

for (const prop of [
  "snapshot",
  "direction",
  "theme",
  "locale",
  "expanded",
  "activeNodePath",
  "preserveExpanded",
  "fitOnUpdate",
  "interaction",
  "pinNodeTip",
  "autoResize",
  "debug",
  "ariaLabel",
  "accessibilityLabelFormatter",
  "keyboardNavigation",
  "tooltipFormatter",
  "nodeLabelFormatter",
  "layoutCacheSize",
]) {
  assert(
    adapterContract.includes(`\`${prop}\``),
    `adapter update contract must classify ${prop}`,
  );
}
assert.match(adapterContract, /mount-only option/);
assert.match(adapterContract, /new array or object reference/);
assert.match(adapterContract, /`onReady` and Vue `ready`/);

console.log("OK: documentation link tests passed");
