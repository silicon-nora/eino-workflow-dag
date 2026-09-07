import {
  decodeNodePath,
  encodeNodePath,
  normalizeDAGSnapshot,
} from "../src/snapshot.js";

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const snapshot = {
  schemaVersion: 1,
  workflow: {
    nodes: [
      { id: "input", name: "Input" },
      {
        id: "work/flow",
        name: "Work",
        component: "Workflow",
        workflow: {
          nodes: [{ id: "model", component: "ChatModel" }],
          edges: [],
        },
      },
    ],
    edges: [{ from: "input", to: "work/flow", channels: ["control"] }],
    branches: [{ from: "input", targets: ["end"] }],
  },
  execution: {
    nodes: [
      { path: ["input"], status: "running", durationMs: 10 },
      { path: ["work/flow"], status: "success", durationMs: 20 },
      { path: ["work/flow", "model"], metrics: { tokens: 4 } },
    ],
  },
};

const normalized = normalizeDAGSnapshot(snapshot);
assert(normalized.definition.nodes[0].status === undefined, "definition omits execution state");
assert(normalized.runtimeByPath.input.status === "running", "root execution is indexed");
const nestedKey = encodeNodePath(["work/flow", "model"]);
assert(normalized.runtimeByPath[nestedKey].metrics.tokens === 4, "nested execution uses an unambiguous path key");
assert(JSON.stringify(decodeNodePath(nestedKey)) === '["work/flow","model"]', "encoded paths round trip");
for (const path of [["START"], ["END"], ["tilde~slash/"], ["\ud800"]]) {
  assert(
    JSON.stringify(decodeNodePath(encodeNodePath(path))) === JSON.stringify(path),
    `path ${JSON.stringify(path)} round trips without endpoint collisions`,
  );
}
assert(normalized.root.edges[0].kind === "control", "edge channels project to renderer semantics");
assert(normalized.root.edges[1].kind === "branch", "Eino branches project to renderer edges");
assert(normalized.definition.nodes[1].component === "Workflow", "Eino component identity survives projection");
assert(normalized.definition.nodes[1].graph.nodes[0].kind === "llm", "Eino components map to visual kinds");

const stateOnly = structuredClone(snapshot);
stateOnly.execution.nodes[0].status = "success";
stateOnly.execution.nodes[0].metrics = { bytes: 8 };
const stateNormalized = normalizeDAGSnapshot(stateOnly);
assert(normalized.definitionKey === stateNormalized.definitionKey, "execution changes preserve topology");
assert(normalized.layoutKey === stateNormalized.layoutKey, "non-layout execution changes remain patchable");

const durationChanged = structuredClone(snapshot);
durationChanged.execution.nodes[0].durationMs = 11;
assert(normalized.layoutKey !== normalizeDAGSnapshot(durationChanged).layoutKey, "duration changes invalidate highlighted-path layout");

const renamed = structuredClone(snapshot);
renamed.workflow.nodes[0].name = "Long input label";
assert(normalized.definitionKey !== normalizeDAGSnapshot(renamed).definitionKey, "labels remain structural");

console.log("OK: workflow snapshot projection tests passed");
