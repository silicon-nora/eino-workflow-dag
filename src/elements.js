import { hasOwnKey } from "./key-map.js";
import { decodeNodePath } from "./snapshot.js";

export function formatDuration(ms) {
  if (ms === null || ms === undefined) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function defaultNodeLabel(node) {
  const title = node.name || node.key || node.id;
  const type = node.display_kind || node.component || "";
  const detail = [
    type,
    node.cost_ms == null ? "" : formatDuration(node.cost_ms),
  ].filter(Boolean).join("  ·  ");
  return detail ? `${title}\n${detail}` : title;
}

export function toVisibleNodeData(node) {
  const path = decodeNodePath(node.id);
  return {
    path,
    id: node.key || path.at(-1) || node.id,
    name: node.title || node.name || node.key || path.at(-1) || node.id,
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

/** Convert renderer node data into the single public callback representation. */
export function toRenderedNodeData(node) {
  return {
    ...toVisibleNodeData(node),
    label: node.label == null ? "" : String(node.label),
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
        ? formatter(toVisibleNodeData(node))
        : defaultNodeLabel(node);
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
      ...(node.cost_ms == null ? {} : { cost_ms: node.cost_ms }),
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
      branchMetadataList: Array.isArray(edge.branchMetadataList)
        ? edge.branchMetadataList
        : edge.kind?.split("+").includes("branch")
          ? [edge.branchMetadata == null ? null : edge.branchMetadata]
          : [],
      level: Number.isInteger(edge.level) && edge.level >= 0 ? edge.level : 0,
    };
    elements.push({ group: "edges", data });
  }
  return elements;
}

const optionalNodeDataKeys = ["status", "cost_ms"];

function patchElementData(element, spec) {
  if (spec.group === "nodes") {
    for (const key of optionalNodeDataKeys) {
      if (!hasOwnKey(spec.data, key)) element.removeData(key);
    }
  }
  element.data(spec.data);
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
      patchElementData(cy.getElementById(spec.data.id), spec);
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
      patchElementData(cy.getElementById(spec.data.id), spec);
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
