import {
  CURRENT_DAG_VERSION,
  SUPPORTED_DAG_VERSIONS,
  assertValidDAG,
  validateDAG,
} from "../src/validation.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
}

const valid = {
  version: 2,
  nodes: [
    { id: "input" },
    {
      id: "nested",
      kind: "graph",
      graph: {
        nodes: [{ id: "work" }],
        edges: [
          { from: "START", to: "work" },
          { from: "work", to: "END" },
        ],
      },
    },
  ],
  edges: [{ from: "input", to: "nested" }],
};

assert(validateDAG(valid).valid, "valid nested DAG is accepted");
assert(assertValidDAG(valid) === valid, "assertion returns the original value");
assert(CURRENT_DAG_VERSION === 2, "the current protocol is v2");
assert(
  JSON.stringify(SUPPORTED_DAG_VERSIONS) === "[2]",
  "the package advertises exactly one protocol version",
);

const invalidRoot = {
  version: 2,
  nodes: [{ id: "same" }, { id: "same" }, {}, { id: 42 }],
  edges: [
    { from: "same", to: "missing" },
    { from: "same", to: "same" },
    { from: 1, to: "same" },
  ],
};
const invalid = validateDAG(invalidRoot);

assert(!invalid.valid, "invalid DAG is rejected");
assert(invalid.errors.some((entry) => entry.code === "duplicate_node_id"), "duplicate id is reported");
assert(invalid.errors.some((entry) => entry.code === "missing_node_id"), "missing id is reported");
assert(
  invalid.errors.some((entry) => entry.code === "invalid_node_id_type"),
  "non-string ids are reported",
);
assert(invalid.errors.some((entry) => entry.code === "unknown_edge_target"), "unknown target is reported");
assert(invalid.errors.some((entry) => entry.code === "self_edge"), "self edge is reported");
assert(invalid.errors.some((entry) => entry.code === "missing_edge_endpoint"), "invalid endpoint is reported");

const cyclic = {
  version: 2,
  nodes: [{ id: "a" }, { id: "b" }],
  edges: [
    { from: "a", to: "b" },
    { from: "b", to: "a" },
  ],
};
assert(
  validateDAG(cyclic).errors.some((entry) => entry.code === "directed_cycle"),
  "directed graph cycles are reported",
);

const legacyV1 = { version: 1, nodes: [{ id: "flat" }], edges: [] };
assert(
  validateDAG(legacyV1).errors.some((entry) => entry.code === "unsupported_version"),
  "DAG v1 is rejected",
);

assert(
  validateDAG({ nodes: [{ id: "implicit" }], edges: [] }).errors.some(
    (entry) => entry.code === "missing_version" && entry.path === "root.version",
  ),
  "the root DAG requires an explicit version",
);

assert(
  validateDAG({ version: 2, nodes: [{ key: "legacy" }], edges: [] }).errors.some(
    (entry) => entry.code === "missing_node_id",
  ),
  "legacy key-only nodes are rejected",
);

for (const partial of [
  { version: 2, nodes: [{ id: "missing-edges" }] },
  { version: 2, nodes: [{ id: "null-edges" }], edges: null },
]) {
  assert(
    validateDAG(partial).errors.some((entry) => entry.code === "invalid_edges"),
    "strict validation requires an edges array",
  );
}

const unsupported = validateDAG({ version: 3, nodes: [{ id: "a/b" }], edges: [] });
assert(
  unsupported.errors.some((entry) => entry.code === "unsupported_version"),
  "unsupported root versions are reported",
);
assert(
  unsupported.errors.some((entry) => entry.code === "invalid_node_id"),
  "reserved path separators are reported",
);

const nestedV1 = validateDAG({
  version: 1,
  nodes: [{ id: "nested", kind: "graph", graph: { nodes: [], edges: [] } }],
  edges: [],
});
assert(
  nestedV1.errors.some((entry) => entry.code === "unsupported_version"),
  "a v1 root is rejected regardless of topology",
);

const invalidNestedOwner = validateDAG({
  version: 2,
  nodes: [{ id: "plain", kind: "cpu", graph: { nodes: [], edges: [] } }],
  edges: [],
});
assert(
  invalidNestedOwner.errors.some(
    (entry) => entry.code === "nested_graph_on_non_graph_node",
  ),
  "only graph nodes can own nested graphs",
);

