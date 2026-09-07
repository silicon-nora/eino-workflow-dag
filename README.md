# eino-workflow-dag

An embeddable, framework-independent renderer for nested Eino workflow DAGs
and execution traces.

`eino-workflow-dag` turns a JSON-safe workflow description into an interactive
graph with recursive subgraphs, critical-path emphasis, runtime status, and
orthogonal edge routing. It can be used from a framework application or from a
plain browser page.

> **Project status:** `0.4.0-alpha.2` is ready for publication under npm's
> `next` dist-tag. Public APIs may still change before `1.0.0`.

> **Community project:** this project is not affiliated with or endorsed by
> CloudWeGo or ByteDance.

## Why this project exists

Workflow visualization often starts as application-specific frontend code. As
soon as multiple products need the same graph, copied renderers drift: fixes,
layout behavior, and interaction details must be synchronized manually.

This library provides one reusable implementation with three explicit layers:

- a recursive, framework-neutral DAG data contract;
- model and layout logic that does not depend on a UI framework;
- a Cytoscape-based browser renderer with plain, Vue, and React entry points.

Application-specific fetching, permissions, navigation, and business actions
stay in the host application.

## Features

- Recursive workflow graphs with expand and collapse controls
- Critical-path calculation and highlighting
- Runtime states, durations, errors, and metrics in node tooltips
- Orthogonal edge routing with compound-node awareness
- `RIGHT`, `LEFT`, `DOWN`, and `UP` layout directions
- Classic, ink, and midnight themes
- Runtime data replacement without remounting
- Topology layout and orthogonal-route caching
- One strict, JSON-safe Eino DAG snapshot protocol
- Optional Vue 3 and React 18/19 components
- Optional module-worker layout protocol
- Keyboard navigation, accessible summaries, and PNG/JPEG/SVG export
- ESM and CommonJS package entries plus a self-contained UMD browser build
- TypeScript declarations without requiring TypeScript at runtime

## Installation

After the first npm release:

```bash
npm install --save-exact eino-workflow-dag@0.4.0-alpha.2
```

For local development before publication:

```bash
cd /absolute/path/to/eino-workflow-dag
npm run prepublishOnly
npm pack
cd /path/to/consumer
npm install /absolute/path/to/eino-workflow-dag/eino-workflow-dag-0.4.0-alpha.2.tgz
```

Use the tarball rather than a committed cross-repository `file:` dependency.
`npm pack` rebuilds and verifies `dist` automatically.

## Quick start

The container must be inside a `.cy-wrap` element with an explicit height.

```html
<div class="eino-workflow-dag-flow">
  <div class="cy-wrap">
    <div id="workflow-dag" class="cy-root"></div>
  </div>
</div>
```

```css
@import "eino-workflow-dag/styles.css";

.eino-workflow-dag-flow .cy-wrap {
  height: 640px;
}
```

```js
import { mountWorkflowDAG } from "eino-workflow-dag";
import "eino-workflow-dag/styles.css";

const root = {
  version: 2,
  scene: "answer-question",
  nodes: [
    {
      id: "retrieve",
      name: "Retrieve",
      kind: "io",
      status: "success",
      cost_ms: 42,
    },
    {
      id: "generate",
      name: "Generate",
      kind: "llm",
      status: "running",
      cost_ms: 310,
    },
  ],
  edges: [{ from: "retrieve", to: "generate" }],
};

const dag = mountWorkflowDAG(document.querySelector("#workflow-dag"), {
  root,
  direction: "RIGHT",
  theme: "classic",
});

// Release browser resources when the host view is removed.
// dag.destroy();
```

The repository includes a complete plain-browser example under
`examples/plain`.

## Vue 3

Vue is an optional peer dependency. Import the first-party component from the
`/vue` subpath and give it a height through style or a host class:

