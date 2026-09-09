import {
  decodeNodePath,
  encodeNodePath,
  normalizeDAGSnapshot,
} from "../src/snapshot.js";
import { validateWorkflowSnapshot } from "../src/validation.js";

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
      { id: "fallback", name: "Fallback" },
    ],
    edges: [{
      from: "input",
      to: "work/flow",
      channels: ["control", "data"],
      mappings: [{ fromPath: ["content"], toPath: ["prompt"] }],
      metadata: { transport: "typed" },
    }],
    branches: [
      { from: "input", targets: ["end"], metadata: { route: "fallback" } },
      { from: "input", targets: ["fallback", "end"], metadata: { route: "primary" } },
      { from: "input", targets: ["fallback"] },
    ],
  },
  execution: {
    nodes: [
      { path: ["input"], status: "success", durationMs: 10 },
      { path: ["work/flow"], status: "success", durationMs: 20 },
      { path: ["work/flow", "model"], status: "success", durationMs: null, metrics: { tokens: 4 } },
    ],
  },
};

assert(validateWorkflowSnapshot(snapshot).valid, "overlapping Eino branch targets are valid");
const normalized = normalizeDAGSnapshot(snapshot);
assert(normalized.definition.nodes[0].status === undefined, "definition omits execution state");
assert(normalized.runtimeByPath.input.status === "success", "root execution is indexed");
const nestedKey = encodeNodePath(["work/flow", "model"]);
assert(normalized.runtimeByPath[nestedKey].metrics.tokens === 4, "nested execution uses an unambiguous path key");
assert(JSON.stringify(decodeNodePath(nestedKey)) === '["work/flow","model"]', "encoded paths round trip");
for (const path of [["START"], ["END"], ["tilde~slash/"], ["\ud800"]]) {
  assert(
    JSON.stringify(decodeNodePath(encodeNodePath(path))) === JSON.stringify(path),
    `path ${JSON.stringify(path)} round trips without endpoint collisions`,
  );
}
assert(normalized.root.edges[0].kind === "control+data", "edge channels project to renderer semantics");
assert(
  normalized.root.edges[0].mappings[0].toPath[0] === "prompt",
  "Eino field mappings survive renderer projection",
);
assert(
  normalized.definition.edges[0].metadata.transport === "typed",
  "edge metadata survives structural normalization",
);
assert(normalized.root.edges[1].kind === "branch", "Eino branches project to renderer edges");
assert(
  normalized.root.edges[1].branchMetadata.route === "fallback",
  "the first branch metadata remains the singular compatibility value",
);
const overlappingBranchEdge = normalized.root.edges.find(
  (edge) => edge.from === "input" && edge.to === "fallback",
);
assert(
  JSON.stringify(overlappingBranchEdge.branchMetadataList) ===
    '[{"route":"primary"},null]',
  "all overlapping branch metadata survives renderer projection in snapshot order",
);
assert(
  JSON.stringify(normalized.definition.edges.find(
    (edge) => edge.from === "input" && edge.to === "fallback",
  ).branchMetadataList) ===
    '[{"route":"primary"},null]',
  "all overlapping branch metadata survives structural normalization",
);
assert(normalized.definition.nodes[1].component === "Workflow", "Eino component identity survives projection");
assert(normalized.definition.nodes[1].graph.nodes[0].kind === "llm", "Eino components map to visual kinds");

const withoutExecution = structuredClone(snapshot);
delete withoutExecution.execution;
const withoutExecutionNormalized = normalizeDAGSnapshot(withoutExecution);
assert(
  withoutExecutionNormalized.root.nodes.every((node) => node.status === undefined),
  "nodes without final execution records do not receive an invented status",
);

const stateOnly = structuredClone(snapshot);
stateOnly.execution.nodes[0].status = "failed";
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