const unsupportedNestedVersion = validateDAG({
  version: 2,
  nodes: [
    {
      id: "nested",
      kind: "graph",
      graph: { version: 99, nodes: [], edges: [] },
    },
  ],
  edges: [],
});
assert(
  unsupportedNestedVersion.errors.some(
    (entry) =>
      entry.code === "unsupported_version" && entry.path.endsWith("graph.version"),
  ),
  "explicit unsupported versions are reported inside nested graphs",
);

const nestedExplicitV1 = validateDAG({
  version: 2,
  nodes: [
    {
      id: "nested",
      kind: "graph",
      graph: { version: 1, nodes: [], edges: [] },
    },
  ],
  edges: [],
});
assert(
  nestedExplicitV1.errors.some(
    (entry) =>
      entry.code === "unsupported_version" && entry.path.endsWith(".graph.version"),
  ),
  "a nested graph cannot declare a second protocol version",
);

const invalidKnownFields = validateDAG({
  version: 2,
  scene: 42,
  cost_ms: "slow",
  nodes: [
    {
      id: "typed",
      name: false,
      status: { custom: true },
      cost_ms: "unknown",
      metrics: [],
    },
  ],
  edges: [{ from: "START", to: "typed", kind: 7 }],
});
for (const [code, path] of [
  ["invalid_string_field", "root.scene"],
  ["invalid_number_field", "root.cost_ms"],
  ["invalid_string_field", "root.nodes[0].name"],
  ["invalid_string_field", "root.nodes[0].status"],
  ["invalid_number_field", "root.nodes[0].cost_ms"],
  ["invalid_metrics", "root.nodes[0].metrics"],
  ["invalid_string_field", "root.edges[0].kind"],
]) {
  assert(
    invalidKnownFields.errors.some(
      (entry) => entry.code === code && entry.path === path,
    ),
    `${path} is checked against its declared field type`,
  );
}

const invalidCriticalPath = validateDAG({
  version: 2,
  nodes: [{ id: "known" }],
  edges: [],
  critical_path: ["known", "known", "missing", 42],
});
assert(
  invalidCriticalPath.errors.some(
    (entry) => entry.code === "duplicate_critical_path_node",
  ),
  "duplicate critical-path nodes are reported",
);
assert(
  invalidCriticalPath.errors.some(
    (entry) => entry.code === "unknown_critical_path_node",
  ),
  "unknown critical-path nodes are reported",
);
assert(
  invalidCriticalPath.errors.some(
    (entry) => entry.code === "invalid_critical_path_node",
  ),
  "non-string critical-path nodes are reported",
);
assert(
  validateDAG({
    version: 2,
    nodes: [{ id: "known" }],
    edges: [],
    critical_path: "known",
  }).errors.some((entry) => entry.code === "invalid_critical_path"),
  "critical_path must be an array",
);
assert(
  validateDAG({
    version: 2,
    nodes: [{ id: "a" }, { id: "b" }],
    edges: [],
    critical_path: ["a", "b"],
  }).errors.some((entry) => entry.code === "disconnected_critical_path"),
  "critical_path nodes must be connected in order",
);

const recursive = { nodes: [], edges: [] };
recursive.nodes.push({ id: "loop", kind: "graph", graph: recursive });
assert(
  validateDAG(recursive).errors.some((entry) => entry.code === "recursive_reference"),
  "object cycles are reported",
);

const cyclicMetrics = {};
cyclicMetrics.self = cyclicMetrics;
const nonJSON = validateDAG({
  version: 2,
  nodes: [
    {
      id: "unsafe",
      metrics: {
        bigint: 1n,
        infinite: Infinity,
        callback: () => {},
        createdAt: new Date("2026-09-06T00:00:00Z"),
        cyclic: cyclicMetrics,
      },
    },
  ],
  edges: [],
});
for (const code of [
  "non_json_value",
  "non_json_number",
  "non_json_object",
  "recursive_reference",
]) {
  assert(
    nonJSON.errors.some((entry) => entry.code === code),
    `${code} is reported for non-JSON runtime data`,
  );
}
assert(
  validateDAG({ nodes: [], edges: [], first: null, later: 1n }).errors.some(
    (entry) => entry.code === "non_json_value" && entry.path === "root.later",
  ),
  "a null value does not stop validation of later sibling fields",
);

