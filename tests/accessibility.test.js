import { summarizeVisibleGraph } from "../src/accessibility.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
}

const summary = summarizeVisibleGraph({
  nodes: [
    { id: "a", status: "success" },
    { id: "b", status: "skipped", subgraph: true, expanded: true },
    { id: "c", status: "failed", subgraph: true, expanded: false },
    { id: "d" },
  ],
  edges: [{ id: "e", from: "a", to: "b" }],
});

assert(summary.nodeCount === 4, "node count is summarized");
assert(summary.edgeCount === 1, "edge count is summarized");
assert(summary.statuses.skipped === 1, "statuses are counted");
assert(summary.expandedSubgraphs === 1, "expanded subgraphs are counted");
assert(summary.collapsedSubgraphs === 1, "collapsed subgraphs are counted");
assert(summary.text.includes("4 nodes and 1 edge"), "plain-text summary is generated");
assert(summary.text.includes("1 skipped"), "skipped status is announced");
assert(
  summary.text.includes("1 expanded subgraph and 1 collapsed subgraph"),
  "subgraph counts use readable singular labels",
);

console.log("OK: accessibility summary tests passed");
