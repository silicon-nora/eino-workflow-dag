import { spawnSync } from "node:child_process";
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

const valid = run({
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
});
assert(valid.status === 0, `valid snapshot should pass: ${valid.stderr}`);
assert(valid.stdout.includes("2 graphs, 2 nodes, 0 edges"), "summary counts nested graphs");

const unsupported = run({ schemaVersion: 2, workflow: { nodes: [], edges: [] } });
assert(unsupported.status === 1, "unsupported schema should fail");
assert(unsupported.stderr.includes("unsupported_schema_version root.schemaVersion"), "failure identifies the schema");

const nullEdges = run({ schemaVersion: 1, workflow: { nodes: [{ id: "node" }], edges: null } });
assert(nullEdges.status === 1, "null edges should fail");
assert(nullEdges.stderr.includes("invalid_edges root.workflow.edges"), "failure identifies null edges");

console.log("OK: snapshot CLI tests passed");
