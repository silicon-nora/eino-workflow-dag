import {
  captureCytoscapeLayout,
  createLayoutCache,
  layoutCacheKey,
  restoreCytoscapeLayout,
} from "../src/layout-cache.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
}

const elements = [
  { group: "nodes", data: { id: "a", parent: "", subgraph: false } },
  { group: "nodes", data: { id: "b", parent: "", subgraph: false } },
  {
    group: "edges",
    data: { id: "e", source: "a", target: "b", kind: "", level: 0 },
  },
];
const right = layoutCacheKey("RIGHT", elements);
const down = layoutCacheKey("DOWN", elements);
assert(right !== down, "direction participates in the cache key");

const higherLevel = structuredClone(elements);
higherLevel[2].data.level = 1;
assert(
  right !== layoutCacheKey("RIGHT", higherLevel),
  "edge Level participates in the cache key",
);

const delimiterInId = [
  { group: "nodes", data: { id: "a\u0000b", parent: "", subgraph: false } },
];
const delimiterInParent = [
  { group: "nodes", data: { id: "a", parent: "b", subgraph: false } },
];
assert(
  layoutCacheKey("RIGHT", delimiterInId) !==
    layoutCacheKey("RIGHT", delimiterInParent),
  "control characters cannot create ambiguous cache keys",
);

const cache = createLayoutCache(2);
cache.set("a", { value: 1 });
cache.set("b", { value: 2 });
assert(cache.get("a").value === 1, "cache returns values");
cache.set("c", { value: 3 });
assert(cache.get("b") === undefined, "least recently used values are evicted");
assert(cache.size() === 2, "cache capacity is enforced");

function makeNode(id, position, ports) {
  let currentPosition = { ...position };
  let routing = { ports: ports.map((port) => ({ ...port })) };
  return {
    id: () => id,
    isParent: () => false,
    position(next) {
      if (next) currentPosition = { ...next };
      return { ...currentPosition };
    },
    scratch(namespace, next) {
      if (namespace !== "einoWorkflowDAG") return undefined;
      if (next) routing = next;
      return routing;
    },
  };
}

function makeEdge(id, routing, initialStyle) {
  let scratch = structuredClone(routing);
  let style = { ...initialStyle };
  return {
    id: () => id,
    scratch(namespace, next) {
      if (namespace !== "einoWorkflowDAG") return undefined;
      if (next) scratch = next;
      return scratch;
    },
    style(keyOrStyle) {
      if (typeof keyOrStyle === "string") return style[keyOrStyle];
      style = { ...style, ...keyOrStyle };
      return this;
    },
  };
}

const routeStyle = {
  "curve-style": "segments",
  "source-endpoint": "20px 0px",
  "target-endpoint": "-20px 0px",
  "edge-distances": "endpoints",
  "segment-weights": "0.5",
  "segment-distances": "24px",
};
const source = makeNode("source", { x: 10, y: 20 }, [
  { id: "source:east-0", side: "EAST", x: 40, y: 20 },
]);
const target = makeNode("target", { x: 100, y: 20 }, [
  { id: "target:west-0", side: "WEST", x: 0, y: 20 },
]);
const routeEdge = makeEdge(
  "source-target",
  {
    sourcePort: "source:east-0",
    targetPort: "target:west-0",
    _flowAbsRoute: [
      { x: 30, y: 20 },
      { x: 80, y: 20 },
    ],
  },
  routeStyle,
);
const nodes = [source, target];
const edges = [routeEdge];
const cy = {
  batch: (callback) => callback(),
  edges: () => edges,
  nodes: () => nodes,
};
const snapshot = captureCytoscapeLayout(cy);

source.position({ x: 900, y: 900 });
source.scratch("einoWorkflowDAG", { ports: [] });
routeEdge.scratch("einoWorkflowDAG", {
  sourcePort: "stale-source",
  targetPort: "stale-target",
  _flowAbsRoute: [{ x: -1, y: -1 }],
});
routeEdge.style({
  "source-endpoint": "outside-to-node",
  "target-endpoint": "outside-to-node",
  "segment-distances": "0px",
});

assert(restoreCytoscapeLayout(cy, snapshot), "a complete routed layout is restored");
assert(source.position().x === 10, "node positions are restored");
assert(
  source.scratch("einoWorkflowDAG").ports[0].side === "EAST",
  "node ports are restored",
);
assert(
  routeEdge.scratch("einoWorkflowDAG")._flowAbsRoute.length === 2,
  "absolute route points are restored",
);
assert(
  routeEdge.scratch("einoWorkflowDAG").targetPort === "target:west-0",
  "edge port ownership is restored",
);
assert(
  routeEdge.style("source-endpoint") === "20px 0px" &&
    routeEdge.style("segment-distances") === "24px",
  "routed edge styles are restored",
);

const incomplete = structuredClone(snapshot);
incomplete.routes["source-target"].points = [];
assert(
  !restoreCytoscapeLayout(cy, incomplete),
  "layouts without absolute routes are not restored",
);

console.log("OK: layout cache tests passed");
