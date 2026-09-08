import { createKeyMap } from "./key-map.js";

const ROUTE_STYLE_KEYS = [
  "curve-style",
  "source-endpoint",
  "target-endpoint",
  "edge-distances",
  "segment-weights",
  "segment-distances",
];

export function layoutCacheKey(direction, elements, includeRuntimeData = false) {
  const parts = [["direction", String(direction || "RIGHT")]];
  for (const spec of elements || []) {
    const data = spec.data || {};
    if (spec.group === "nodes") {
      parts.push([
        "n",
        data.id,
        data.parent || "",
        data.subgraph ? 1 : 0,
        data.expanded ? 1 : 0,
      ]);
      if (includeRuntimeData) {
        parts.push(["nd", data.label, data.kind, data.status, data.cost_ms]);
      }
    } else {
      parts.push([
        "e",
        data.id,
        data.source,
        data.target,
        data.kind || "",
        data.level,
        data.main ? 1 : 0,
      ]);
    }
  }
  return JSON.stringify(parts);
}

export function createLayoutCache(limit = 12) {
  const entries = new Map();
  const capacity = Math.max(0, Number.isFinite(Number(limit)) ? Number(limit) : 12);

  function get(key) {
    if (!entries.has(key)) return undefined;
    const value = entries.get(key);
    entries.delete(key);
    entries.set(key, value);
    return value;
  }

  function set(key, value) {
    if (capacity <= 0) return;
    entries.delete(key);
    entries.set(key, value);
    while (entries.size > capacity) {
      entries.delete(entries.keys().next().value);
    }
  }

  return {
    clear: () => entries.clear(),
    get,
    set,
    size: () => entries.size,
  };
}

export function captureCytoscapeLayout(cy) {
  const positions = createKeyMap();
  const nodeRouting = createKeyMap();
  const routes = createKeyMap();
  cy.nodes().forEach((node) => {
    if (!node.isParent()) positions[node.id()] = Object.assign({}, node.position());
    const scratch = node.scratch("einoWorkflowDAG") || {};
    nodeRouting[node.id()] = {
      ports: (scratch.ports || []).map((port) => Object.assign({}, port)),
    };
  });
  cy.edges().forEach((edge) => {
    const style = {};
    for (const key of ROUTE_STYLE_KEYS) style[key] = edge.style(key);
    const scratch = edge.scratch("einoWorkflowDAG") || {};
    routes[edge.id()] = {
      points: (scratch._flowAbsRoute || []).map((point) => ({
        x: point.x,
        y: point.y,
      })),
      sourcePort: scratch.sourcePort || null,
      style,
      targetPort: scratch.targetPort || null,
    };
  });
  return { nodeRouting, positions, routes };
}

export function restoreCytoscapeLayout(cy, snapshot) {
  if (!cy || !snapshot) return false;
  const leafNodes = cy.nodes().filter((node) => !node.isParent());
  const edges = cy.edges();
  const complete =
    leafNodes.every((node) => !!snapshot.positions[node.id()]) &&
    edges.every((edge) => {
      const route = snapshot.routes[edge.id()];
      return !!route && Array.isArray(route.points) && route.points.length >= 2;
    });
  if (!complete) return false;

  cy.batch(() => {
    leafNodes.forEach((node) => node.position(snapshot.positions[node.id()]));
    cy.nodes().forEach((node) => {
      const cached = snapshot.nodeRouting && snapshot.nodeRouting[node.id()];
      if (!cached) return;
      const scratch = node.scratch("einoWorkflowDAG") || {};
      scratch.ports = (cached.ports || []).map((port) => Object.assign({}, port));
      node.scratch("einoWorkflowDAG", scratch);
    });
    edges.forEach((edge) => {
      const cached = snapshot.routes[edge.id()];
      const scratch = edge.scratch("einoWorkflowDAG") || {};
      scratch._flowAbsRoute = cached.points.map((point) => ({
        x: point.x,
        y: point.y,
      }));
      scratch.sourcePort = cached.sourcePort;
      scratch.targetPort = cached.targetPort;
      edge.scratch("einoWorkflowDAG", scratch);
      edge.style(cached.style);
    });
  });
  return true;
}
