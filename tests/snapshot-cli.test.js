import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
}

const cli = resolve(import.meta.dirname, "../scripts/check-snapshot.js");

function run(snapshot) {
  return spawnSync(process.execPath, [cli], {
    input: JSON.stringify(snapshot),
    encoding: "utf8",
  });
}

const validSnapshot = {
  schemaVersion: 1,
  workflow: {
    nodes: [
      {
        id: "group",
        workflow: { nodes: [{ id: "work" }], edges: [] },
      },
    ],
    edges: [],
  },
};

const valid = run(validSnapshot);
assert(valid.status === 0, `valid snapshot should pass: ${valid.stderr}`);
assert(valid.stdout.includes("2 graphs, 2 nodes, 0 edges"), "summary counts nested graphs");

const dash = spawnSync(process.execPath, [cli, "-"], {
  input: JSON.stringify(validSnapshot),
  encoding: "utf8",
});
assert(dash.status === 0, `explicit stdin should pass: ${dash.stderr}`);

const work = mkdtempSync(resolve(tmpdir(), "eino-workflow-dag-cli-test-"));
try {
  const fixture = resolve(work, "workflow.json");
  writeFileSync(fixture, JSON.stringify(validSnapshot));
  const file = spawnSync(process.execPath, [cli, fixture], { encoding: "utf8" });
  assert(file.status === 0, `file input should pass: ${file.stderr}`);
  assert(file.stdout.includes(fixture), "file summary identifies the resolved input path");
} finally {
  rmSync(work, { recursive: true, force: true });
}

const help = spawnSync(process.execPath, [cli, "--help"], { encoding: "utf8" });
assert(help.status === 0, "help should pass");
assert(help.stdout.includes("Usage: eino-workflow-dag-validate"), "help names the public command");

const invalidArguments = spawnSync(process.execPath, [cli, "--unknown"], {
  encoding: "utf8",
});
assert(invalidArguments.status === 2, "unknown options should report a usage error");

const unsupported = run({ schemaVersion: 2, workflow: { nodes: [], edges: [] } });
assert(unsupported.status === 1, "unsupported schema should fail");
assert(unsupported.stderr.includes("unsupported_schema_version root.schemaVersion"), "failure identifies the schema");

const nullEdges = run({ schemaVersion: 1, workflow: { nodes: [{ id: "node" }], edges: null } });
assert(nullEdges.status === 1, "null edges should fail");
assert(nullEdges.stderr.includes("invalid_edges root.workflow.edges"), "failure identifies null edges");

console.log("OK: snapshot CLI tests passed");
