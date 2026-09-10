import {
  formatDuration,
  syncCytoscapeElements,
  toCytoscapeElements,
  toRenderedNodeData,
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
      branchMetadataList: [{ route: "fallback" }, null],
    }],
  },
  { nodeLabelFormatter: (node) => `${node.name}:${node.component}:${node.metadata.owner}:${node.status}:${node.durationMs}` },
);

const a = elements.find((element) => element.data.id === "a");
const g = elements.find((element) => element.data.id === "g");
assert(a.pannable === true, "node drag gestures pass through to viewport panning");
assert(a.data.key === "a", "rendered nodes preserve their graph-local key");
assert(a.data.level === 0, "rendered nodes preserve their graph-local Level");
assert(a.data.label === "A:Lambda:team:success:10", "custom label formatter receives public Eino node data");
assert(g.data.label === "", "expanded graph title remains an HTML overlay");
const renderedEdge = elements.find((element) => element.group === "edges");
assert(renderedEdge.data.mappings[0].fromPath[0] === "value", "edge mappings are rendered data");
assert(renderedEdge.data.metadata.transport === "typed", "edge metadata is rendered data");
assert(renderedEdge.data.branchMetadata.route === "fallback", "branch metadata is rendered data");
assert(
  renderedEdge.data.branchMetadataList.length === 2 &&
    renderedEdge.data.branchMetadataList[1] === null,
  "all branch metadata is rendered data",
);
assert(renderedEdge.data.level === 1, "rendered edges preserve their graph-local Level");
assert(!("main" in renderedEdge.data), "rendered edges use Level as their only path classification");

const defaultLabels = toCytoscapeElements({
  nodes: [
    { id: "timed", name: "Timed", kind: "llm", display_kind: "llm", component: "Lambda", cost_ms: 0 },
    { id: "untimed", name: "Untimed", kind: "io", display_kind: "io", component: "Lambda" },
    { id: "component", name: "Component", kind: "io", component: "Retriever" },
    { id: "bare", name: "Bare" },
  ],
  edges: [],
});
assert(defaultLabels[0].data.label === "Timed\nLLM  ·  0ms", "canonical kind labels replace component text and preserve zero duration");
assert(defaultLabels[1].data.label === "Untimed\nI/O", "canonical kind-only details omit a missing duration");
assert(defaultLabels[2].data.label === "Component\nRetriever", "components remain the type fallback when kind is omitted");
assert(defaultLabels[3].data.label === "Bare", "missing component, kind, and duration leave a title-only label");
for (const [kind, label] of [
  ["llm", "LLM"],
  ["io", "I/O"],
  ["cpu", "CPU"],
  ["graph", "Graph"],
  ["branch", "Branch"],
  ["merge", "Merge"],
]) {
  const [element] = toCytoscapeElements({
    nodes: [{ id: kind, name: "Kind", kind, display_kind: kind }],
    edges: [],
  });
  assert(element.data.label === `Kind\n${label}`, `${kind} uses its canonical technical label`);
}
assert(
  toCytoscapeElements({
    nodes: [{ id: "localized", name: "Localized", kind: "llm", display_kind: "llm", component: "Lambda" }],
    edges: [],
  }, { locale: { kinds: { llm: "大模型" } } })[0].data.label === "Localized\nLLM",
  "canonical technical labels are not translated by the renderer locale",
);
let untimedPublicNode;
toCytoscapeElements(
  { nodes: [{ id: "untimed", component: "Retriever" }], edges: [] },
  { nodeLabelFormatter: (node) => { untimedPublicNode = node; return "Untimed"; } },
);
assert(!("durationMs" in untimedPublicNode), "missing duration stays absent in public formatter data");

assert(
  JSON.stringify(toRenderedNodeData({
    id: "outer/inner",
    key: "inner",
    title: "Inner",
    label: "Inner\nCPU  ·  12ms",
    parent: "outer",
    kind: "cpu",
    component: "Lambda",
    metadata: { owner: "host" },
    status: "success",
    cost_ms: 12,
    metrics: { attempts: 1 },
    err_msg: "",
    expandable: true,
    subgraph: true,
    expanded: false,
    level: 2,
  })) === JSON.stringify({
    path: ["outer", "inner"],
    id: "inner",
    name: "Inner",
    parentPath: ["outer"],
    kind: "cpu",
    component: "Lambda",
    metadata: { owner: "host" },
    status: "success",
    durationMs: 12,
    metrics: { attempts: 1 },
    errorMessage: "",
    expandable: true,
    subgraph: true,
    expanded: false,
    level: 2,
    label: "Inner\nCPU  ·  12ms",
  }),
  "rendered node callbacks share one complete public data conversion",
);

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
