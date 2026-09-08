# eino-workflow-dag

A framework-independent, read-only renderer for nested
[CloudWeGo Eino](https://github.com/cloudwego/eino) workflows and their
execution state.

The library accepts one JSON-safe visualization protocol, renders predictable
layered DAGs, and provides optional React and Vue bindings. It does not execute
or edit workflows.

## Install

```bash
npm install eino-workflow-dag
```

Import the stylesheet once in your application:

```js
import "eino-workflow-dag/styles.css";
```

## Quick start

```js
import { createWorkflowDAG } from "eino-workflow-dag";

const snapshot = {
  schemaVersion: 1,
  workflow: {
    nodes: [
      { id: "input", name: "Input", component: "Lambda" },
      { id: "model", name: "Generate", component: "ChatModel" },
    ],
    edges: [
      { from: "start", to: "input", channels: ["control", "data"] },
      {
        from: "input",
        to: "model",
        channels: ["control", "data"],
        mappings: [{ fromPath: ["prompt"], toPath: ["input"] }],
      },
      { from: "model", to: "end", channels: ["control", "data"] },
    ],
  },
  execution: {
    id: "run-42",
    nodes: [
      { path: ["input"], status: "success", durationMs: 12 },
      { path: ["model"], status: "running", durationMs: 240 },
    ],
  },
};

const view = createWorkflowDAG(document.querySelector("#workflow"), {
  snapshot,
  direction: "RIGHT",
  activeNodePath: ["model"],
  onNodeClick({ path, id }) {
    console.log(path, id);
  },
});

view.update(nextSnapshot);
view.destroy();
```

The host element must have a non-zero size. The renderer observes size changes
by default.

## Snapshot protocol

`EinoWorkflowSnapshot` is maintained by this library. It is a browser-facing
projection of Eino workflow information, not an Eino serialization format.
Topology and execution state live in separate sections of the same protocol:

```ts
interface EinoWorkflowSnapshot {
  readonly schemaVersion: 1;
  readonly workflow: WorkflowGraph;
  readonly execution?: WorkflowExecution | null;
  readonly metadata?: JsonObject | null;
}
```

- `workflow` is a JSON-safe projection of Eino
  [`compose.GraphInfo`](https://github.com/cloudwego/eino/blob/main/compose/introspect.go).
- Node `component` values map from Eino `GraphNodeInfo.Component`.
- Control and data dependencies are normalized into edges whose required
  `channels` are `control`, `data`, or both.
- Eino branches remain separate `branches`; they are not edge channels.
- Eino field mappings are attached to data edges as `fromPath`/`toPath` arrays.
- `execution` contains run identity, timing, status, errors, and metrics.
- Execution nodes use array paths such as `["research", "model"]`, so local IDs
  never become ambiguous.
- `metadata` is the only extension point for application-specific JSON data.
- Eino endpoints use `start` and `end`. They cannot be node IDs.
- Cyclic graphs are rejected. Eino Workflow and acyclic Graph output are in
  scope; cyclic Pregel output is not.

See [CONTRACT.md](./CONTRACT.md) for the normative schema and validation rules.

Validate an unknown value before storing it:

```ts
import { parseWorkflowSnapshot } from "eino-workflow-dag";

const snapshot = parseWorkflowSnapshot(JSON.parse(payload));
```

`parseWorkflowSnapshot()` throws `WorkflowSnapshotError`, which contains a
stable error code and structured validation issues. The non-throwing
`validateWorkflowSnapshot()` returns all detected issues.

JSON files can also be checked from a producer or CI job:

```bash
npm run validate:snapshot -- ./workflow.json
```

Go producers can use the repository's
[`compose.GraphInfo` projection](https://github.com/silicon-nora/eino-workflow-dag/tree/main/integrations/go).
It captures the compiled Eino topology, normalizes it deterministically, and
emits the same snapshot consumed by the JavaScript validator.

## Instance API

`createWorkflowDAG(container, options)` returns an instance with these groups:

- Data: `update(snapshot, options)`
- Expansion: `expandAll()`, `collapseAll()`, `toggle(path)`, `getExpanded()`,
  `setExpanded(paths)`
- Selection: `getActiveNodePath()`, `setActiveNodePath(path)`
- Presentation: direction, theme, locale, zoom, resize, and image export
- Inspection: `listSubgraphs()`, `getDiagnostics()`
- Lifecycle: `destroy()`

Calling a mutating method after `destroy()` throws. `destroy()` itself is
idempotent.

The callback and instance API uses `NodePath` arrays. It never accepts a local
node ID as an implicit global identity.

## React

```tsx
import { useRef } from "react";
import {
  EinoWorkflowDAGReact,
  type EinoWorkflowDAGReactRef,
} from "eino-workflow-dag/react";
import "eino-workflow-dag/styles.css";

export function WorkflowView({ snapshot }) {
  const ref = useRef<EinoWorkflowDAGReactRef>(null);
  return (
    <EinoWorkflowDAGReact
      ref={ref}
      snapshot={snapshot}
      activeNodePath={["model"]}
      style={{ height: 480 }}
    />
  );
}
```

## Vue

```vue
<script setup lang="ts">
import { ref } from "vue";
import type { EinoWorkflowSnapshot } from "eino-workflow-dag";
import { EinoWorkflowDAGVue } from "eino-workflow-dag/vue";
import "eino-workflow-dag/styles.css";

defineProps<{ snapshot: EinoWorkflowSnapshot }>();
const activeNodePath = ref(["model"]);
</script>

<template>
  <EinoWorkflowDAGVue
    :snapshot="snapshot"
    :active-node-path="activeNodePath"
    style="height: 480px"
  />
</template>
```

## Themes, locale, and formatting

Built-in themes are `classic`, `ink`, and `midnight`. Register application
themes with `registerWorkflowDAGTheme()`. Eino component and execution-status
values remain open strings. The renderer maps known component categories to
visual kinds such as `llm`, `io`, `cpu`, `merge`, and `graph` for styling and
formatter data. Resolved kind and status labels remain available through
`locale.kinds` and `locale.statuses`.

`tooltipFormatter` and `nodeLabelFormatter` receive renderer-owned plain data.
They include the original Eino `component` and node `metadata`; they do not
expose Cytoscape objects.

The default node label uses the node name followed by its original Eino
`component`. A duration is appended only when the snapshot contains execution
timing for that node. The internal visual kind is used for styling, not as a
replacement for the component identity.

`onEdgeClick` receives the edge `channels`, Eino field `mappings`, and edge
`metadata`. When a rendered relationship also represents an Eino branch, its
metadata is available separately as `branchMetadata`.

## Cytoscape-specific integration

The stable root API does not expose the rendering engine. Integrations that
intentionally depend on Cytoscape use the explicit adapter:

```js
import {
  createCytoscapeWorkflowDAG,
  getCytoscape,
} from "eino-workflow-dag/cytoscape";

const view = createCytoscapeWorkflowDAG(container, {
  snapshot,
  additionalStyles: [
    { selector: 'node[kind = "llm"]', style: { "border-width": 4 } },
  ],
});

const cy = getCytoscape(view);
```

This subpath is implementation-specific. Applications using it should test
upgrades against their selectors and Cytoscape calls.

## Package entries

- `eino-workflow-dag` — renderer, protocol validation, themes, and types
- `eino-workflow-dag/validation` — data-only validation entry
- `eino-workflow-dag/react` — React adapter
- `eino-workflow-dag/vue` — Vue adapter
- `eino-workflow-dag/cytoscape` — implementation-specific adapter
- `eino-workflow-dag/styles.css` — required styles

Both React and Vue are optional peer dependencies. Cytoscape is the only
production dependency.

For local routing inspection, build the package, serve the repository root,
and open the interactive
[routing preview](https://github.com/silicon-nora/eino-workflow-dag/tree/main/examples/routing-preview).
It contains serial, fan-in, diamond, nested-workflow, and stress cases in all
four layout directions. The same matrix is exercised by the browser test suite.

## Support and licensing

Public stability and deprecation rules are documented in
[COMPATIBILITY.md](./COMPATIBILITY.md). Supported runtimes and maintenance
policy are documented in [SUPPORT.md](./SUPPORT.md) and
[BROWSER_SUPPORT.md](./BROWSER_SUPPORT.md).
Security reports follow [SECURITY.md](./SECURITY.md).

Licensed under [Apache-2.0](./LICENSE). Third-party notices are recorded in
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
