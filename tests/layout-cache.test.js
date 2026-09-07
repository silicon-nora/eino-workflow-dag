import {
  createLayoutCache,
  layoutCacheKey,
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
    data: { id: "e", source: "a", target: "b", kind: "", level: 1, main: true },
  },
];
const right = layoutCacheKey("RIGHT", elements);
const down = layoutCacheKey("DOWN", elements);
assert(right !== down, "direction participates in the cache key");

const bypass = structuredClone(elements);
bypass[2].data.main = false;
bypass[2].data.level = 2;
assert(
  right !== layoutCacheKey("RIGHT", bypass),
  "critical route semantics participate in the cache key",
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

console.log("OK: layout cache tests passed");