```vue
<script setup lang="ts">
import { ref } from "vue";
import {
  EinoWorkflowDAGVue,
  type EinoWorkflowDAGVueRef,
} from "eino-workflow-dag/vue";
import "eino-workflow-dag/styles.css";

const direction = ref("RIGHT");
const activeNodeId = ref<string | null>(null);
const dagRef = ref<EinoWorkflowDAGVueRef>();

function selectNode(node) {
  console.log(node.id);
}
</script>

<template>
  <EinoWorkflowDAGVue
    ref="dagRef"
    :root="dagData"
    :active-node-id="activeNodeId"
    :direction="direction"
    :pin-node-tip="false"
    style="height: 640px"
    @node-click="selectNode"
  />
</template>
```

Replacing `root` calls `setData()` rather than remounting. Changes to
`direction`, `theme`, `locale`, `expanded`, and `activeNodeId` also use their
corresponding incremental instance methods. Events are `ready`,
`expanded-change`, `node-click`, `edge-click`, and `error`. Set `fit-on-update`
only when every data update should reset the viewport. The component ref
exposes `setData()`, expansion,
direction, theme, locale, zoom, resize, subgraph, diagnostics, viewport reset,
and export methods; `getInstance()` remains available for the deliberately
low-level `cy()` escape hatch. `layout-cache-size` controls the same per-instance
layout cache as the core and React APIs.

## React 18 and 19

React is also an optional peer dependency. The `/react` wrapper preserves the
renderer instance across prop updates and exposes imperative methods through a
ref:

```tsx
import { useRef } from "react";
import {
  EinoWorkflowDAGReact,
  type EinoWorkflowDAGReactRef,
} from "eino-workflow-dag/react";
import "eino-workflow-dag/styles.css";

function Workflow({ dagData, activeNodeId }) {
  const dagRef = useRef<EinoWorkflowDAGReactRef>(null);

  return (
    <EinoWorkflowDAGReact
      ref={dagRef}
      root={dagData}
      activeNodeId={activeNodeId}
      direction="RIGHT"
      style={{ height: 640 }}
      onNodeClick={(node) => console.log(node.id)}
    />
  );
}
```

The wrapper supports React StrictMode cleanup, incremental `root`, `direction`,
`theme`, `locale`, `expanded`, and `activeNodeId` updates, and the `ready`,
expansion, node, edge, and error callbacks. Its ref has the same non-lifecycle
imperative methods as the Vue ref; `getInstance()` is only needed for the
low-level `cy()` escape hatch. Formatter, accessibility, custom style, and
resize configuration are mount-time options.

## Updating a running workflow

Use `setData()` when a trace poll or event stream delivers new runtime data.
By default, existing subgraph expansion state and the current viewport are
preserved. Expansion entries for subgraphs that no longer exist are removed.

```js
dag.setData(nextRoot);

// Reset expansion to the new graph defaults and fit it into the viewport.
dag.setData(nextRoot, {
  preserveExpanded: false,
  fit: true,
});
```

When visible topology is unchanged, `setData()` patches runtime fields in place
without rerunning layout. When topology changes, it adds and removes only the
affected Cytoscape elements before rerunning layout, so unchanged elements keep
their identity and host-added classes. Completed layouts and orthogonal routes
are reused from a bounded topology cache when the same visible graph returns.

## Data contract

A graph contains nodes and edges. Nested graphs use the same shape recursively.
Node IDs only need to be unique within their graph layer; rendered nested IDs
are derived from their complete path. The only supported public input protocol
is an explicit root `version: 2`; v1 and versionless roots are rejected. See
[CONTRACT.md](./CONTRACT.md) for compatibility rules and invariants.

```ts
interface DAGData {
  version: 2;
  scene?: string;
  nodes: DAGNode[];
  edges: DAGEdge[];
  critical_path?: string[];
}

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

interface DAGEdge {
  from: string;
  to: string;
  kind?: string;
}
```

### Node kinds

The built-in renderer recognizes these visual kinds:

