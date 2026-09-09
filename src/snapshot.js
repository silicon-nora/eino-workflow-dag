import { createKeyMap } from "./key-map.js";

export function encodeNodePath(path) {
  return path.map(encodeNodeSegment).join("/");
}

export function decodeNodePath(encoded) {
  if (!encoded) return [];
  return encoded.split("/").map((segment) => {
    const unreserved =
      segment === "~2START" || segment === "~2END" ? segment.slice(2) : segment;
    return unreserved.replaceAll("~1", "/").replaceAll("~0", "~");
  });
}

function internalEndpoint(id) {
  if (id === "start") return "START";
  if (id === "end") return "END";
  return encodeNodeSegment(id);
}

function encodeNodeSegment(id) {
  const encoded = id.replaceAll("~", "~0").replaceAll("/", "~1");
  if (encoded === "START" || encoded === "END") return `~2${encoded}`;
  return encoded;
}

function visualKind(component) {
  const value = typeof component === "string" ? component.toLowerCase() : "";
  if (value === "chatmodel" || value === "agenticmodel") return "llm";
  if (value === "graph" || value === "chain" || value === "workflow") return "graph";
  if (value === "lambda") return "cpu";
  if (value.includes("branch")) return "branch";
  if (value.includes("passthrough")) return "merge";
  if (
    value === "chattemplate" ||
    value === "agenticchattemplate" ||
    value === "embedding" ||
    value === "indexer" ||
    value === "retriever" ||
    value === "loader" ||
    value === "documenttransformer" ||
    value === "tool" ||
    value === "toolsnode" ||
    value === "agentictoolsnode"
  ) return "io";
  return value || "io";
}

function graphEdges(workflow) {
  const byPair = new Map();

  function add(from, to, channels, details = {}) {
    const key = JSON.stringify([from, to]);
    let entry = byPair.get(key);
    if (!entry) {
      entry = { from, to, channels: new Set() };
      byPair.set(key, entry);
    }
    for (const channel of channels) entry.channels.add(channel);
    if (details.mappings !== undefined) entry.mappings = details.mappings;
    if (details.metadata !== undefined) entry.metadata = details.metadata;
    if (details.branchMetadataRecord) {
      if (!entry.branchMetadataList) entry.branchMetadataList = [];
      entry.branchMetadataList.push(details.branchMetadata ?? null);
      if (entry.branchMetadataList.length === 1) {
        entry.branchMetadata = details.branchMetadata ?? null;
      }
    }
  }

  for (const edge of workflow.edges) {
    add(edge.from, edge.to, edge.channels, {
      mappings: edge.mappings,
      metadata: edge.metadata,
    });
  }
  for (const branch of workflow.branches || []) {
    for (const target of branch.targets) {
      add(branch.from, target, ["branch"], {
        branchMetadata: branch.metadata,
        branchMetadataRecord: true,
      });
    }
  }

  const order = ["control", "data", "branch"];
  return Array.from(byPair.values(), (edge) => ({
    from: internalEndpoint(edge.from),
    to: internalEndpoint(edge.to),
    kind: order.filter((channel) => edge.channels.has(channel)).join("+"),
    ...(edge.mappings === undefined ? {} : { mappings: edge.mappings }),
    ...(edge.metadata === undefined ? {} : { metadata: edge.metadata }),
    ...(edge.branchMetadata === undefined
      ? {}
      : { branchMetadata: edge.branchMetadata }),
    ...(edge.branchMetadataList === undefined
      ? {}
      : { branchMetadataList: edge.branchMetadataList }),
  }));
}

function indexExecution(snapshot) {
  const states = createKeyMap();
  for (const state of snapshot.execution?.nodes || []) {
    states[encodeNodePath(state.path)] = state;
  }
  return states;
}

/** Project the public snapshot into the renderer's private graph model. */
export function projectWorkflowSnapshot(snapshot) {
  const executionByPath = indexExecution(snapshot);

  function graphShell(workflow) {
    return {
      version: 1,
      nodes: [],
      edges: graphEdges(workflow),
    };
  }

  const root = graphShell(snapshot.workflow);
  const pending = [{ workflow: snapshot.workflow, target: root, prefix: [] }];
  while (pending.length) {
    const { workflow, target, prefix } = pending.pop();
    target.nodes = workflow.nodes.map((node) => {
      const path = [...prefix, node.id];
      const execution = executionByPath[encodeNodePath(path)] || {};
      const projected = {
        id: encodeNodeSegment(node.id),
        original_id: node.id,
        ...(node.name === undefined ? {} : { name: node.name }),
        ...(node.component === undefined ? {} : { component: node.component }),
        kind: node.kind ?? visualKind(node.component),
        ...(node.metadata === undefined ? {} : { metadata: node.metadata }),
        ...(execution.status === undefined ? {} : { status: execution.status }),
        ...(execution.startedAtMs === undefined
          ? {}
          : { started_at_ms: execution.startedAtMs }),
        ...(execution.finishedAtMs === undefined
          ? {}
          : { finished_at_ms: execution.finishedAtMs }),
        ...(execution.durationMs === undefined
          ? {}
          : { cost_ms: execution.durationMs }),
        ...(execution.metrics === undefined ? {} : { metrics: execution.metrics }),
        ...(execution.errorMessage === undefined
          ? {}
          : { err_msg: execution.errorMessage }),
      };
      if (node.workflow !== undefined && node.workflow !== null) {
        projected.kind = "graph";
        projected.graph = graphShell(node.workflow);
        pending.push({ workflow: node.workflow, target: projected.graph, prefix: path });
      }
      return projected;
    });
  }
  return root;
}

function graphDefinition(source) {
  return {
    version: source.version,
    nodes: [],
    edges: [],
  };
}

/** Split a projected snapshot into structural and execution projections. */
export function normalizeDAGSnapshot(snapshot) {
  const root = projectWorkflowSnapshot(snapshot);
  const definition = graphDefinition(root);
  const runtimeByPath = createKeyMap();
  const layoutSignals = [];
  const pending = [{ source: root, target: definition, prefix: [] }];

  while (pending.length) {
    const { source, target, prefix } = pending.pop();
    target.edges = source.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      ...(edge.kind === undefined ? {} : { kind: edge.kind }),
      ...(edge.mappings === undefined ? {} : { mappings: edge.mappings }),
      ...(edge.metadata === undefined ? {} : { metadata: edge.metadata }),
      ...(edge.branchMetadata === undefined
        ? {}
        : { branchMetadata: edge.branchMetadata }),
      ...(edge.branchMetadataList === undefined
        ? {}
        : { branchMetadataList: edge.branchMetadataList }),
    }));

    target.nodes = source.nodes.map((node) => {
      const path = [...prefix, node.id];
      const encodedPath = path.join("/");
      runtimeByPath[encodedPath] = {
        status: node.status,
        started_at_ms: node.started_at_ms,
        finished_at_ms: node.finished_at_ms,
        cost_ms: node.cost_ms,
        metrics: node.metrics,
        err_msg: node.err_msg,
      };
      layoutSignals.push([
        encodedPath,
        node.status === "skipped" ? 1 : 0,
        node.cost_ms == null ? 0 : node.cost_ms,
      ]);

      const projected = {
        id: node.id,
        ...(node.name === undefined ? {} : { name: node.name }),
        ...(node.component === undefined ? {} : { component: node.component }),
        ...(node.metadata === undefined ? {} : { metadata: node.metadata }),
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
    root,
    definition,
    definitionKey,
    layoutKey: JSON.stringify([definitionKey, layoutSignals]),
    runtimeByPath,
  };
}
