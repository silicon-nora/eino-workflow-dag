import {
  formatDuration,
  kindLabel,
  syncCytoscapeElements,
  toCytoscapeElements,
} from "../src/elements.js";
import cytoscape from "cytoscape";
import { patchCytoscapeElements } from "../src/elements.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
}

assert(formatDuration(42) === "42ms", "millisecond duration");
assert(formatDuration(1250) === "1.25s", "second duration");
assert(kindLabel("llm") === "LLM", "known kind label");
assert(kindLabel("cpu", { cpu: "代码" }) === "代码", "kind labels can be localized");
assert(
  kindLabel("__proto__", JSON.parse('{"__proto__":"Custom"}')) === "Custom",
  "prototype-like kind keys can be localized",
);

const elements = toCytoscapeElements(
  {
    nodes: [
      { id: "a", name: "A", kind: "cpu", component: "Lambda", metadata: { owner: "team" }, status: "success", cost_ms: 10, level: 0 },
      { id: "g", name: "G", kind: "graph", subgraph: true, expanded: true },
    ],
    edges: [{
      id: "e",
      from: "a",
      to: "g",
      level: 1,
      mappings: [{ fromPath: ["value"], toPath: ["input"] }],
      metadata: { transport: "typed" },
      branchMetadata: { route: "fallback" },
    }],
  },
  { nodeLabelFormatter: (node) => `${node.name}:${node.component}:${node.metadata.owner}:${node.status}:${node.durationMs}` },
);

const a = elements.find((element) => element.data.id === "a");
const g = elements.find((element) => element.data.id === "g");
assert(a.data.key === "a", "rendered nodes preserve their graph-local key");
assert(a.data.level === 0, "rendered nodes preserve their graph-local Level");
assert(a.data.label === "A:Lambda:team:success:10", "custom label formatter receives public Eino node data");
assert(g.data.label === "", "expanded graph title remains an HTML overlay");
const renderedEdge = elements.find((element) => element.group === "edges");
assert(renderedEdge.data.mappings[0].fromPath[0] === "value", "edge mappings are rendered data");
assert(renderedEdge.data.metadata.transport === "typed", "edge metadata is rendered data");
assert(renderedEdge.data.branchMetadata.route === "fallback", "branch metadata is rendered data");
assert(renderedEdge.data.level === 1, "rendered edges preserve their graph-local Level");
assert(!("main" in renderedEdge.data), "rendered edges use Level as their only path classification");

const defaultLabels = toCytoscapeElements({
  nodes: [
    { id: "timed", name: "Timed", kind: "llm", component: "ChatModel", cost_ms: 0 },
    { id: "untimed", name: "Untimed", kind: "io", component: "Retriever" },
    { id: "bare", name: "Bare", kind: "cpu" },
  ],
  edges: [],
});
assert(defaultLabels[0].data.label === "Timed\nChatModel  ·  0ms", "default labels use Eino components and preserve zero duration");
assert(defaultLabels[1].data.label === "Untimed\nRetriever", "missing duration is omitted from default labels");
assert(defaultLabels[2].data.label === "Bare", "missing component and duration leave a title-only label");
let untimedPublicNode;
toCytoscapeElements(
  { nodes: [{ id: "untimed", component: "Retriever" }], edges: [] },
  { nodeLabelFormatter: (node) => { untimedPublicNode = node; return "Untimed"; } },
);
assert(!("durationMs" in untimedPublicNode), "missing duration stays absent in public formatter data");

const cy = cytoscape({ headless: true, elements });
const updated = structuredClone(elements);
updated.find((element) => element.data.id === "a").data.status = "failed";
assert(patchCytoscapeElements(cy, updated), "data-only update is patched");
assert(cy.getElementById("a").data("status") === "failed", "patched data is visible");

const clearedExecution = structuredClone(updated);
const clearedNode = clearedExecution.find((element) => element.data.id === "a");
delete clearedNode.data.status;
delete clearedNode.data.cost_ms;
assert(patchCytoscapeElements(cy, clearedExecution), "missing execution is patched");
assert(
  cy.getElementById("a").data("status") === undefined &&
    cy.getElementById("a").data("cost_ms") === undefined,
  "a data-only update removes stale execution status and duration",
);

const topologyChange = structuredClone(updated);
topologyChange.find((element) => element.data.id === "e").data.source = "g";
assert(!patchCytoscapeElements(cy, topologyChange), "edge endpoint change requires rebuild");

const originalNode = cy.getElementById("a");
originalNode.addClass("consumer-state");
const reconciled = syncCytoscapeElements(cy, [
  ...updated,
  {
    group: "nodes",
    data: {
      id: "b",
      key: "b",
      label: "B",
      title: "B",
      kind: "cpu",
      status: "skipped",
      cost_ms: 0,
      metrics: null,
      err_msg: "",
      expandable: false,
      subgraph: false,
      expanded: false,
    },
  },
  {
    group: "edges",
    data: { id: "e2", source: "g", target: "b", kind: "", level: 0 },
  },
]);
assert(reconciled.topologyChanged, "topology changes are reported");
assert(cy.getElementById("b").nonempty(), "new nodes are added");
assert(cy.getElementById("e2").nonempty(), "new edges are added after nodes");
assert(
  cy.getElementById("a").same(originalNode) &&
    cy.getElementById("a").hasClass("consumer-state"),
  "unchanged elements preserve identity and consumer state",
);

const removed = syncCytoscapeElements(
  cy,
  updated.filter((element) => element.data.id !== "g" && element.data.id !== "e"),
);
assert(removed.topologyChanged, "removals are reported");
assert(cy.getElementById("g").empty(), "stale nodes are removed");
assert(cy.getElementById("e2").empty(), "incident edges are removed");
cy.destroy();

console.log("OK: Cytoscape element tests passed");