const sparseNodes = [];
sparseNodes.length = 1;
assert(
  validateDAG({ nodes: sparseNodes, edges: [] }).errors.some(
    (entry) => entry.code === "sparse_array",
  ),
  "sparse arrays are rejected instead of silently becoming null entries",
);

const decoratedEdges = [];
decoratedEdges.note = "not serialized";
const decorated = { nodes: [], edges: decoratedEdges };
let getterInvoked = false;
Object.defineProperty(decorated, "hidden", {
  enumerable: false,
  value: "not serialized",
});
Object.defineProperty(decorated, "computed", {
  enumerable: true,
  get: () => {
    getterInvoked = true;
    return "side effect";
  },
});
decorated[Symbol("secret")] = "not serialized";
assert(
  validateDAG(decorated).errors.filter(
    (entry) => entry.code === "non_json_property",
  ).length === 4,
  "array properties, hidden values, accessors, and symbols are rejected",
);
assert(!getterInvoked, "validation does not invoke extension-field getters");

let knownGetterInvoked = false;
const getterNode = { id: "safe" };
Object.defineProperty(getterNode, "status", {
  enumerable: true,
  get: () => {
    knownGetterInvoked = true;
    return "running";
  },
});
const getterNodes = [];
Object.defineProperty(getterNodes, "0", {
  enumerable: true,
  get: () => {
    knownGetterInvoked = true;
    return getterNode;
  },
});
getterNodes.length = 1;
const getterRoot = { edges: [] };
Object.defineProperty(getterRoot, "nodes", {
  enumerable: true,
  get: () => {
    knownGetterInvoked = true;
    return getterNodes;
  },
});
const getterResult = validateDAG(getterRoot);
const getterElementResult = validateDAG({ nodes: getterNodes, edges: [] });
const getterFieldResult = validateDAG({ nodes: [getterNode], edges: [] });
assert(!knownGetterInvoked, "validation never invokes getters on known fields or array elements");
assert(
  getterResult.errors.some((entry) => entry.code === "non_json_property") &&
    getterResult.errors.some((entry) => entry.code === "invalid_nodes") &&
    getterElementResult.errors.some((entry) => entry.code === "non_json_property") &&
    getterFieldResult.errors.some((entry) => entry.code === "non_json_property"),
  "known-field accessors are rejected without evaluation",
);

const sharedMetrics = { safe: true };
assert(
  validateDAG({
    version: 2,
    nodes: [
      { id: "a", metrics: sharedMetrics },
      { id: "b", metrics: sharedMetrics },
    ],
    edges: [{ from: "a", to: "b" }],
  }).valid,
  "shared acyclic objects remain JSON serializable",
);

let sharedGraph = { nodes: [{ id: "leaf" }], edges: [] };
for (let depth = 0; depth < 40; depth += 1) {
  sharedGraph = {
    nodes: [
      { id: "left", kind: "graph", graph: sharedGraph },
      { id: "right", kind: "graph", graph: sharedGraph },
    ],
    edges: [{ from: "left", to: "right" }],
  };
}
assert(
  validateDAG({ version: 2, ...sharedGraph }).valid,
  "deep diamond-shaped sharing is validated once per unique object",
);

let deepMetrics = { leaf: true };
for (let depth = 0; depth < 5000; depth += 1) {
  deepMetrics = { next: deepMetrics };
}
assert(
  validateDAG({ version: 2, nodes: [{ id: "deep", metrics: deepMetrics }], edges: [] }).valid,
  "deep JSON values do not consume the JavaScript call stack",
);

let deeplyNestedGraph = { nodes: [], edges: [] };
for (let depth = 0; depth < 2000; depth += 1) {
  deeplyNestedGraph = {
    nodes: [
      { id: "nested", kind: "graph", graph: deeplyNestedGraph },
    ],
    edges: [],
  };
}
assert(
  validateDAG({ version: 2, ...deeplyNestedGraph }).valid,
  "deep graph nesting does not consume the JavaScript call stack",
);

let threw = false;
try {
  assertValidDAG(invalidRoot);
} catch (error) {
  threw = error instanceof TypeError && error.message.includes("Invalid DAG data");
}
assert(threw, "assertValidDAG throws a useful TypeError");

console.log("OK: DAG validation tests passed");
