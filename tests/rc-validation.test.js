import assert from "node:assert/strict";
import {
  formatRCValidationReport,
  parseRCValidationArguments,
  validateRCRegistry,
  validateRCVersion,
} from "../scripts/rc-validation.js";

assert.equal(validateRCVersion("1.0.0-rc.1", "1.0.0-rc.1"), "1.0.0-rc.1");
assert.throws(() => validateRCVersion("1.0.0", "1.0.0"), /exact prerelease/);
assert.throws(
  () => validateRCVersion("1.0.0-rc.2", "1.0.0-rc.1"),
  /matching candidate checkout/,
);
assert.equal(
  validateRCRegistry("https://registry.npmjs.org"),
  "https://registry.npmjs.org/",
);
assert.throws(
  () => validateRCRegistry("http://registry.example.test"),
  /uncredentialed HTTPS/,
);
assert.throws(
  () => validateRCRegistry("https://user:" + "secret@registry.example.test"),
  /uncredentialed HTTPS/,
);

assert.deepEqual(
  parseRCValidationArguments(
    [
      "1.0.0-rc.1",
      "--cycles",
      "75",
      "--report-dir=reports",
      "--registry=https://registry.example.test",
      "--local-artifact=./candidate.tgz",
    ],
    "1.0.0-rc.1",
  ),
  {
    version: "1.0.0-rc.1",
    reportDirectory: "reports",
    cycles: 75,
    registry: "https://registry.example.test/",
    localArtifact: "./candidate.tgz",
  },
);
assert.deepEqual(
  parseRCValidationArguments([], "1.0.0-rc.1", { RC_SOAK_CYCLES: "40" }),
  {
    version: "1.0.0-rc.1",
    reportDirectory: ".artifacts/rc-validation",
    cycles: 40,
    registry: "https://registry.npmjs.org/",
    localArtifact: null,
  },
);
assert.throws(
  () => parseRCValidationArguments(["--cycles", "9"], "1.0.0-rc.1"),
  /10 through 200/,
);

const markdown = formatRCValidationReport({
  package: "eino-workflow-dag",
  version: "1.0.0-rc.1",
  revision: "abc123",
  status: "passed",
  startedAt: "2026-09-08T00:00:00.000Z",
  finishedAt: "2026-09-08T00:01:00.000Z",
  cycles: 50,
  registry: "https://registry.npmjs.org/",
  candidateSource: "npm-registry",
  environment: { node: "v24.0.0", platform: "linux", arch: "x64" },
  phases: [{ name: "Browser | soak", status: "passed", durationMs: 1250 }],
});
assert.match(markdown, /Result: \*\*PASSED\*\*/);
assert.match(markdown, /Browser \\| soak/);
assert.match(markdown, /https:\/\/registry\.npmjs\.org\//);
assert.match(markdown, /Candidate source: npm-registry/);
assert.match(markdown, /1\.25 s/);

console.log("OK: RC validation contract tests passed");
