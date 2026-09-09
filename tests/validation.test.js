import {
  CURRENT_SCHEMA_VERSION,
  SUPPORTED_SCHEMA_VERSIONS,
  WorkflowSnapshotError,
  parseWorkflowSnapshot,
  validateWorkflowSnapshot,
} from "../src/validation.js";

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const valid = {
  schemaVersion: 1,
  workflow: {
    nodes: [
      { id: "input" },
      {
        id: "nested",
        component: "Workflow",
        workflow: {
          nodes: [{ id: "work" }],
          edges: [
            { from: "start", to: "work", channels: ["control"] },
            { from: "work", to: "end", channels: ["control"] },
          ],
        },
      },
    ],
    edges: [{
      from: "input",
      to: "nested",
      channels: ["control", "data"],
      mappings: [{ fromPath: ["content"], toPath: ["query"] }],
    }],
    branches: [{ from: "input", targets: ["nested", "end"] }],
    metadata: { owner: "example" },
  },
  execution: {
    id: "run-1",
    startedAtMs: 1_700_000_000_000,
    nodes: [
      { path: ["input"], status: "success", durationMs: 10 },
      { path: ["nested", "work"], status: "success", durationMs: null, metrics: { tokens: 4 } },
    ],
  },
  metadata: { producer: "example" },
};

assert(validateWorkflowSnapshot(valid).valid, "valid nested snapshot is accepted");
assert(parseWorkflowSnapshot(valid) === valid, "parse returns the validated value");
assert(CURRENT_SCHEMA_VERSION === 1, "the first public schema is v1");
assert(JSON.stringify(SUPPORTED_SCHEMA_VERSIONS) === "[1]", "exactly one schema is supported");

for (const [status, durationMs] of [["success", 0], ["failed", null], ["skipped", null]]) {
  const outcome = structuredClone(valid);
  outcome.execution.nodes = [{ path: ["input"], status, durationMs }];
  assert(validateWorkflowSnapshot(outcome).valid, `${status} is a valid final outcome`);
}

for (const [input, code] of [
  [{ workflow: { nodes: [], edges: [] } }, "missing_schema_version"],
  [{ schemaVersion: 2, workflow: { nodes: [], edges: [] } }, "unsupported_schema_version"],
  [{ schemaVersion: 1 }, "invalid_workflow"],
  [{ schemaVersion: 1, workflow: { nodes: [] } }, "invalid_edges"],
]) {
  assert(validateWorkflowSnapshot(input).errors.some((entry) => entry.code === code), `${code} is reported`);
}

const invalidTopology = validateWorkflowSnapshot({
  schemaVersion: 1,
  workflow: {
    nodes: [{ id: "same" }, { id: "same" }, { id: "start" }, {}],
    edges: [
      { from: "same", to: "missing" },
      { from: "same", to: "same" },
      { from: "end", to: "same" },
      { from: "same", to: "start" },
    ],
  },
});
for (const code of [
  "duplicate_node_id",
  "invalid_node_id",
  "missing_node_id",
  "unknown_edge_target",
  "unknown_edge_source",
  "self_edge",
]) {
  assert(invalidTopology.errors.some((entry) => entry.code === code), `${code} is reported`);
}

const cyclic = validateWorkflowSnapshot({
  schemaVersion: 1,
  workflow: {
    nodes: [{ id: "a" }, { id: "b" }],
    edges: [
      { from: "a", to: "b", channels: ["control"] },
      { from: "b", to: "a", channels: ["control"] },
    ],
  },
});
assert(cyclic.errors.some((entry) => entry.code === "directed_cycle"), "cycles are rejected");

const branchCycle = validateWorkflowSnapshot({
  schemaVersion: 1,
  workflow: {
    nodes: [{ id: "a" }, { id: "b" }],
    edges: [{ from: "a", to: "b", channels: ["control"] }],
    branches: [{ from: "b", targets: ["a"] }],
  },
});
assert(branchCycle.errors.some((entry) => entry.code === "directed_cycle"), "branch relationships participate in cycle detection");

const invalidChannels = validateWorkflowSnapshot({
  schemaVersion: 1,
  workflow: {
    nodes: [{ id: "a" }, { id: "b" }],
    edges: [{ from: "a", to: "b", channels: ["data", "data", "branch"] }],
  },
});
assert(invalidChannels.errors.some((entry) => entry.code === "duplicate_edge_channel"), "duplicate channels are rejected");
assert(invalidChannels.errors.some((entry) => entry.code === "invalid_edge_channel"), "unknown channels are rejected");

