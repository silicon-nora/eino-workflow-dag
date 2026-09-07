const STATUS_ORDER = [
  "running",
  "failed",
  "degraded",
  "success",
  "skipped",
  "pending",
];

function countLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function summarizeVisibleGraph(graph) {
  const nodes = Array.isArray(graph && graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph && graph.edges) ? graph.edges : [];
  const statusCounts = new Map();
  let expandedSubgraphs = 0;
  let collapsedSubgraphs = 0;

  for (const node of nodes) {
    const status = node && node.status;
    if (status) statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    if (node && node.subgraph) {
      if (node.expanded) expandedSubgraphs += 1;
      else collapsedSubgraphs += 1;
    }
  }

  const unknownStatuses = Array.from(statusCounts.keys())
    .filter((status) => !STATUS_ORDER.includes(status))
    .sort();
  const statusText = STATUS_ORDER.concat(unknownStatuses)
    .filter((status) => statusCounts.get(status))
    .map((status) => `${statusCounts.get(status)} ${status}`)
    .join(", ");
  const subgraphCount = expandedSubgraphs + collapsedSubgraphs;
  const parts = [
    `Workflow DAG with ${countLabel(nodes.length, "node")} and ${countLabel(edges.length, "edge")}.`,
  ];
  if (statusText) parts.push(`Statuses: ${statusText}.`);
  if (subgraphCount) {
    parts.push(
      `Subgraphs: ${countLabel(expandedSubgraphs, "expanded subgraph")} and ${countLabel(collapsedSubgraphs, "collapsed subgraph")}.`,
    );
  }

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    statuses: Object.fromEntries(statusCounts),
    expandedSubgraphs,
    collapsedSubgraphs,
    text: parts.join(" "),
  };
}

export function createAccessibilityPresenter(container, options = {}) {
  const originalRole = container.getAttribute("role");
  const originalLabel = container.getAttribute("aria-label");
  let graphLabel = "";
  if (!originalRole) container.setAttribute("role", "img");

  function update(visible) {
    const summary = summarizeVisibleGraph(visible);
    let label = options.ariaLabel || summary.text;
    if (typeof options.labelFormatter === "function") {
      const formatted = options.labelFormatter(summary, visible);
      if (formatted != null) label = String(formatted);
    }
    graphLabel = label;
    container.setAttribute("aria-label", graphLabel);
    return summary;
  }

  function focusNode(node) {
    if (!node) {
      container.setAttribute("aria-label", graphLabel);
      return;
    }
    const title = node.title || node.key || node.id || "Unnamed";
    const details = [`Focused workflow node ${title}.`];
    if (node.component) details.push(`Component ${node.component}.`);
    if (node.status) details.push(`Status ${node.status}.`);
    container.setAttribute("aria-label", details.join(" "));
  }

  function destroy() {
    if (originalRole == null) container.removeAttribute("role");
    else container.setAttribute("role", originalRole);
    if (originalLabel == null) container.removeAttribute("aria-label");
    else container.setAttribute("aria-label", originalLabel);
  }

  return { destroy, focusNode, update };
}
