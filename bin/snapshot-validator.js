import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const commandName = "eino-workflow-dag-validate";

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function countWorkflow(workflow) {
  let graphCount = 0;
  let nodeCount = 0;
  let edgeCount = 0;
  const pending = [workflow];

  while (pending.length) {
    const graph = pending.pop();
    graphCount += 1;
    nodeCount += graph.nodes.length;
    edgeCount += graph.edges.length;
    for (const node of graph.nodes) {
      if (node.workflow) pending.push(node.workflow);
    }
  }

  return { graphCount, nodeCount, edgeCount };
}

export function runSnapshotValidator(
  validateWorkflowSnapshot,
  {
    args = process.argv.slice(2),
    cwd = process.cwd(),
    stdin = 0,
    stdout = process.stdout,
    stderr = process.stderr,
  } = {},
) {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    stdout.write(
      `Usage: ${commandName} [snapshot.json|-]\n\n` +
        "Validate an EinoWorkflowSnapshot schema v1 JSON file. Reads stdin when no path or - is supplied.\n",
    );
    return 0;
  }

  if (args.length > 1 || (args[0]?.startsWith("-") && args[0] !== "-")) {
    stderr.write(`Usage: ${commandName} [snapshot.json|-]\n`);
    return 2;
  }

  const inputPath = args[0];
  const sourceLabel = inputPath && inputPath !== "-" ? resolve(cwd, inputPath) : "stdin";
  let root;

  try {
    const input = sourceLabel === "stdin"
      ? readFileSync(stdin, "utf8")
      : readFileSync(sourceLabel, "utf8");
    root = JSON.parse(input);
  } catch (error) {
    stderr.write(`Workflow snapshot check failed: ${sourceLabel}: ${errorMessage(error)}\n`);
    return 1;
  }

  let result;
  try {
    result = validateWorkflowSnapshot(root);
  } catch (error) {
    stderr.write(`Workflow snapshot check failed: ${sourceLabel}: ${errorMessage(error)}\n`);
    return 1;
  }

  if (!result.valid) {
    for (const entry of result.errors) {
      stderr.write(`${entry.code} ${entry.path}: ${entry.message}\n`);
    }
    stderr.write(
      `Workflow snapshot check failed: ${sourceLabel} does not satisfy EinoWorkflowSnapshot schema v1\n`,
    );
    return 1;
  }

  const { graphCount, nodeCount, edgeCount } = countWorkflow(root.workflow);
  stdout.write(
    `OK: ${sourceLabel} is EinoWorkflowSnapshot schema v1 (${graphCount} graphs, ${nodeCount} nodes, ${edgeCount} edges)\n`,
  );
  return 0;
}
