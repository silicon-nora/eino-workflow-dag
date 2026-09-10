# Eino workflow snapshot contract

## Scope

`EinoWorkflowSnapshot` schema version `1` is the library's only public input
protocol. It is a JSON-safe projection of Eino
[`compose.GraphInfo`](https://github.com/cloudwego/eino/blob/main/compose/introspect.go)
for browser visualization; it is not a serialization of Eino Go runtime values.

The protocol covers Eino Workflow topology, acyclic Graph topology, nested
graphs, and optional execution state. Cyclic Pregel graphs are rejected.

## Root

```ts
interface EinoWorkflowSnapshot {
  schemaVersion: 1;
  workflow: WorkflowGraph;
  execution?: WorkflowExecution | null;
  metadata?: JsonObject | null;
}
```

The root must explicitly declare `schemaVersion: 1`. Nested graphs do not carry
schema versions. Unknown fields are rejected; application extensions belong in
a `metadata` object.

## Mapping from Eino

The projection preserves the public topology available from Eino
`compose.GraphInfo`:

| Projection source | Snapshot value |
| --- | --- |
| `GraphInfo.Name` | `workflow.name` |
| key in `GraphInfo.Nodes` | `workflow.nodes[].id` |
| `GraphNodeInfo.Name` | `workflow.nodes[].name` |
| `GraphNodeInfo.Component` | `workflow.nodes[].component` |
| producer node-kind resolver | `workflow.nodes[].kind` |
| `GraphNodeInfo.GraphInfo` | `workflow.nodes[].workflow` |
| `GraphInfo.Edges` | edge channel `control` |
| `GraphInfo.DataEdges` | edge channel `data` |
| `GraphNodeInfo.Mappings` with a non-empty `FromNodeKey()` | `edge.mappings` |
| each `GraphInfo.Branches` entry | `workflow.branches[]` |

When the same source and target occur in both `Edges` and `DataEdges`, the
projection emits one edge with both channels. Map iteration order is not
semantic; a producer should emit deterministic arrays for stable snapshots.

Eino values that cannot cross a JSON boundary, including component instances,
`reflect.Type`, callbacks, functions, compile options, state generators, and
static input values, are not part of the protocol. Path-only mapping records
created by `SetStaticValue` do not form topology edges and are also omitted. A
producer may export useful JSON-safe business descriptions through `metadata`.
Because Eino does not expose a general business-role field, a producer that
needs `kind` supplies it while projecting `GraphInfo`.

## Workflow topology

```ts
interface WorkflowGraph {
  name?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  branches?: WorkflowBranch[];
  metadata?: JsonObject | null;
}

interface WorkflowNode {
  id: string;
  name?: string;
  component?: string;
  kind?: "llm" | "io" | "cpu" | "branch" | "merge" | "graph";
  workflow?: WorkflowGraph | null;
  metadata?: JsonObject | null;
}
```

Node IDs must be non-empty and unique within one graph layer. IDs may contain
slashes or other JSON string characters because cross-layer identity is
represented as an array path.

`component` is the string value of Eino's component category, such as
`ChatModel`, `Lambda`, `Retriever`, `Graph`, or `Workflow`. It remains an open
string so new Eino components do not require a schema revision. A nested
`workflow` is the projection of `GraphNodeInfo.GraphInfo`.

`kind` is the renderer's closed, cross-producer visual-semantic category and
does not replace `component`. Explicit `kind` takes precedence over
component-based inference. When it is omitted, the renderer retains its
component fallback. A node containing a nested `workflow` may omit `kind` or
use `graph`; `graph` is invalid without a nested workflow.

In the default node label, an explicit `kind` replaces the displayed component
text with its raw enum value. Neither kind nor component values are translated.
The original `component` value remains available through renderer callbacks and
formatters.

The endpoint IDs `start` and `end` are reserved. `start` is valid as a
dependency or branch source and `end` as a dependency or branch target. All
other references must name a node in the same graph layer. Cross-layer
relationships are invalid.

## Control and data dependencies

```ts
interface WorkflowEdge {
  from: string;
  to: string;
  channels: ("control" | "data")[];
  mappings?: WorkflowFieldMapping[];
  metadata?: JsonObject | null;
}

interface WorkflowFieldMapping {
  fromPath: string[];
  toPath: string[];
  metadata?: JsonObject | null;
}
```

An edge is the normalized union of Eino control and data dependencies for one
source-target pair. `channels` is required, non-empty, and contains unique
values. Duplicate edges and self-edges are invalid.

Field paths map directly from Eino
[`FieldMapping.FromPath()` and `ToPath()`](https://github.com/cloudwego/eino/blob/main/compose/field_mapping.go).
Each segment is one struct field or map key. An empty `fromPath` means the
complete predecessor output; an empty `toPath` means the complete successor
input. Both paths cannot be empty in one mapping because a whole-value transfer
is already represented by the data edge. Mappings require the `data` channel
and must be unique on an edge.

## Branches

```ts
interface WorkflowBranch {
  from: string;
  targets: string[];
  metadata?: JsonObject | null;
}
```

A branch represents one Eino `GraphBranch` attached to a source node or
`start`. Its targets are the keys returned by `GraphBranch.GetEndNode()` and
may include `end`. `targets` must be a non-empty set. Branches are modeled
separately because they are conditional routing decisions, not control or data
edge channels.

Cycle detection considers control dependencies, data dependencies, and branch
targets together. All graph layers must remain acyclic.

Multiple Eino branches from one source may include the same target. The
renderer coalesces relationships with the same source and target into one
visual edge without discarding branch identity: `branchMetadataList` contains
one entry per matching branch in snapshot order, including `null` for a branch
without metadata. The existing singular `branchMetadata` field is the first
entry and remains a convenience for consumers that only expect one branch.

## Execution state

```ts
interface WorkflowExecution {
  id?: string;
  startedAtMs?: number;
  finishedAtMs?: number;
  durationMs?: number;
  nodes?: WorkflowNodeExecution[];
  metadata?: JsonObject | null;
}

interface WorkflowNodeExecution {
  path: string[];
  status: "success" | "failed" | "skipped";
  startedAtMs?: number;
  finishedAtMs?: number;
  durationMs: number | null;
  metrics?: JsonObject | null;
  errorMessage?: string;
}
```

Execution is an optional sibling of `workflow` inside the same snapshot. It is
not part of Eino `GraphInfo`; producers normally derive it from Eino callbacks
or an observability system.

Every execution `path` must identify an existing node from outermost to
innermost, for example `['research', 'model']`. A snapshot may contain at most
one execution record for each path. Each record is a final node outcome:

- `success`: the node completed successfully.
- `failed`: the node finished with an error.
- `skipped`: an authoritative Eino routing or dependency decision did not
  invoke the node.

Nodes without a final outcome have no execution record. The renderer does not
infer `skipped` from an absent record, because absence can also mean that the
run stopped early or that the producer did not provide execution information.

Timestamps are non-negative Unix epoch milliseconds and safe integers. A
`finishedAtMs` value cannot precede its corresponding `startedAtMs`.
Node duration is required and is either a non-negative finite number of
milliseconds or `null` when no measurement is available. A measured zero is
distinct from `null`. A `skipped` node must use `durationMs: null` and therefore
does not contribute duration to Level selection.

The status enum belongs to this visualization protocol. Eino exposes callback
lifecycle events rather than a public node-status field: producers normally map
`OnEnd` to `success`, `OnError` to `failed`, and add `skipped` only from routing
or observability information they can authoritatively identify.

The renderer computes visual route emphasis from the topology and execution
state. Renderer-only concepts such as a manually highlighted path or an
inactive topology edge are deliberately absent from the input protocol.

## Metadata and JSON boundary

`metadata` is opaque, application-owned JSON data. It may appear on the
snapshot, graph, node, edge, field mapping, branch, or execution. The renderer
does not reinterpret metadata as topology, execution state, or node kind.

The complete snapshot must be valid JSON data. `undefined`, functions,
symbols, bigint values, non-finite numbers, sparse arrays, accessors, class
instances, symbol properties, and object cycles are rejected. Metadata and
metrics must be objects or `null`.

Validation is descriptor-safe and does not invoke getters.

## Evolution

Schema version `1` evolves compatibly: existing fields are never removed,
renamed, or given new meanings, while new library-owned optional fields may be
added in a minor package release. Older snapshots remain valid in newer
renderers. A producer using a newly added field must require a renderer version
that understands it. Application extensions still belong in `metadata`;
incompatible protocol changes require a new `schemaVersion` and an appropriate
package-version change.

Validation issue codes and renderer error codes are stable machine-readable
values. Their human messages, order, stack traces, and causes are not stable.
The full public evolution policy is defined in
[COMPATIBILITY.md](./COMPATIBILITY.md).