const invalidExecution = validateWorkflowSnapshot({
  ...valid,
  execution: {
    startedAtMs: 1.5,
    finishedAtMs: 1,
    durationMs: -1,
    nodes: [
      { path: ["missing"], status: false },
      { path: ["input"], durationMs: 1 },
      { path: ["input"], status: "success", durationMs: 2 },
    ],
  },
});
for (const code of [
  "invalid_number_field",
  "invalid_node_status",
  "missing_node_status",
  "missing_node_duration",
  "unknown_node_path",
  "duplicate_node_execution",
]) {
  assert(invalidExecution.errors.some((entry) => entry.code === code), `${code} is reported for execution state`);
}

const invalidSkippedDuration = validateWorkflowSnapshot({
  ...valid,
  execution: {
    nodes: [{ path: ["input"], status: "skipped", durationMs: 0 }],
  },
});
assert(
  invalidSkippedDuration.errors.some((entry) => entry.code === "invalid_skipped_duration"),
  "skipped nodes require a null duration",
);

for (const status of ["pending", "running", "degraded", "unknown"]) {
  const invalidOpenStatus = validateWorkflowSnapshot({
    ...valid,
    execution: {
      nodes: [{ path: ["input"], status, durationMs: null }],
    },
  });
  assert(
    invalidOpenStatus.errors.some((entry) => entry.code === "invalid_node_status"),
    `${status} is rejected by the closed final-outcome enum`,
  );
}

const invalidRange = validateWorkflowSnapshot({
  ...valid,
  execution: { startedAtMs: 10, finishedAtMs: 9 },
});
assert(invalidRange.errors.some((entry) => entry.code === "invalid_time_range"), "backward time ranges are rejected");

const invalidMappings = validateWorkflowSnapshot({
  schemaVersion: 1,
  workflow: {
    nodes: [{ id: "a" }, { id: "b" }],
    edges: [{
      from: "a",
      to: "b",
      channels: ["control"],
      mappings: [
        { fromPath: ["value"], toPath: ["input"] },
        { fromPath: [], toPath: [] },
      ],
    }],
  },
});
assert(invalidMappings.errors.some((entry) => entry.code === "mapping_without_data_edge"), "field mappings require a data dependency");
assert(invalidMappings.errors.some((entry) => entry.code === "invalid_field_mapping"), "whole-value mappings are rejected");

const invalidBranches = validateWorkflowSnapshot({
  schemaVersion: 1,
  workflow: {
    nodes: [{ id: "route" }, { id: "a" }],
    edges: [],
    branches: [{ from: "route", targets: ["a", "a", "missing"] }],
  },
});
assert(invalidBranches.errors.some((entry) => entry.code === "duplicate_branch_target"), "duplicate branch targets are rejected");
assert(invalidBranches.errors.some((entry) => entry.code === "unknown_branch_target"), "unknown branch targets are rejected");

assert(validateWorkflowSnapshot({
  schemaVersion: 1,
  workflow: {
    nodes: [{ id: "selected" }],
    edges: [{ from: "selected", to: "end", channels: ["control"] }],
    branches: [{ from: "start", targets: ["selected", "end"] }],
  },
}).valid, "Eino branches may originate at start");

assert(validateWorkflowSnapshot({
  schemaVersion: 1,
  workflow: {
    nodes: [{ id: "route" }, { id: "answer" }],
    edges: [],
    branches: [
      { from: "route", targets: ["answer"], metadata: { condition: "first" } },
      { from: "route", targets: ["answer"], metadata: { condition: "second" } },
    ],
  },
}).valid, "distinct Eino branches may have the same source and target set");

const strict = validateWorkflowSnapshot({
  schemaVersion: 1,
  workflow: { nodes: [], edges: [], extra: true },
});
assert(strict.errors.some((entry) => entry.code === "unknown_field"), "extensions belong in metadata");

const rendererFields = validateWorkflowSnapshot({
  schemaVersion: 1,
  workflow: {
    nodes: [{ id: "a", kind: "llm" }],
    edges: [{ from: "start", to: "a", channels: ["control"], active: true }],
    levelZeroPath: ["a"],
  },
});
assert(rendererFields.errors.filter((entry) => entry.code === "unknown_field").length === 3, "renderer-only fields are outside the Eino projection");

const unsafe = validateWorkflowSnapshot({
  schemaVersion: 1,
  workflow: { nodes: [], edges: [] },
  metadata: { value: 1n },
});
assert(unsafe.errors.some((entry) => entry.code === "invalid_json_value"), "non-JSON values are rejected");

try {
  parseWorkflowSnapshot({ schemaVersion: 1, workflow: { nodes: [] } });
  assert(false, "invalid parsing throws");
} catch (error) {
  assert(error instanceof WorkflowSnapshotError, "parse throws a typed snapshot error");
  assert(error.code === "INVALID_WORKFLOW_SNAPSHOT", "typed error has a stable code");
  assert(error.issues.length > 0, "typed error exposes issues");
}

console.log("OK: workflow snapshot validation tests passed");