| Kind | Intended use |
| --- | --- |
| `graph` | Expandable nested workflow |
| `llm` | Chat model or agentic model |
| `io` | Retriever, tool, loader, or external I/O |
| `cpu` | General computation or lambda |
| `merge` | Passthrough or merge operation |
| `branch` | Conditional branch |

Unknown kinds remain renderable and use the default node appearance.

### Runtime states

Built-in labels recognize `pending`, `running`, `success`, `failed`,
`degraded`, and `skipped`; failure, degradation, and skipped states also have
distinct theme treatments. Unknown states remain visible in tooltips and
accessible summaries and can be styled through `additionalStyles`.

### Contract validation

Mounting and `setData()` validate the complete snapshot before rendering.
Applications can also validate earlier at an API boundary:

```js
import { assertValidDAG, validateDAG } from "eino-workflow-dag";

const result = validateDAG(root);
if (!result.valid) {
  console.error(result.errors);
}

assertValidDAG(root); // throws TypeError with paths for invalid data
```

Validation detects malformed graph layers, missing or duplicate node IDs,
invalid endpoints, dangling edges, self edges, directed cycles, and non-JSON
values anywhere in the payload. It rejects values that would throw, change, or
silently disappear during JSON serialization without invoking property getters.

## Eino producer boundary

Eino's `compose.GraphInfo` contains Go functions, reflected types, and runtime
instances, so the original Go value is not a browser protocol. The backend
must project it directly into the DAG v2 snapshot above. The browser package
does not accept a second `GraphInfo`-shaped payload.

The producer mapping is:

- `GraphInfo.Name` to `scene`;
- node keys to `nodes[].id`, with component names mapped to visual `kind`;
- `Edges`, `DataEdges`, and `Branches` to same-layer `edges[]`;
- nested `GraphInfo` to a `kind: "graph"` node's recursive `graph`;
- callback/runtime data to the node's status, timing, error, and metrics fields.

`GraphBranch` contains runtime functions and private state, so the producer
must call `GetEndNode()` and emit its destinations as `kind: "branch"` edges.
Duplicate endpoints can be combined into one deterministic kind such as
`control+data` or `control+branch`.

Only acyclic Eino Workflow and DAG-mode Graph output is supported. Pregel or
other cyclic Graph output must be rejected by the producer; the browser
validator rejects cycles as a final boundary check.

For runtime updates, construct the next DAG v2 snapshot and pass it to
`setData()`. This intentionally keeps lifecycle-event aliases and transport
ordering semantics outside the public library contract.

When the producer includes `critical_path`, it is the authoritative same-layer
path. The renderer computes a path from topology and runtime costs only when
the field is omitted.

Common component mappings are:

| Eino component | DAG kind |
| --- | --- |
| `Graph`, `Workflow`, `Chain` | `graph` |
| `ChatModel`, `AgenticModel` | `llm` |
| retrievers, tools, loaders, indexers, embeddings | `io` |
| `Passthrough` | `merge` |
| other components | `cpu` |

## API

### `mountWorkflowDAG(container, options)`

Creates a renderer and returns a `WorkflowDAGInstance`.

Mount options:

| Option | Type | Default |
| --- | --- | --- |
| `root` | `DAGData` | required |
| `direction` | `RIGHT \| LEFT \| DOWN \| UP` | `RIGHT` |
| `theme` | `classic \| ink \| midnight` | `classic` |
| `expanded` | `Record<string, boolean>` | critical subgraphs |
| `activeNodeId` | rendered path or unique graph-local key | `null` |
| `onExpandedChange` | callback | no-op |
| `onNodeClick` | callback | no-op |
| `onEdgeClick` | callback | no-op |
| `onError` | recovered internal error callback | no-op |
| `tooltipFormatter` | `(node) => string` | built-in formatter |
| `nodeLabelFormatter` | `(node) => string` | built-in formatter |
| `additionalStyles` | Cytoscape selector rules | `[]` |
| `ariaLabel` | accessible name override | generated graph summary |
| `accessibilityLabelFormatter` | summary formatter callback | built-in English summary |
| `keyboardNavigation` | `boolean` | `true` |
| `layoutCacheSize` | layouts retained per instance | `12` |
| `locale` | built-in label overrides | English labels |
| `pinNodeTip` | `boolean` | `true` |
| `autoResize` | `boolean` | `true` |
| `debug` | `boolean` | `false` |

