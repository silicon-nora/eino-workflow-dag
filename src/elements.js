import { hasOwnKey, mergePlainRecords } from "./key-map.js";
import { decodeNodePath } from "./snapshot.js";

export function formatDuration(ms) {
  if (ms === null || ms === undefined) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function kindLabel(kind, localeKinds) {
  const labels = mergePlainRecords({
    start: "Start",
    end: "End",
    io: "I/O",
    llm: "LLM",
    cpu: "Code",
    branch: "Branch",
    merge: "Merge",
    subgraph: "Subgraph",
    graph: "Graph",
  }, localeKinds);
  return (hasOwnKey(labels, kind) ? labels[kind] : kind) || "Node";
}

function defaultNodeLabel(node, locale) {
  const title = node.name || node.key || node.id;
  const detail = [
    node.component || "",
    node.cost_ms == null ? "" : formatDuration(node.cost_ms),
  ].filter(Boolean).join("  ·  ");
  return detail ? `${title}\n${detail}` : title;
}

function publicVisibleNode(node) {
  return {
    path: decodeNodePath(node.id),
    id: node.key || node.id,
    name: node.name || node.key || node.id,
    ...(node.parent ? { parentPath: decodeNodePath(node.parent) } : {}),
    kind: node.kind || "",
    component: node.component || "",
    metadata: node.metadata || null,
    ...(node.status == null ? {} : { status: node.status }),
    ...(node.cost_ms == null ? {} : { durationMs: node.cost_ms }),
    metrics: node.metrics || null,
    errorMessage: node.err_msg || "",
    expandable: !!node.expandable,
    subgraph: !!node.subgraph,
    expanded: !!node.expanded,
    level: Number.isInteger(node.level) && node.level >= 0 ? node.level : 0,
  };
}

export function toCytoscapeElements(visible, options = {}) {
  const elements = [];
  const formatter = options.nodeLabelFormatter;
  for (const node of visible.nodes || []) {
    const title = node.name || node.key || node.id;
    let label = "";
    if (!node.expanded || !node.subgraph) {
      const content = formatter
        ? formatter(publicVisibleNode(node))
        : defaultNodeLabel(node, options.locale);
      label = content == null ? "" : String(content);
    }
    const data = {
      id: node.id,
      key: node.key || node.id,
      label,
      title,
      kind: node.kind || "",
      component: node.component || "",
      metadata: node.metadata || null,
      ...(node.status == null ? {} : { status: node.status }),
      cost_ms: node.cost_ms,
      metrics: node.metrics || null,
      err_msg: node.err_msg || "",
      expandable: !!node.expandable,
      subgraph: !!node.subgraph,
      expanded: !!node.expanded,
      level: Number.isInteger(node.level) && node.level >= 0 ? node.level : 0,
    };
    if (node.parent) data.parent = node.parent;
    elements.push({ group: "nodes", data });
  }

  for (const edge of visible.edges || []) {
    const data = {
      id: edge.id,
      source: edge.from,
      target: edge.to,
      kind: edge.kind || "",
      mappings: Array.isArray(edge.mappings) ? edge.mappings : [],
      metadata: edge.metadata == null ? null : edge.metadata,
      branchMetadata:
        edge.branchMetadata == null ? null : edge.branchMetadata,
      level: Number.isInteger(edge.level) && edge.level >= 0 ? edge.level : 0,
    };
    elements.push({ group: "edges", data });
  }
  return elements;
}

/**
 * Patch element data in place when IDs, groups, parents, and edge endpoints
 * match. Returns false without mutation when a topology change needs rebuild.
 */
export function patchCytoscapeElements(cy, elements) {
  if (!cy || cy.elements().length !== elements.length) return false;

  for (const spec of elements) {
    const element = cy.getElementById(spec.data.id);
    if (!element || element.empty() || element.group() !== spec.group) return false;
    if (spec.group === "nodes") {
      if ((element.data("parent") || "") !== (spec.data.parent || "")) return false;
    } else if (
      element.source().id() !== spec.data.source ||
      element.target().id() !== spec.data.target ||
      Number(element.data("level")) !== Number(spec.data.level)
    ) {
      return false;
    }
  }

  cy.batch(() => {
    for (const spec of elements) {
      cy.getElementById(spec.data.id).data(spec.data);
    }
  });
  return true;
}

/**
 * Reconcile a changed topology without clearing the whole Cytoscape graph.
 * Unchanged elements keep their identity, classes, and positions until the
 * caller runs the next layout.
 */
export function syncCytoscapeElements(cy, elements) {
  if (!cy) throw new TypeError("A Cytoscape instance is required");
  if (patchCytoscapeElements(cy, elements)) {
    return { topologyChanged: false, added: 0, removed: 0 };
  }

  const desired = new Map(elements.map((spec) => [spec.data.id, spec]));
  let removed = 0;
  let added = 0;

  cy.batch(() => {
    cy.elements().forEach((element) => {
      const spec = desired.get(element.id());
      let incompatible = !spec || element.group() !== spec.group;
      if (!incompatible && spec.group === "nodes") {
        incompatible =
          (element.data("parent") || "") !== (spec.data.parent || "");
      }
      if (!incompatible && spec.group === "edges") {
        incompatible =
          element.source().id() !== spec.data.source ||
          element.target().id() !== spec.data.target;
      }
      if (incompatible) {
        element.remove();
        removed += 1;
      }
    });

    const missingNodes = elements.filter(
      (spec) =>
        spec.group === "nodes" && cy.getElementById(spec.data.id).empty(),
    );
    if (missingNodes.length) {
      cy.add(missingNodes);
      added += missingNodes.length;
    }

    const missingEdges = elements.filter(
      (spec) =>
        spec.group === "edges" && cy.getElementById(spec.data.id).empty(),
    );
    if (missingEdges.length) {
      cy.add(missingEdges);
      added += missingEdges.length;
    }

    for (const spec of elements) {
      cy.getElementById(spec.data.id).data(spec.data);
    }
  });

  return { topologyChanged: true, added, removed };
}

export function isExpandableCollapsed(node) {
  return !!(
    node &&
    node.data("expandable") &&
    !node.isParent() &&
    !node.data("expanded")
  );
}
