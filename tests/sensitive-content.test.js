import assert from "node:assert/strict";
import { findSensitiveContent } from "../scripts/sensitive-content.js";

const labels = (value) => findSensitiveContent(value).map(({ label }) => label);

assert.deepEqual(labels("ordinary package documentation"), []);
assert(labels("gh" + "p_" + "a".repeat(24)).includes("GitHub token"));
assert(labels("npm" + "_" + "b".repeat(24)).includes("npm token"));
assert(labels("-----BEGIN " + "PRIVATE KEY-----").includes("private key"));
assert(
  labels("source: /" + "Users/example/project/src/file.js").includes(
    "local absolute path",
  ),
);
assert(
  labels("source: C:" + "\\Users\\example\\project\\file.js").includes(
    "local absolute path",
  ),
);
assert(!labels("https://github.com/example/project").includes("local absolute path"));

console.log("OK: sensitive-content signature tests passed");
