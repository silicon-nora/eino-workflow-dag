import { performance } from "node:perf_hooks";
import { buildVisibleGraph } from "../src/model.js";
import { layoutVisibleGraph } from "../src/layout.js";

function makeGraph(size) {
  const nodes = Array.from({ length: size }, (_, index) => ({
    id: `node-${index}`,
    name: `Node ${index}`,
    kind: index % 7 === 0 ? "llm" : "cpu",
    status: "success",
    cost_ms: (index % 13) + 1,
  }));
  const edges = [];
  for (let index = 1; index < size; index += 1) {
    edges.push({ from: `node-${index - 1}`, to: `node-${index}` });
    if (index > 2 && index % 5 === 0) {
      edges.push({ from: `node-${index - 3}`, to: `node-${index}` });
    }
  }
  return { nodes, edges };
}

function measure(size, rounds) {
  const graph = makeGraph(size);
  const samples = [];
  for (let round = 0; round < rounds; round += 1) {
    const started = performance.now();
    const visible = buildVisibleGraph(graph, {});
    layoutVisibleGraph(visible, { direction: "RIGHT" });
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  const p95 = samples[Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1)];
  return { nodes: size, edges: graph.edges.length, medianMs: median, p95Ms: p95 };
}

const results = [measure(10, 30), measure(100, 20), measure(500, 10)];
const budgets = new Map([
  [10, 10],
  [100, 30],
  [500, 120],
]);
console.table(
  results.map((result) => ({
    nodes: result.nodes,
    edges: result.edges,
    median_ms: result.medianMs.toFixed(2),
    p95_ms: result.p95Ms.toFixed(2),
    budget_ms: budgets.get(result.nodes),
  })),
);

if (process.argv.includes("--check")) {
  const failures = results.filter(
    (result) => result.p95Ms > budgets.get(result.nodes),
  );
  if (failures.length) {
    for (const result of failures) {
      console.error(
        `FAIL: ${result.nodes}-node p95 ${result.p95Ms.toFixed(2)}ms exceeds ${budgets.get(result.nodes)}ms`,
      );
    }
    process.exitCode = 1;
  } else {
    console.log("OK: layout performance budgets passed");
  }
}
