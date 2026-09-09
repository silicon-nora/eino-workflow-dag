import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseWorkflowSnapshot } from "../src/validation.js";

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const fixturePath = resolve(import.meta.dirname, "../fixtures/eino-workflow-v1.json");
const snapshot = parseWorkflowSnapshot(JSON.parse(readFileSync(fixturePath, "utf8")));
const kindFixturePath = resolve(import.meta.dirname, "../fixtures/eino-workflow-kind-v1.json");
const kindSnapshot = parseWorkflowSnapshot(JSON.parse(readFileSync(kindFixturePath, "utf8")));

assert(snapshot.workflow.name === "support-assistant", "fixture preserves the Eino graph name");
assert(snapshot.workflow.nodes[0].workflow, "fixture preserves an introspected nested graph");
assert(
  snapshot.workflow.nodes[0].workflow.branches[0].from === "start",
  "fixture preserves an Eino branch originating at start",
);

const mappedEdge = snapshot.workflow.edges.find(
  (edge) => edge.from === "route" && edge.to === "answer",
);
assert(mappedEdge, "fixture preserves the mapped Eino dependency");
assert(
  JSON.stringify(mappedEdge.channels) === '["data"]',
  "fixture preserves an Eino data-only dependency",
);
assert(
  JSON.stringify(mappedEdge.mappings) === '[{"fromPath":["Text"],"toPath":[]}]',
  "fixture preserves Eino field paths",
);
assert(
  JSON.stringify(snapshot.workflow.branches) ===
    '[{"from":"route","targets":["answer","fallback"]}]',
  "fixture preserves an Eino workflow branch",
);
assert(
  snapshot.execution.nodes.some(
    (node) => JSON.stringify(node.path) === '["answer","invoke"]' && node.status === "success",
  ),
  "fixture preserves a nested path collected from Eino execution callbacks",
);

assert(
  kindSnapshot.workflow.nodes.find((node) => node.id === "route/strategy").kind === "branch",
  "Go node-kind projection satisfies the JavaScript protocol",
);
assert(
  kindSnapshot.workflow.nodes.find((node) => node.id === "answer/flow").kind === "graph",
  "Go projection fixes nested workflows to graph kind",
);
assert(
  kindSnapshot.workflow.nodes
    .find((node) => node.id === "answer/flow")
    .workflow.nodes.find((node) => node.id === "invoke/model").kind === "llm",
  "Go projection resolves nested leaves by full path",
);

console.log("OK: Go-produced Eino workflow fixture matches the JavaScript contract");
