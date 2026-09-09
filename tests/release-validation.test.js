import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  formatReleaseValidationReport,
  parseReleaseValidationArguments,
  validateReleaseRegistry,
  validateReleaseVersion,
} from "../scripts/release-validation.js";

assert.equal(validateReleaseVersion("1.0.0", "1.0.0"), "1.0.0");
assert.equal(
  validateReleaseVersion("1.1.0-rc.1", "1.1.0-rc.1"),
  "1.1.0-rc.1",
);
assert.throws(() => validateReleaseVersion("latest", "1.0.0"), /exact version/);
assert.throws(
  () => validateReleaseVersion("1.0.1", "1.0.0"),
  /matching release checkout/,
);
assert.equal(
  validateReleaseRegistry("https://registry.npmjs.org"),
  "https://registry.npmjs.org/",
);
assert.throws(
  () => validateReleaseRegistry("http://registry.example.test"),
  /uncredentialed HTTPS/,
);
assert.throws(
  () => validateReleaseRegistry("https://user:" + "secret@registry.example.test"),
  /uncredentialed HTTPS/,
);

assert.deepEqual(
  parseReleaseValidationArguments(
    [
      "1.0.0-rc.1",
      "--cycles",
      "75",
      "--report-dir=reports",
      "--registry=https://registry.example.test",
      "--local-artifact=./release.tgz",
    ],
    "1.0.0-rc.1",
  ),
  {
    version: "1.0.0-rc.1",
    reportDirectory: "reports",
    cycles: 75,
    registry: "https://registry.example.test/",
    localArtifact: "./release.tgz",
  },
);
assert.deepEqual(
  parseReleaseValidationArguments([], "1.0.0", { RELEASE_SOAK_CYCLES: "40" }),
  {
    version: "1.0.0",
    reportDirectory: ".artifacts/release-validation",
    cycles: 40,
    registry: "https://registry.npmjs.org/",
    localArtifact: null,
  },
);
assert.equal(
  parseReleaseValidationArguments([], "1.0.0", { RC_SOAK_CYCLES: "30" }).cycles,
  30,
);
assert.throws(
  () => parseReleaseValidationArguments(["--cycles", "9"], "1.0.0"),
  /10 through 200/,
);

const markdown = formatReleaseValidationReport({
  package: "eino-workflow-dag",
  version: "1.0.0-rc.1",
  revision: "abc123",
  status: "passed",
  startedAt: "2026-09-08T00:00:00.000Z",
  finishedAt: "2026-09-08T00:01:00.000Z",
  cycles: 50,
  registry: "https://registry.npmjs.org/",
  packageSource: "npm-registry",
  environment: { node: "v24.0.0", platform: "linux", arch: "x64" },
  phases: [{ name: "Browser | soak", status: "passed", durationMs: 1250 }],
});
assert.match(markdown, /Result: \*\*PASSED\*\*/);
assert.match(markdown, /Browser \\| soak/);
assert.match(markdown, /https:\/\/registry\.npmjs\.org\//);
assert.match(markdown, /Package source: npm-registry/);
assert.match(markdown, /1\.25 s/);

const publishWorkflow = readFileSync(
  resolve(import.meta.dirname, "../.github/workflows/publish.yml"),
  "utf8",
);
const createArtifactIndex = publishWorkflow.indexOf(
  "name: Create the immutable release artifact",
);
const validateArtifactIndex = publishWorkflow.indexOf(
  "name: Validate the exact release artifact",
);
const publishIndex = publishWorkflow.indexOf("name: Publish to npm");
assert.ok(createArtifactIndex >= 0, "publish workflow must create one release artifact");
assert.ok(
  validateArtifactIndex > createArtifactIndex,
  "publish workflow must validate the created artifact",
);
assert.ok(
  publishIndex > validateArtifactIndex,
  "publish workflow must validate the artifact before npm publication",
);
assert.match(
  publishWorkflow.slice(validateArtifactIndex, publishIndex),
  /--local-artifact "\$\{\{ steps\.artifact\.outputs\.tarball \}\}"/,
);

console.log("OK: release validation contract tests passed");
