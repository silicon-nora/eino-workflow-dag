import { normalizeDAGSnapshot } from "../src/snapshot.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
}

const root = {
  version: 2,
  scene: "answer",
  nodes: [
    { id: "input", name: "Input", status: "running", cost_ms: 10 },
    {
      id: "work",
      name: "Work",
      kind: "graph",
      status: "success",
      cost_ms: 20,
      graph: {
        nodes: [{ id: "model", kind: "llm", metrics: { tokens: 4 } }],
        edges: [],
      },
    },
  ],
  edges: [{ from: "input", to: "work", kind: "control" }],
};

const normalized = normalizeDAGSnapshot(root);
assert(normalized.definition.nodes[0].status === undefined, "definition omits runtime state");
assert(normalized.runtimeByPath.input.status === "running", "root runtime is indexed");
assert(
  normalized.runtimeByPath["work/model"].metrics.tokens === 4,
  "nested runtime is indexed by canonical path",
);

const statusOnly = structuredClone(root);
statusOnly.nodes[0].status = "success";
statusOnly.nodes[0].metrics = { bytes: 8 };
const statusNormalized = normalizeDAGSnapshot(statusOnly);
assert(
  normalized.definitionKey === statusNormalized.definitionKey,
  "runtime changes preserve the structural definition",
);
assert(
  normalized.layoutKey === statusNormalized.layoutKey,
  "non-layout runtime changes remain patchable",
);

const costChanged = structuredClone(root);
costChanged.nodes[0].cost_ms = 11;
assert(
  normalized.layoutKey !== normalizeDAGSnapshot(costChanged).layoutKey,
  "cost changes invalidate critical-path layout",
);

const skipped = structuredClone(root);
skipped.nodes[0].status = "skipped";
assert(
  normalized.layoutKey !== normalizeDAGSnapshot(skipped).layoutKey,
  "skipped state changes invalidate critical-path layout",
);

const renamed = structuredClone(root);
renamed.nodes[0].name = "Long input label";
assert(
  normalized.definitionKey !== normalizeDAGSnapshot(renamed).definitionKey,
  "label changes invalidate structural layout",
);

console.log("OK: DAG snapshot normalization tests passed");