Instance methods:

| Method | Purpose |
| --- | --- |
| `setData(root, options?)` | Replace workflow data without remounting |
| `render(options?)` | Rebuild the visible graph and layout |
| `expandAll()` / `collapseAll()` | Change all nested graph states |
| `togglePath(path)` | Toggle one nested graph |
| `getExpanded()` / `setExpanded(map)` | Read or replace expansion state |
| `getActiveNodeId()` / `setActiveNodeId(id)` | Read, highlight, or clear the active node without relayout |
| `setTheme(theme)` / `getTheme()` | Change or inspect the theme |
| `setLocale(locale)` / `getLocale()` | Change or inspect built-in labels |
| `setDirection(direction)` / `getDirection()` | Change or inspect layout direction |
| `zoomIn()` / `zoomOut()` | Change viewport zoom |
| `resetView()` | Fit the graph into the viewport |
| `resize()` | Notify Cytoscape that its container changed size |
| `exportImage(options?)` | Export the graph as a PNG, JPEG, or SVG `Blob` |
| `getDiagnostics()` | Read data-patch, layout, and cache counters |
| `listSubgraphs()` | Return all recursive subgraph paths |
| `destroy()` | Remove event handlers and release the renderer |
| `cy()` | Advanced, unstable access to the Cytoscape instance |

`destroy()` is idempotent, which makes repeated framework cleanup safe. After
destruction, `cy()` returns `null`; rendering, viewport, export, and other
mutating methods throw instead of silently recreating browser resources.
`setExpanded()` is also idempotent: an equivalent map does not relayout or emit
`onExpandedChange`; false entries are normalized away because the map records
expanded paths only. `setData()` emits that callback only when preserving or
resetting data actually changes the surviving expansion map.
`setLocale()` similarly ignores an equivalent resolved locale, keeping
controlled Vue and React props cheap even when their object identity changes.
`setActiveNodeId()` is also idempotent and does not run layout. A path-qualified
render ID such as `research/search` is matched exactly; a graph-local key such
as `search` is accepted only when it identifies one visible node. The requested
ID is retained while that node is hidden by a collapsed subgraph, so expanding
the graph restores the highlight automatically. Pass `null` to clear it.
Runtime tooltip, overlay, and zoom styles are scoped to an internal host marker
so generic class names in the consuming application are unaffected. When a
plain mount adds that marker or creates an overlay host, `destroy()` removes it
and restores the host's previous theme attributes, CSS variables, and canvas
background.

The root entry exports only the renderer, theme registration, and DAG
validation boundary. Advanced model, layout, worker, and validation helpers
remain available through explicit subpaths so data-only consumers do not load
the renderer.

`cy()` is an escape hatch and is not covered by the future stable API promise.

Callbacks receive plain data snapshots rather than Cytoscape elements. This
keeps normal integrations independent of the underlying renderer:

```js
const dag = mountWorkflowDAG(container, {
  root,
  onNodeClick(node) {
    if (node.expandable && !node.expanded) return;
    navigateToTrace(node.key);
  },
  onEdgeClick(edge) {
    console.log(edge.source, edge.target);
  },
  tooltipFormatter(node) {
    return `${node.title}\n${node.status} · ${node.cost_ms}ms`;
  },
});
```

Node callbacks expose both the unique rendered path in `node.id` (such as
`research/search`) and the original graph-local ID in `node.key` (`search`).
Use `key` for application lookups rather than splitting the rendered path.

Built-in node kinds, statuses, tooltip headings, and the subgraph collapse title
can be localized without replacing the full formatters:

