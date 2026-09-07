import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateWorkflowSnapshot } from "../src/validation.js";

const inputPath = process.argv[2];
const sourceLabel = inputPath ? resolve(inputPath) : "stdin";

function fail(message) {
  process.stderr.write(`Workflow snapshot check failed: ${message}\n`);
  process.exit(1);
}

let root;
try {
  const input = inputPath
    ? readFileSync(sourceLabel, "utf8")
    : readFileSync(0, "utf8");
  root = JSON.parse(input);
} catch (error) {
  fail(`${sourceLabel}: ${error instanceof Error ? error.message : String(error)}`);
}

const result = validateWorkflowSnapshot(root);
if (!result.valid) {
  for (const entry of result.errors) {
    process.stderr.write(`${entry.code} ${entry.path}: ${entry.message}\n`);
  }
  fail(`${sourceLabel} does not satisfy EinoWorkflowSnapshot schema v1`);
}

let graphCount = 0;
let nodeCount = 0;
let edgeCount = 0;
const pending = [root.workflow];
while (pending.length) {
  const graph = pending.pop();
  graphCount += 1;
  nodeCount += graph.nodes.length;
  edgeCount += graph.edges.length;
  for (const node of graph.nodes) {
    if (node.workflow) pending.push(node.workflow);
  }
}

console.log(
  `OK: ${sourceLabel} is EinoWorkflowSnapshot schema v1 (${graphCount} graphs, ${nodeCount} nodes, ${edgeCount} edges)`,
);
