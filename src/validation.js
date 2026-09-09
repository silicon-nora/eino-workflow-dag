import { findJSONValueIssues } from "./json-value.js";

export const CURRENT_SCHEMA_VERSION = 1;
export const SUPPORTED_SCHEMA_VERSIONS = Object.freeze([1]);

const EDGE_CHANNELS = new Set(["control", "data"]);
const NODE_EXECUTION_STATUSES = new Set(["success", "failed", "skipped"]);
const START = "start";
const END = "end";

function issue(code, path, message) {
  return { code, path, message };
}

function own(object, key) {
  const descriptor =
    object && typeof object === "object"
      ? Object.getOwnPropertyDescriptor(object, key)
      : undefined;
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

function propertyPath(path, key) {
  return /^[A-Za-z_$][\w$]*$/.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateKnownFields(value, path, allowed, errors) {
  if (!isObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push(issue("unknown_field", propertyPath(path, key), `Unknown field "${key}".`));
    }
  }
}

function validateString(value, path, field, errors) {
  const fieldValue = own(value, field);
  if (fieldValue !== undefined && typeof fieldValue !== "string") {
    errors.push(issue("invalid_string_field", propertyPath(path, field), `Expected ${field} to be a string.`));
  }
}

function validateNonNegativeNumber(value, path, field, errors, integer = false) {
  const fieldValue = own(value, field);
  if (fieldValue === undefined) return;
  if (
    typeof fieldValue !== "number" ||
    !Number.isFinite(fieldValue) ||
    fieldValue < 0 ||
    (integer && !Number.isSafeInteger(fieldValue))
  ) {
    const expected = integer ? "a non-negative safe integer" : "a non-negative finite number";
    errors.push(issue("invalid_number_field", propertyPath(path, field), `Expected ${field} to be ${expected}.`));
  }
}

function validateNodeDuration(value, path, status, errors) {
  const descriptor = Object.getOwnPropertyDescriptor(value, "durationMs");
  if (!descriptor || !("value" in descriptor)) {
    errors.push(issue("missing_node_duration", `${path}.durationMs`, "A node execution requires durationMs."));
    return;
  }
  const durationMs = descriptor.value;
  if (durationMs !== null && (
    typeof durationMs !== "number" ||
    !Number.isFinite(durationMs) ||
    durationMs < 0
  )) {
    errors.push(issue("invalid_number_field", `${path}.durationMs`, "Expected durationMs to be a non-negative finite number or null."));
  }
  if (status === "skipped" && durationMs !== null) {
    errors.push(issue("invalid_skipped_duration", `${path}.durationMs`, "A skipped node must have a null durationMs."));
  }
}

function validateMetadata(value, path, field, errors) {
  const metadata = own(value, field);
  if (metadata !== undefined && metadata !== null && !isObject(metadata)) {
    errors.push(issue("invalid_metadata", propertyPath(path, field), `Expected ${field} to be a JSON object or null.`));
  }
}

function validateTimeRange(value, path, errors) {
  const startedAtMs = own(value, "startedAtMs");
  const finishedAtMs = own(value, "finishedAtMs");
  if (
    Number.isSafeInteger(startedAtMs) &&
    Number.isSafeInteger(finishedAtMs) &&
    finishedAtMs < startedAtMs
  ) {
    errors.push(issue("invalid_time_range", `${path}.finishedAtMs`, "finishedAtMs must not precede startedAtMs."));
  }
}

function pathKey(path) {
  return JSON.stringify(path);
}

function validateFieldPath(value, path, errors) {
  if (
    !Array.isArray(value) ||
    !value.every((segment) => typeof segment === "string" && segment.length > 0)
  ) {
    errors.push(issue("invalid_field_path", path, "Expected an array of non-empty field-name strings."));
    return false;
  }
  return true;
}

/** Validate the library-owned, JSON-safe Eino workflow visualization snapshot. */
export function validateWorkflowSnapshot(input) {
  const jsonIssues = findJSONValueIssues(input);
  const errors = jsonIssues.map((entry) =>
    issue("invalid_json_value", entry.path, entry.message),
  );
  const knownNodePaths = new Set();
  const pendingGraphs = [];

  if (!isObject(input)) {
    errors.push(issue("invalid_snapshot", "root", "Expected a workflow snapshot object."));
    return { valid: false, errors };
  }
  if (jsonIssues.some((entry) => entry.code === "recursive_reference")) {
    return { valid: false, errors };
  }

  validateKnownFields(
    input,
    "root",
    new Set(["schemaVersion", "workflow", "execution", "metadata"]),
    errors,
  );
  const schemaVersion = own(input, "schemaVersion");
  if (schemaVersion === undefined) {
    errors.push(issue("missing_schema_version", "root.schemaVersion", `The snapshot must declare schemaVersion ${CURRENT_SCHEMA_VERSION}.`));
  } else if (!SUPPORTED_SCHEMA_VERSIONS.includes(schemaVersion)) {
    errors.push(issue("unsupported_schema_version", "root.schemaVersion", `Supported schema versions are ${SUPPORTED_SCHEMA_VERSIONS.join(", ")}.`));
  }
  validateMetadata(input, "root", "metadata", errors);

  function visitGraph(graph, path, nodePathPrefix) {
    if (!isObject(graph)) {
      errors.push(issue("invalid_workflow", path, "Expected a workflow graph object."));
      return;
    }
    validateKnownFields(graph, path, new Set(["name", "nodes", "edges", "branches", "metadata"]), errors);
    validateString(graph, path, "name", errors);
    validateMetadata(graph, path, "metadata", errors);

    const nodes = own(graph, "nodes");
    const edges = own(graph, "edges");
    const branches = own(graph, "branches");
    if (!Array.isArray(nodes)) {
      errors.push(issue("invalid_nodes", `${path}.nodes`, "Expected an array of workflow nodes."));
    }
    if (!Array.isArray(edges)) {
      errors.push(issue("invalid_edges", `${path}.edges`, "Expected an array of workflow edges."));
    }
    if (branches !== undefined && !Array.isArray(branches)) {
      errors.push(issue("invalid_branches", `${path}.branches`, "Expected an array of workflow branches."));
    }

    const ids = new Set();
    for (let index = 0; index < (Array.isArray(nodes) ? nodes.length : 0); index += 1) {
      const node = own(nodes, String(index));
      const nodeObjectPath = `${path}.nodes[${index}]`;
      if (!isObject(node)) {
        errors.push(issue("invalid_node", nodeObjectPath, "Expected a workflow node object."));
        continue;
      }
      validateKnownFields(node, nodeObjectPath, new Set(["id", "name", "component", "workflow", "metadata"]), errors);
      const id = own(node, "id");
      if (typeof id !== "string" || id.length === 0) {
        errors.push(issue("missing_node_id", `${nodeObjectPath}.id`, "A node requires a non-empty string id."));
      } else if (id === START || id === END) {
        errors.push(issue("invalid_node_id", `${nodeObjectPath}.id`, `Node id "${id}" is reserved for an Eino endpoint.`));
      } else if (ids.has(id)) {
        errors.push(issue("duplicate_node_id", `${nodeObjectPath}.id`, `Duplicate node id "${id}" in the same graph.`));
      } else {
        ids.add(id);
        knownNodePaths.add(pathKey([...nodePathPrefix, id]));
      }
      validateString(node, nodeObjectPath, "name", errors);
      validateString(node, nodeObjectPath, "component", errors);
      validateMetadata(node, nodeObjectPath, "metadata", errors);
      const nested = own(node, "workflow");
      if (nested !== undefined && nested !== null) {
        if (!isObject(nested)) {
          errors.push(issue("invalid_nested_workflow", `${nodeObjectPath}.workflow`, "Expected a nested workflow graph or null."));
        } else if (typeof id === "string" && id) {
          pendingGraphs.push({
            graph: nested,
            path: `${nodeObjectPath}.workflow`,
            nodePathPrefix: [...nodePathPrefix, id],
          });
        }
      }
    }

    const adjacency = new Map(Array.from(ids, (id) => [id, []]));
    const indegree = new Map(Array.from(ids, (id) => [id, 0]));
    const topologyPairs = new Set();
    const edgePairs = new Set();

    function addTopologyArc(from, to) {
      if (from === to || !ids.has(from) || !ids.has(to)) return;
      const pair = JSON.stringify([from, to]);
      if (topologyPairs.has(pair)) return;
      topologyPairs.add(pair);
      adjacency.get(from).push(to);
      indegree.set(to, indegree.get(to) + 1);
    }

    for (let index = 0; index < (Array.isArray(edges) ? edges.length : 0); index += 1) {
      const edge = own(edges, String(index));
      const edgePath = `${path}.edges[${index}]`;
      if (!isObject(edge)) {
        errors.push(issue("invalid_edge", edgePath, "Expected a workflow edge object."));
        continue;
      }
      validateKnownFields(edge, edgePath, new Set(["from", "to", "channels", "mappings", "metadata"]), errors);
      validateString(edge, edgePath, "from", errors);
      validateString(edge, edgePath, "to", errors);
      validateMetadata(edge, edgePath, "metadata", errors);
      const from = own(edge, "from");
      const to = own(edge, "to");
      if (typeof from !== "string" || !from || typeof to !== "string" || !to) {
        errors.push(issue("missing_edge_endpoint", edgePath, "An edge requires non-empty string from and to values."));
        continue;
      }
      const edgePair = JSON.stringify([from, to]);
      if (edgePairs.has(edgePair)) {
        errors.push(issue("duplicate_edge", edgePath, `Duplicate edge "${from}" to "${to}".`));
      } else {
        edgePairs.add(edgePair);
      }
      if (from === to) errors.push(issue("self_edge", edgePath, `Self edge "${from}" is not supported.`));
      if (from === END || (from !== START && !ids.has(from))) {
        errors.push(issue("unknown_edge_source", `${edgePath}.from`, `Unknown or invalid edge source "${from}".`));
      }
      if (to === START || (to !== END && !ids.has(to))) {
        errors.push(issue("unknown_edge_target", `${edgePath}.to`, `Unknown or invalid edge target "${to}".`));
      }

      const channels = own(edge, "channels");
      const seenChannels = new Set();
      if (!Array.isArray(channels)) {
        errors.push(issue("invalid_edge_channels", `${edgePath}.channels`, "Expected an array of edge channels."));
      } else {
        if (channels.length === 0) {
          errors.push(issue("missing_edge_channel", `${edgePath}.channels`, "An edge requires at least one Eino dependency channel."));
        }
        for (let channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
          const channel = own(channels, String(channelIndex));
          const channelPath = `${edgePath}.channels[${channelIndex}]`;
          if (!EDGE_CHANNELS.has(channel)) {
            errors.push(issue("invalid_edge_channel", channelPath, `Unsupported edge channel "${String(channel)}".`));
          } else if (seenChannels.has(channel)) {
            errors.push(issue("duplicate_edge_channel", channelPath, `Duplicate edge channel "${channel}".`));
          } else {
            seenChannels.add(channel);
          }
        }
      }

      const mappings = own(edge, "mappings");
      if (mappings !== undefined) {
        if (!Array.isArray(mappings)) {
          errors.push(issue("invalid_edge_mappings", `${edgePath}.mappings`, "Expected an array of Eino field mappings."));
        } else {
          if (mappings.length > 0 && !seenChannels.has("data")) {
            errors.push(issue("mapping_without_data_edge", `${edgePath}.mappings`, "Field mappings require the data channel."));
          }
          const seenMappings = new Set();
          for (let mappingIndex = 0; mappingIndex < mappings.length; mappingIndex += 1) {
            const mapping = own(mappings, String(mappingIndex));
            const mappingPath = `${edgePath}.mappings[${mappingIndex}]`;
            if (!isObject(mapping)) {
              errors.push(issue("invalid_field_mapping", mappingPath, "Expected an Eino field-mapping object."));
              continue;
            }
            validateKnownFields(mapping, mappingPath, new Set(["fromPath", "toPath", "metadata"]), errors);
            validateMetadata(mapping, mappingPath, "metadata", errors);
            const fromPath = own(mapping, "fromPath");
            const toPath = own(mapping, "toPath");
            const validFrom = validateFieldPath(fromPath, `${mappingPath}.fromPath`, errors);
            const validTo = validateFieldPath(toPath, `${mappingPath}.toPath`, errors);
            if (validFrom && validTo) {
              const key = JSON.stringify([fromPath, toPath]);
              if (seenMappings.has(key)) {
                errors.push(issue("duplicate_field_mapping", mappingPath, "Duplicate field mapping on the same edge."));
              } else {
                seenMappings.add(key);
              }
              if (fromPath.length === 0 && toPath.length === 0) {
                errors.push(issue("invalid_field_mapping", mappingPath, "A whole-value dependency does not need a field mapping."));
              }
            }
          }
        }
      }

      addTopologyArc(from, to);
    }

    for (let index = 0; index < (Array.isArray(branches) ? branches.length : 0); index += 1) {
      const branch = own(branches, String(index));
      const branchPath = `${path}.branches[${index}]`;
      if (!isObject(branch)) {
        errors.push(issue("invalid_branch", branchPath, "Expected an Eino branch object."));
        continue;
      }
      validateKnownFields(branch, branchPath, new Set(["from", "targets", "metadata"]), errors);
      validateString(branch, branchPath, "from", errors);
      validateMetadata(branch, branchPath, "metadata", errors);
      const from = own(branch, "from");
      if (typeof from !== "string" || !from) {
        errors.push(issue("missing_branch_source", `${branchPath}.from`, "A branch requires a non-empty source node ID."));
      } else if (from === END || (from !== START && !ids.has(from))) {
        errors.push(issue("unknown_branch_source", `${branchPath}.from`, `Unknown or invalid branch source "${from}".`));
      }
      const targets = own(branch, "targets");
      if (!Array.isArray(targets) || targets.length === 0) {
        errors.push(issue("invalid_branch_targets", `${branchPath}.targets`, "A branch requires a non-empty array of target IDs."));
        continue;
      }
      const seenTargets = new Set();
      for (let targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
        const target = own(targets, String(targetIndex));
        const targetPath = `${branchPath}.targets[${targetIndex}]`;
        if (typeof target !== "string" || !target) {
          errors.push(issue("invalid_branch_target", targetPath, "Expected a non-empty target node ID."));
        } else if (target === START || (target !== END && !ids.has(target))) {
          errors.push(issue("unknown_branch_target", targetPath, `Unknown or invalid branch target "${target}".`));
        } else if (target === from) {
          errors.push(issue("self_edge", targetPath, `Self branch "${from}" is not supported.`));
        } else if (seenTargets.has(target)) {
          errors.push(issue("duplicate_branch_target", targetPath, `Duplicate branch target "${target}".`));
        } else {
          seenTargets.add(target);
          addTopologyArc(from, target);
        }
      }
    }

    const queue = Array.from(ids).filter((id) => indegree.get(id) === 0);
    let visited = 0;
    while (queue.length) {
      const id = queue.shift();
      visited += 1;
      for (const target of adjacency.get(id)) {
        indegree.set(target, indegree.get(target) - 1);
        if (indegree.get(target) === 0) queue.push(target);
      }
    }
    if (visited !== ids.size) {
      errors.push(issue("directed_cycle", path, "Directed cycles are not supported."));
    }
  }

  const workflow = own(input, "workflow");
  pendingGraphs.push({ graph: workflow, path: "root.workflow", nodePathPrefix: [] });
  while (pendingGraphs.length) {
    const next = pendingGraphs.pop();
    visitGraph(next.graph, next.path, next.nodePathPrefix);
  }

  const execution = own(input, "execution");
  if (execution !== undefined && execution !== null) {
    if (!isObject(execution)) {
      errors.push(issue("invalid_execution", "root.execution", "Expected an execution object or null."));
    } else {
      validateKnownFields(execution, "root.execution", new Set(["id", "startedAtMs", "finishedAtMs", "durationMs", "nodes", "metadata"]), errors);
      validateString(execution, "root.execution", "id", errors);
      validateNonNegativeNumber(execution, "root.execution", "startedAtMs", errors, true);
      validateNonNegativeNumber(execution, "root.execution", "finishedAtMs", errors, true);
      validateNonNegativeNumber(execution, "root.execution", "durationMs", errors);
      validateTimeRange(execution, "root.execution", errors);
      validateMetadata(execution, "root.execution", "metadata", errors);
      const nodeExecutions = own(execution, "nodes");
      if (nodeExecutions !== undefined && !Array.isArray(nodeExecutions)) {
        errors.push(issue("invalid_execution_nodes", "root.execution.nodes", "Expected an array of node execution states."));
      }
      const seenPaths = new Set();
      for (let index = 0; index < (Array.isArray(nodeExecutions) ? nodeExecutions.length : 0); index += 1) {
        const state = own(nodeExecutions, String(index));
        const statePath = `root.execution.nodes[${index}]`;
        if (!isObject(state)) {
          errors.push(issue("invalid_node_execution", statePath, "Expected a node execution object."));
          continue;
        }
        validateKnownFields(state, statePath, new Set(["path", "status", "startedAtMs", "finishedAtMs", "durationMs", "metrics", "errorMessage"]), errors);
        const status = own(state, "status");
        if (status === undefined) {
          errors.push(issue("missing_node_status", `${statePath}.status`, "A node execution requires a final status."));
        } else if (!NODE_EXECUTION_STATUSES.has(status)) {
          errors.push(issue("invalid_node_status", `${statePath}.status`, `Expected status to be success, failed, or skipped.`));
        }
        validateString(state, statePath, "errorMessage", errors);
        validateNonNegativeNumber(state, statePath, "startedAtMs", errors, true);
        validateNonNegativeNumber(state, statePath, "finishedAtMs", errors, true);
        validateNodeDuration(state, statePath, status, errors);
        validateTimeRange(state, statePath, errors);
        validateMetadata(state, statePath, "metrics", errors);
        const nodePath = own(state, "path");
        const validPath =
          Array.isArray(nodePath) &&
          nodePath.length > 0 &&
          nodePath.every((segment) => typeof segment === "string" && segment.length > 0);
        if (!validPath) {
          errors.push(issue("invalid_node_path", `${statePath}.path`, "Expected a non-empty array of non-empty node IDs."));
          continue;
        }
        const key = pathKey(nodePath);
        if (!knownNodePaths.has(key)) {
          errors.push(issue("unknown_node_path", `${statePath}.path`, `Unknown node path ${key}.`));
        } else if (seenPaths.has(key)) {
          errors.push(issue("duplicate_node_execution", `${statePath}.path`, `Duplicate execution state for ${key}.`));
        } else {
          seenPaths.add(key);
        }
      }
    }
  }

  const unique = [];
  const seen = new Set();
  for (const entry of errors) {
    const key = `${entry.code}\u0000${entry.path}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(entry);
    }
  }
  return { valid: unique.length === 0, errors: unique };
}

export class WorkflowSnapshotError extends TypeError {
  constructor(issues) {
    const summary = issues
      .slice(0, 5)
      .map((entry) => `${entry.path}: ${entry.message}`)
      .join("; ");
    const suffix = issues.length > 5 ? `; and ${issues.length - 5} more` : "";
    super(`Invalid Eino workflow snapshot: ${summary}${suffix}`);
    this.name = "WorkflowSnapshotError";
    this.code = "INVALID_WORKFLOW_SNAPSHOT";
    this.issues = Object.freeze(issues.slice());
  }
}

export function parseWorkflowSnapshot(input) {
  const result = validateWorkflowSnapshot(input);
  if (!result.valid) throw new WorkflowSnapshotError(result.errors);
  return input;
}