```js
const dag = mountWorkflowDAG(container, {
  root,
  locale: {
    kinds: { cpu: "代码", graph: "子流程" },
    statuses: { running: "运行中", success: "成功", failed: "失败" },
    tooltip: { status: "状态", duration: "耗时", error: "错误" },
    collapseSubgraphTitle: "收起子流程",
  },
});
```

### Custom themes and node styles

Register partial theme tokens before mounting. Missing tokens inherit from
`classic`; the returned function unregisters the theme, which is useful during
development or test cleanup.

```js
import {
  mountWorkflowDAG,
  registerWorkflowDAGTheme,
} from "eino-workflow-dag";

const unregister = registerWorkflowDAGTheme("brand", {
  canvas: { bg: "#f7f7fb" },
  colors: { critical: "#6d28d9", probe: "#0891b2" },
});

const dag = mountWorkflowDAG(container, {
  root,
  theme: "brand",
  additionalStyles: [
    {
      selector: 'node[kind = "approval"]',
      style: { "border-color": "#6d28d9", "border-width": 3 },
    },
  ],
});
```

The three built-in theme IDs are reserved and cannot be replaced. Additional
style rules are appended after the active theme, so they can introduce custom
node kinds or override selected Cytoscape properties without forking the core.

### Exporting an image

`exportImage()` returns a `Promise<Blob>` and exports the complete graph by
default. PNG and SVG use the active theme background; JPEG also accepts a
quality setting.

```js
const image = await dag.exportImage({
  format: "svg",
  maxWidth: 1600,
});

const url = URL.createObjectURL(image);
downloadLink.href = url;
```

Raster images contain the Cytoscape canvas. SVG is generated from the final
node geometry, computed orthogonal routes, labels, and active Cytoscape styles;
it remains editable and does not depend on a GPL export extension. DOM overlays
such as pinned tooltips and expanded-subgraph title buttons, external node
images, and custom Cytoscape shapes are intentionally excluded.

## Browser usage without a bundler

The UMD build includes Cytoscape and exposes `EinoWorkflowDAG`:

```html
<link rel="stylesheet" href="./eino-workflow-dag.css" />
<script src="./eino-workflow-dag.umd.cjs"></script>
<script>
  const dag = EinoWorkflowDAG.mountWorkflowDAG(container, { root });
</script>
```

## Architecture

```text
             Eino producer
                    │
                    │ DAG Snapshot v2
                    ▼
            strict validation
                    │
                    ▼
        recursive DAG snapshot model
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
    visible model       layered layout
          └─────────┬─────────┘
                    ▼
       Cytoscape renderer + overlays
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
     port planning     orthogonal routing
```

The model, layout, and internal port-planning policy are plain-data modules.
Port selection is tested independently from the orthogonal route geometry;
only the renderer requires a browser DOM. Internal snapshot normalization
separates structural definition from runtime state so status-only updates can
patch in place, while cost, skipped-state, label, and topology changes rerun
layout when they can affect the critical path or geometry. The Cytoscape
adapter talks to an internal layout-engine interface; the lightweight built-in
layered engine remains the only shipped implementation.

```js
import { buildVisibleGraph } from "eino-workflow-dag/model";
import { layoutVisibleGraph } from "eino-workflow-dag/layout";
import { validateDAG } from "eino-workflow-dag/validation";
```

These data-only subpaths do not import Cytoscape or browser styles. Every
public JavaScript entry provides matched ESM and CommonJS declarations and
runtime files; modern Node and bundler resolution are checked from both module
systems before publication.

### Optional worker layout

The `/layout-worker` subpath exposes an experimental, bundler-neutral protocol
for running the portable layered layout outside the main thread. Create a small
module-worker entry:

```js
// layout-worker.js
import { attachLayoutWorker } from "eino-workflow-dag/layout-worker";

attachLayoutWorker();
```

Then own the Worker lifecycle explicitly in the host application:

