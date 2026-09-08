import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  findSensitiveContent,
  scanDirectoryForSensitiveContent,
} from "../scripts/sensitive-content.js";

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

const work = mkdtempSync(resolve(tmpdir(), "eino-workflow-dag-sensitive-test-"));
try {
  const dependency = resolve(work, "consumer", "node_modules", "dependency");
  mkdirSync(dependency, { recursive: true });
  const testCredential = "npm" + "_" + "c".repeat(24);
  writeFileSync(resolve(dependency, "fixture.js"), testCredential);
  assert.deepEqual(
    scanDirectoryForSensitiveContent(work, {
      excludedDirectories: new Set(["node_modules"]),
    }),
    [],
  );

  writeFileSync(resolve(work, "fixture.js"), testCredential);
  assert.equal(
    scanDirectoryForSensitiveContent(work, {
      excludedDirectories: new Set(["node_modules"]),
    }).length,
    1,
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log("OK: sensitive-content signature tests passed");
