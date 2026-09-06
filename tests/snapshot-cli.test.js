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
  version: 2,
  nodes: [
    {
      id: "group",
      kind: "graph",
      graph: { nodes: [{ id: "work" }], edges: [] },
    },
  ],
  edges: [],
});
assert(valid.status === 0, `valid snapshot should pass: ${valid.stderr}`);
assert(valid.stdout.includes("2 graphs, 2 nodes, 0 edges"), "summary counts nested graphs");

const legacy = run({ version: 1, nodes: [{ id: "legacy" }], edges: [] });
assert(legacy.status === 1, "v1 snapshot should fail");
assert(legacy.stderr.includes("unsupported_version root.version"), "failure identifies v1");

const nullEdges = run({ version: 2, nodes: [{ id: "node" }], edges: null });
assert(nullEdges.status === 1, "null edges should fail");
assert(nullEdges.stderr.includes("invalid_edges root.edges"), "failure identifies null edges");

console.log("OK: snapshot CLI tests passed");
