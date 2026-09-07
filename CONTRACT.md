# DAG Data Contract

The library supports one public input protocol: DAG version `2`, a JSON-safe
snapshot of workflow structure and runtime state. It describes visualization
input; it does not prescribe how a workflow executes.

## Compatibility policy

- Every root payload must explicitly set `version: 2`; missing versions and
  `version: 1` are rejected by mounting, updates, and strict validation.
- Nested `graph` objects inherit v2 from the root and may omit `version`. If a
  nested graph declares a version, it must be `2`.
- Eino `compose.GraphInfo`, callbacks, and lifecycle events are producer-side
  inputs, not browser wire protocols. Producers project them directly to v2.
- Before `1.0.0`, incompatible contract changes may ship in a minor release and
  must include a migration note. After `1.0.0`, they require a new contract
  version and a semver-major package release.

## Graph

```ts
interface DAGData {
  version: 2;
  scene?: string;
  nodes: DAGNode[];
  edges: DAGEdge[];
  critical_path?: string[];
}
```

`nodes` and `edges` are required arrays. A nested graph belongs to a node with
`kind: "graph"`.

`critical_path`, when present, is the producer-authoritative, ordered path of
unique same-layer node IDs. Consecutive IDs must have a traversable edge. When
the field is omitted, the renderer derives the path from topology, costs,
skipped states, and expansion state.

## Nodes

```ts
interface DAGNode {
  id: string;
  name?: string;
  kind?: string;
  status?: string;
  cost_ms?: number;
  metrics?: Record<string, unknown>;
  err_msg?: string;
  graph?: DAGData;
}
```

Built-in presentation is provided for `pending`, `running`, `success`,
`failed`, `degraded`, and `skipped`. Other non-empty status strings remain
valid so producers can extend runtime state without changing the data contract;
hosts can localize and style them through the public extension hooks.

Node IDs are unique within one graph layer. `START` and `END` are reserved for
virtual edge endpoints, and `/` is reserved as the nested rendered-path
separator. The input protocol recognizes only `id`; the former `key` input
alias is not supported.

All other non-empty string IDs are supported, including names such as
`__proto__`, `constructor`, and `toString`; implementations must treat them as
data rather than inherited object properties.

Rendered node callbacks expose two identifiers: `id` is the globally unique,
path-qualified render ID (for example `research/search`), and `key` is the
original node ID within its graph layer (`search`). Consumers should use `key`
for business lookups and treat the `/`-joined `id` as an opaque renderer path.

Unknown node fields are preserved by data helpers and ignored by the renderer.
Unknown `kind` values use the default node presentation and can be styled with
`additionalStyles`.

## Edges

```ts
interface DAGEdge {
  from: string;
  to: string;
  kind?: string;
}
```

Endpoints reference nodes in the same graph layer. `START` is allowed only as a
virtual source and `END` only as a virtual target. Cross-level edges, self
edges, dangling endpoints, and directed cycles are invalid. The protocol
therefore supports Eino Workflow and DAG-mode Graph output, not cyclic Pregel
Graph output. If explicit
`START` or `END` edges are omitted, layout derives virtual connections from
zero-indegree and zero-outdegree nodes.

Producers emit conditional `Branches` destinations as edges with `kind:
"branch"`. When the same pair also appears in `Edges` or `DataEdges`, producers
may join the semantics deterministically, such as `control+branch` or
`control+data+branch`.

## Validation boundary

Mounting and `setData()` strictly validate complete snapshots. Applications
may validate untrusted API responses earlier at their ingestion boundary:

```js
import {
  assertValidDAG,
  CURRENT_DAG_VERSION,
  SUPPORTED_DAG_VERSIONS,
} from "eino-workflow-dag/validation";

const root = assertValidDAG(await response.json());
console.log(CURRENT_DAG_VERSION); // 2
console.log(SUPPORTED_DAG_VERSIONS); // [2]
```

Validation checks structure, identifiers, endpoints, recursion through nested
graphs, JSON object cycles, and directed graph cycles. IDs must be strings,
nested `graph` values must belong to `kind: "graph"` nodes, and any explicitly
declared nested version must be v2. The root version is mandatory. Known
string, numeric, metrics, collection, and edge fields are checked against their
documented types. Critical-path entries must be unique, connected same-layer
node IDs. Across known and extension fields
it also rejects BigInt, symbols, functions, non-finite numbers, class
instances, sparse arrays, and cycles, as well as properties that JSON
serialization would silently omit; shared acyclic objects remain valid. It
never mutates input or invokes property getters, including getters installed on
known fields or array elements. Shared structures are traversed once per unique
object and validation context, preventing reference diamonds from multiplying
validation work exponentially. JSON values and nested graph layers are walked
with explicit work stacks, so deeply nested but valid input cannot overflow the
JavaScript call stack during validation.

Repository checkouts also provide a stdin/file command for validating payloads
produced by Go or another backend before browser integration:

```bash
npm run validate:snapshot -- ./dag-snapshot.json
go-runner-that-prints-json | npm run validate:snapshot
```

This command intentionally accepts only one complete v2 snapshot at a time.
