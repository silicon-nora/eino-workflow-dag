import { toVisibleNodeData } from "./elements.js";
import { createKeyMap, hasOwnKey } from "./key-map.js";
import { decodeNodePath, encodeNodePath } from "./snapshot.js";

export function sameExpandedMap(left, right) {
  const leftKeys = Object.keys(left || {});
  const rightKeys = Object.keys(right || {});
  return leftKeys.length === rightKeys.length && leftKeys.every((key) =>
    hasOwnKey(right, key) && left[key] === right[key]
  );
}

export function normalizeExpandedMap(source) {
  const normalized = createKeyMap();
  if (!source || typeof source !== "object") return normalized;
  Object.keys(source).forEach((path) => {
    if (source[path]) normalized[path] = true;
  });
  return normalized;
}

export function normalizeNodePath(value, name) {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.some((id) => typeof id !== "string" || !id)
  ) {
    throw new TypeError(`${name} must be a non-empty array of node IDs`);
  }
  return value.slice();
}

export function expandedPathsToMap(source) {
  const normalized = createKeyMap();
  if (!Array.isArray(source)) {
    throw new TypeError("expanded must be an array of node paths");
  }
  source.forEach((path) => {
    normalized[encodeNodePath(normalizeNodePath(path, "expanded path"))] = true;
  });
  return normalized;
}

export function expandedMapToPaths(source) {
  return Object.keys(source || {}).filter((path) => source[path]).map(decodeNodePath);
}

export function normalizeActiveNodePath(value) {
  return value == null
    ? null
    : encodeNodePath(normalizeNodePath(value, "activeNodePath"));
}

function edgeChannels(kind) {
  if (!kind) return [];
  return kind.split("+").filter((channel) =>
    channel === "control" || channel === "data" || channel === "branch"
  );
}

export function publicEdgeData(edge) {
  return {
    id: edge.id,
    source: decodeNodePath(edge.source),
    target: decodeNodePath(edge.target),
    channels: edgeChannels(edge.kind),
    mappings: Array.isArray(edge.mappings) ? edge.mappings : [],
    metadata: edge.metadata == null ? null : edge.metadata,
    branchMetadata: edge.branchMetadata == null ? null : edge.branchMetadata,
    branchMetadataList: Array.isArray(edge.branchMetadataList)
      ? edge.branchMetadataList
      : [],
    level: Number(edge.level) || 0,
  };
}

export function publicVisibleGraph(visible) {
  return {
    nodes: visible.nodes.map((node) => toVisibleNodeData({
      ...node,
      title: node.name,
      key: node.key,
      parent: node.parent,
    })),
    edges: visible.edges.map((edge) => publicEdgeData({
      ...edge,
      source: edge.from,
      target: edge.to,
    })),
    levelZeroPath: visible.levelZeroPath.map((id) => decodeNodePath(id)),
    levelZeroDurationMs: visible.levelZeroDurationMs,
  };
}

export function listPublicSubgraphs(snapshot) {
  const result = [];
  const pending = [{ graph: snapshot.workflow, prefix: [] }];
  while (pending.length) {
    const current = pending.pop();
    current.graph.nodes.forEach((node) => {
      const path = current.prefix.concat(node.id);
      if (node.workflow !== undefined && node.workflow !== null) {
        result.push({ path, name: node.name || node.id, node });
        pending.push({ graph: node.workflow, prefix: path });
      }
    });
  }
  return result;
}

function sameRecord(left, right) {
  const leftKeys = Object.keys(left || {});
  const rightKeys = Object.keys(right || {});
  return leftKeys.length === rightKeys.length && leftKeys.every((key) =>
    hasOwnKey(right, key) && left[key] === right[key]
  );
}

export function sameLocale(left, right) {
  return (
    left.collapseSubgraphTitle === right.collapseSubgraphTitle &&
    sameRecord(left.kinds, right.kinds) &&
    sameRecord(left.statuses, right.statuses) &&
    sameRecord(left.tooltip, right.tooltip)
  );
}
