import { findJSONValueIssues } from "./json-value.js";

function issue(code, path, message) {
  return { code, path, message };
}

export const CURRENT_DAG_VERSION = 2;
export const SUPPORTED_DAG_VERSIONS = Object.freeze([2]);

function ownDataValue(object, key) {
  if (!object || typeof object !== "object") return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

function rawNodeId(node) {
  const id = ownDataValue(node, "id");
  if (id !== undefined && id !== null && id !== "") {
    return id;
  }
  return "";
}

function propertyPath(path, key) {
  return /^[A-Za-z_$][\w$]*$/.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`;
}

function validatePrimitiveFields(value, path, fields, expectedType, errors) {
  for (const field of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (!descriptor || !("value" in descriptor) || descriptor.value === undefined) {
      continue;
    }
    if (typeof descriptor.value !== expectedType) {
      errors.push(
        issue(
          `invalid_${expectedType}_field`,
          propertyPath(path, field),
          `Expected ${field} to be a ${expectedType}.`,
        ),
      );
    }
  }
}

/**
 * Validate the recursive, JSON-safe DAG contract without mutating the input.
 *
 * Mounting and updates use this boundary too, so every rendered snapshot obeys
 * the same contract as persisted and transported data.
 */
export function validateDAG(root) {
  const errors = [];
  const completedGraphs = new WeakMap();
  errors.push(...findJSONValueIssues(root));
  const pending = [];

  function visit(graph, path, inheritedVersion, nested = false) {
    if (!graph || typeof graph !== "object" || Array.isArray(graph)) {
      errors.push(issue("invalid_graph", path, "Expected a graph object."));
      return;
    }
    const declaredVersion = ownDataValue(graph, "version");
    if (!nested && declaredVersion === undefined) {
      errors.push(
        issue(
          "missing_version",
          `${path}.version`,
          `The root DAG must explicitly declare version ${CURRENT_DAG_VERSION}.`,
        ),
      );
    }
    const supportedVersion = SUPPORTED_DAG_VERSIONS.includes(declaredVersion);
    if (declaredVersion !== undefined && !supportedVersion) {
      errors.push(
        issue(
          "unsupported_version",
          `${path}.version`,
          `Supported DAG contract versions are ${SUPPORTED_DAG_VERSIONS.join(", ")}.`,
        ),
      );
    }
    const contractVersion = supportedVersion
      ? declaredVersion
      : inheritedVersion;
    const contextKey = `${contractVersion}:${nested ? "nested" : "root"}`;
    const completedContexts = completedGraphs.get(graph);
    if (completedContexts?.has(contextKey)) return;
    validatePrimitiveFields(graph, path, ["scene", "task_id"], "string", errors);
    validatePrimitiveFields(
      graph,
      path,
      ["started_at_ms", "finished_at_ms", "cost_ms"],
      "number",
      errors,
    );

    const graphNodes = ownDataValue(graph, "nodes");
    const graphEdges = ownDataValue(graph, "edges");
    if (!Array.isArray(graphNodes)) {
      errors.push(issue("invalid_nodes", `${path}.nodes`, "Expected an array of nodes."));
    }
    if (!Array.isArray(graphEdges)) {
      errors.push(issue("invalid_edges", `${path}.edges`, "Expected an array of edges."));
    }

    const ids = new Set();
    const nodes = Array.isArray(graphNodes) ? graphNodes : [];
    for (let index = 0; index < nodes.length; index += 1) {
      const node = ownDataValue(nodes, String(index));
      const nodePath = `${path}.nodes[${index}]`;
      if (!node || typeof node !== "object" || Array.isArray(node)) {
        errors.push(issue("invalid_node", nodePath, "Expected a node object."));
        continue;
      }
      const rawId = rawNodeId(node);
      if (rawId !== "" && typeof rawId !== "string") {
        errors.push(
          issue(
            "invalid_node_id_type",
            `${nodePath}.id`,
            "A node id must be a string.",
          ),
        );
      } else if (!rawId) {
        errors.push(issue("missing_node_id", nodePath, "A node requires a non-empty id."));
      } else if (rawId === "START" || rawId === "END" || rawId.includes("/")) {
        errors.push(
          issue(
            "invalid_node_id",
            nodePath,
            `Node id "${rawId}" uses a reserved virtual ID or path separator.`,
          ),
        );
      } else if (ids.has(rawId)) {
        errors.push(issue("duplicate_node_id", nodePath, `Duplicate node id \"${rawId}\" in the same graph.`));
      } else {
        ids.add(rawId);
      }

      validatePrimitiveFields(
        node,
        nodePath,
        ["name", "kind", "status", "err_msg"],
        "string",
        errors,
      );
      validatePrimitiveFields(
        node,
        nodePath,
        ["started_at_ms", "finished_at_ms", "cost_ms"],
        "number",
        errors,
      );
      const metrics = ownDataValue(node, "metrics");
      if (
        metrics !== undefined &&
        metrics !== null &&
        (typeof metrics !== "object" || Array.isArray(metrics))
      ) {
        errors.push(
          issue(
            "invalid_metrics",
            `${nodePath}.metrics`,
            "Expected metrics to be a JSON object or null.",
          ),
        );
      }

      const nestedGraph = ownDataValue(node, "graph");
      if (nestedGraph !== undefined && nestedGraph !== null) {
        if (ownDataValue(node, "kind") !== "graph") {
          errors.push(
            issue(
              "nested_graph_on_non_graph_node",
              `${nodePath}.graph`,
              'A nested graph requires node kind "graph".',
            ),
          );
        }
        pending.push({
          graph: nestedGraph,
          path: `${nodePath}.graph`,
          inheritedVersion: contractVersion,
          nested: true,
        });
      }
    }

    const edges = Array.isArray(graphEdges) ? graphEdges : [];
    const criticalPathValue = ownDataValue(graph, "critical_path");
    const criticalPathIds = [];
    if (criticalPathValue !== undefined) {
      if (!Array.isArray(criticalPathValue)) {
        errors.push(
          issue(
            "invalid_critical_path",
            `${path}.critical_path`,
            "Expected an array of node IDs.",
          ),
        );
      } else {
        const criticalIds = new Set();
        for (let index = 0; index < criticalPathValue.length; index += 1) {
          const id = ownDataValue(criticalPathValue, String(index));
          const criticalPath = `${path}.critical_path[${index}]`;
          if (typeof id !== "string" || !id) {
            errors.push(
              issue(
                "invalid_critical_path_node",
                criticalPath,
                "Expected a non-empty string node ID.",
              ),
            );
          } else if (!ids.has(id)) {
            errors.push(
              issue(
                "unknown_critical_path_node",
                criticalPath,
                `Unknown node "${id}".`,
              ),
            );
          } else if (criticalIds.has(id)) {
            errors.push(
              issue(
                "duplicate_critical_path_node",
                criticalPath,
                `Duplicate critical-path node "${id}".`,
              ),
            );
          } else {
            criticalIds.add(id);
            criticalPathIds.push(id);
          }
        }
      }
    }
    const adjacency = new Map(Array.from(ids, (id) => [id, []]));
    const indegree = new Map(Array.from(ids, (id) => [id, 0]));
    const routablePairs = new Set();
    for (let index = 0; index < edges.length; index += 1) {
      const edge = ownDataValue(edges, String(index));
      const edgePath = `${path}.edges[${index}]`;
      if (!edge || typeof edge !== "object" || Array.isArray(edge)) {
        errors.push(issue("invalid_edge", edgePath, "Expected an edge object."));
        continue;
      }
      validatePrimitiveFields(edge, edgePath, ["kind"], "string", errors);
      const edgeFrom = ownDataValue(edge, "from");
      const edgeTo = ownDataValue(edge, "to");
      const edgeKind = ownDataValue(edge, "kind");
      const from = typeof edgeFrom === "string" ? edgeFrom : "";
      const to = typeof edgeTo === "string" ? edgeTo : "";
      if (!from || !to) {
        errors.push(issue("missing_edge_endpoint", edgePath, "An edge requires non-empty string from and to values."));
        continue;
      }
      if (from === to) {
        errors.push(issue("self_edge", edgePath, `Self edge \"${from}\" is not supported.`));
      }
      if (from !== "START" && !ids.has(from)) {
        errors.push(issue("unknown_edge_source", `${edgePath}.from`, `Unknown node \"${from}\".`));
      }
      if (to !== "END" && !ids.has(to)) {
        errors.push(issue("unknown_edge_target", `${edgePath}.to`, `Unknown node \"${to}\".`));
      }
      if (from !== to && ids.has(from) && ids.has(to)) {
        adjacency.get(from).push(to);
        indegree.set(to, indegree.get(to) + 1);
        if (edgeKind !== "no") routablePairs.add(JSON.stringify([from, to]));
      }
    }

    for (let index = 1; index < criticalPathIds.length; index += 1) {
      const from = criticalPathIds[index - 1];
      const to = criticalPathIds[index];
      if (!routablePairs.has(JSON.stringify([from, to]))) {
        errors.push(
          issue(
            "disconnected_critical_path",
            `${path}.critical_path[${index}]`,
            `No traversable edge connects "${from}" to "${to}".`,
          ),
        );
      }
    }

    const queue = Array.from(ids).filter((id) => indegree.get(id) === 0);
    let visited = 0;
    while (queue.length) {
      const id = queue.shift();
      visited += 1;
      adjacency.get(id).forEach((target) => {
        indegree.set(target, indegree.get(target) - 1);
        if (indegree.get(target) === 0) queue.push(target);
      });
    }
    if (visited !== ids.size) {
      errors.push(issue("directed_cycle", `${path}.edges`, "Directed cycles are not supported."));
    }

    const contexts = completedGraphs.get(graph) || new Set();
    contexts.add(contextKey);
    completedGraphs.set(graph, contexts);
  }

  pending.push({
    graph: root,
    path: "root",
    inheritedVersion: CURRENT_DAG_VERSION,
    nested: false,
  });
  while (pending.length) {
    const next = pending.pop();
    visit(next.graph, next.path, next.inheritedVersion, next.nested);
  }
  const seen = new Set();
  const uniqueErrors = errors.filter((entry) => {
    const key = `${entry.code}\u0000${entry.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { valid: uniqueErrors.length === 0, errors: uniqueErrors };
}

export function assertValidDAG(root) {
  const result = validateDAG(root);
  if (!result.valid) {
    const summary = result.errors
      .slice(0, 5)
      .map((entry) => `${entry.path}: ${entry.message}`)
      .join("; ");
    const suffix = result.errors.length > 5 ? `; and ${result.errors.length - 5} more` : "";
    throw new TypeError(`Invalid DAG data: ${summary}${suffix}`);
  }
  return root;
}
