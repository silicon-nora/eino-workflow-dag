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
      { id: "a", name: "A", kind: "cpu", status: "success", cost_ms: 10 },
      { id: "g", name: "G", kind: "graph", subgraph: true, expanded: true },
    ],
    edges: [{ id: "e", from: "a", to: "g", level: 1 }],
  },
  { nodeLabelFormatter: (node) => `${node.name}:${node.status}` },
);

const a = elements.find((element) => element.data.id === "a");
const g = elements.find((element) => element.data.id === "g");
assert(a.data.key === "a", "rendered nodes preserve their graph-local key");
assert(a.data.label === "A:success", "custom label formatter is used");
assert(g.data.label === "", "expanded graph title remains an HTML overlay");
assert(elements.some((element) => element.group === "edges"), "edges are converted");

const cy = cytoscape({ headless: true, elements });
const updated = structuredClone(elements);
updated.find((element) => element.data.id === "a").data.status = "failed";
assert(patchCytoscapeElements(cy, updated), "data-only update is patched");
assert(cy.getElementById("a").data("status") === "failed", "patched data is visible");

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
      status: "pending",
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
    data: { id: "e2", source: "g", target: "b", kind: "", level: 1, main: true },
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
