import assert from "node:assert/strict";
import { layoutVisibleGraph } from "../src/layout.js";
import { buildVisibleGraph, listSubgraphs } from "../src/model.js";

const DIRECTIONS = ["RIGHT", "LEFT", "DOWN", "UP"];
const SPECIAL_IDS = [
  "__proto__",
  "constructor",
  "toString",
  "hasOwnProperty",
  "节点",
  "emoji-🧭",
  "nul-\u0000-key",
];

function randomFor(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function makeLayer(random, seed, depth, count) {
  const ids = Array.from({ length: count }, (_, index) =>
    index < SPECIAL_IDS.length
      ? SPECIAL_IDS[(index + seed + depth) % SPECIAL_IDS.length]
      : `node-${seed}-${depth}-${index}`,
  );
  const nodes = ids.map((id, index) => {
    const nested = depth < 2 && index > 0 && index % 4 === 2;
    return {
      id,
      name: `Node ${seed}/${depth}/${index}`,
      kind: nested ? "graph" : index % 5 === 0 ? "llm" : "cpu",
      status: index % 9 === 7 ? "skipped" : index % 5 === 0 ? "failed" : "success",
      cost_ms: Math.floor(random() * 5000),
      ...(nested
        ? { graph: makeLayer(random, seed + index + 1, depth + 1, 3 + (index % 3)) }
        : {}),
    };
  });

  const edges = [];
  const pairs = new Set();
  const addEdge = (from, to) => {
    const key = JSON.stringify([from, to]);
    if (pairs.has(key)) return;
    pairs.add(key);
    edges.push({ from, to });
  };
  addEdge("START", ids[0]);
  for (let index = 0; index < ids.length - 1; index += 1) {
    addEdge(ids[index], ids[index + 1]);
    for (let target = index + 2; target < ids.length; target += 1) {
      if (random() < 0.18) addEdge(ids[index], ids[target]);
    }
  }
  addEdge(ids.at(-1), "END");
  return { nodes, edges };
}

function overlap(left, right) {
  const epsilon = 0.001;
  return (
    left.x < right.x + right.width - epsilon &&
    left.x + left.width > right.x + epsilon &&
    left.y < right.y + right.height - epsilon &&
    left.y + left.height > right.y + epsilon
  );
}

function mainCenter(position, direction) {
  return direction === "RIGHT" || direction === "LEFT"
    ? position.x + position.width / 2
    : position.y + position.height / 2;
}

for (let seed = 1; seed <= 80; seed += 1) {
  const root = { version: 2, ...makeLayer(randomFor(seed), seed, 0, 7 + (seed % 7)) };
  const expanded = Object.fromEntries(
    listSubgraphs(root).map(({ path }) => [path, true]),
  );
  const visible = buildVisibleGraph(root, expanded);
  const visibleIds = new Set(visible.nodes.map(({ id }) => id));
  assert.equal(visibleIds.size, visible.nodes.length, `seed ${seed}: visible IDs are unique`);
  for (const edge of visible.edges) {
    assert(visibleIds.has(edge.from), `seed ${seed}: edge source ${edge.from} exists`);
    assert(visibleIds.has(edge.to), `seed ${seed}: edge target ${edge.to} exists`);
  }

  for (const direction of DIRECTIONS) {
    const { positions } = layoutVisibleGraph(visible, { direction });
    assert.equal(
      Object.keys(positions).length,
      visible.nodes.length,
      `seed ${seed}/${direction}: every node has one position`,
    );
    for (const node of visible.nodes) {
      assert(Object.hasOwn(positions, node.id), `seed ${seed}/${direction}: position ${node.id}`);
      const position = positions[node.id];
      for (const key of ["x", "y", "width", "height"]) {
        assert(
          Number.isFinite(position[key]),
          `seed ${seed}/${direction}: ${node.id}.${key} is finite`,
        );
      }
      assert(position.width > 0 && position.height > 0);
    }

    const byParent = new Map();
    for (const node of visible.nodes) {
      const siblings = byParent.get(node.parent) || [];
      siblings.push(node.id);
      byParent.set(node.parent, siblings);
    }
    for (const siblings of byParent.values()) {
      for (let left = 0; left < siblings.length; left += 1) {
        for (let right = left + 1; right < siblings.length; right += 1) {
          assert(
            !overlap(positions[siblings[left]], positions[siblings[right]]),
            `seed ${seed}/${direction}: siblings ${siblings[left]} and ${siblings[right]} overlap`,
          );
        }
      }
    }

    const sign = direction === "LEFT" || direction === "UP" ? -1 : 1;
    for (const edge of visible.edges) {
      const delta =
        (mainCenter(positions[edge.to], direction) -
          mainCenter(positions[edge.from], direction)) *
        sign;
      assert(
        delta > 0,
        `seed ${seed}/${direction}: edge ${edge.from} -> ${edge.to} advances`,
      );
    }
  }
}

console.log("OK: 80 deterministic nested DAG stress fixtures passed in four directions");
