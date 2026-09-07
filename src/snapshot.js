import { createKeyMap } from "./key-map.js";

function graphDefinition(source) {
  return {
    version: source.version,
    scene: source.scene,
    nodes: [],
    edges: [],
    ...(source.critical_path === undefined
      ? {}
      : { critical_path: source.critical_path.slice() }),
  };
}

/**
 * Split a validated wire snapshot into structural and runtime projections.
 * This is an internal boundary: callers still provide one DAG v2 object.
 */
export function normalizeDAGSnapshot(root) {
  const definition = graphDefinition(root);
  const runtimeByPath = createKeyMap();
  const layoutSignals = [];
  const pending = [{ source: root, target: definition, prefix: "" }];

  while (pending.length) {
    const { source, target, prefix } = pending.pop();
    target.edges = source.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      ...(edge.kind === undefined ? {} : { kind: edge.kind }),
    }));

    target.nodes = source.nodes.map((node) => {
      const path = prefix ? `${prefix}/${node.id}` : node.id;
      runtimeByPath[path] = {
        status: node.status,
        started_at_ms: node.started_at_ms,
        finished_at_ms: node.finished_at_ms,
        cost_ms: node.cost_ms,
        metrics: node.metrics,
        err_msg: node.err_msg,
      };
      layoutSignals.push([
        path,
        node.status === "skipped" ? 1 : 0,
        node.cost_ms == null ? 0 : node.cost_ms,
      ]);

      const projected = {
        id: node.id,
        ...(node.name === undefined ? {} : { name: node.name }),
        ...(node.kind === undefined ? {} : { kind: node.kind }),
      };
      if (node.graph) {
        projected.graph = graphDefinition(node.graph);
        pending.push({
          source: node.graph,
          target: projected.graph,
          prefix: path,
        });
      }
      return projected;
    });
  }

  const definitionKey = JSON.stringify(definition);
  return {
    definition,
    definitionKey,
    layoutKey: JSON.stringify([definitionKey, layoutSignals]),
    runtimeByPath,
  };
}