```js
import { createLayoutWorkerClient } from "eino-workflow-dag/layout-worker";

const worker = new Worker(new URL("./layout-worker.js", import.meta.url), {
  type: "module",
});
const layouts = createLayoutWorkerClient(worker, {
  terminateOnDestroy: true,
});

const result = await layouts.run(visibleGraph, {
  direction: "RIGHT",
  signal: abortController.signal,
});

layouts.destroy();
```

This API computes portable node positions only; the interactive Cytoscape
renderer still performs endpoint routing and painting on the main thread.
Aborting a request stops awaiting its result but does not interrupt a layout
already executing inside the worker.

## Development

Requires Node.js 20 or newer.

```bash
npm install
npm run check
npm run check:licenses
npm run check:assets
npm run check:sensitive
npm run check:type-surface
npm run typecheck
npm test
npm run benchmark:check
npm run check:reproducible
npm run check:packed-consumers
npm run lint:package
npm run test:browser
npm run build
npm run pack:check
```

Validate an actual JSON payload from a producer without mounting a browser:

```bash
npm run validate:snapshot -- /path/to/dag-snapshot.json
# or
producer-command | npm run validate:snapshot
```

The command applies the same strict DAG Snapshot v2 validation used by
`mount()` and `setData()`, then reports nested graph, node, and edge counts.
It is useful as a cross-language producer gate because TypeScript declarations
cannot detect JSON `null` values or a backend that still emits version 1.

The layout benchmark enforces intentionally conservative p95 budgets of 10 ms,
30 ms, and 120 ms for the 10-, 100-, and 500-node fixtures. It measures the
portable visible-model and layered-layout modules; browser routing is covered
separately by the Playwright test.

`check:assets` rejects undeclared visual, font, archive, document, database,
executable, and other binary files. Reviewed assets must be recorded with their
source, license, reviewer, review date, and SHA-256 in
[`PUBLIC_ASSETS.json`](./PUBLIC_ASSETS.json). Inline example data still requires
human review before release.

`check:type-surface` pins the ESM declaration file used by every typed package
subpath in [`TYPE_SURFACE.json`](./TYPE_SURFACE.json). After reviewing an
intentional declaration diff and documenting its compatibility impact, run
`npm run types:surface` to accept the new hashes. Generated CommonJS
declarations remain separately checked against the ESM sources.

`check:packed-consumers` creates an exact local tarball, installs only its
contents into a temporary consumer, type-checks and bundles the core, Vue,
React, data-only, and stylesheet imports, then loads all JavaScript subpaths
through CommonJS. It does not contact a registry and removes the fixture.

`pack:check` and the release artifact creator share the same exact-package
contract. The contract independently recomputes the tarball byte size, SHA-1,
and SHA-512 integrity; rejects unsafe archive paths, missing exports, forbidden
or unreported files, and per-file size drift; then runs the source-map
exclusion, documentation, sensitive-content, public-asset, and TypeScript-surface checks
against one unpacked copy. The immutable file handed to `npm publish` therefore
receives the same checks as a local candidate.

The open-source repository remains the canonical inspectable source. The npm
artifact contains runtime builds, declarations, the contract, and license
records; generated source maps and duplicate original JavaScript are omitted.
The package gate rejects `.map` files and stale `sourceMappingURL` comments and
keeps the exact tarball below the enforced 350 KiB ceiling without removing
the UMD build.

To run the plain example after building:

```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/examples/plain/`.

The source repository also contains contribution, roadmap, migration, browser
support, release, changelog, conduct, and support documentation. The versioned
input rules shipped with the package are in [CONTRACT.md](./CONTRACT.md).

Release authorization and third-party review are recorded in
[PROVENANCE.md](./PROVENANCE.md).

## Security

Do not include secrets, prompts, model inputs, or sensitive tool results in
node metrics or error messages sent to the browser. See [SECURITY.md](./SECURITY.md)
for vulnerability reporting guidance.

## License

Licensed under Apache-2.0. See [LICENSE](./LICENSE).

Third-party software included in distributable bundles is documented in
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
