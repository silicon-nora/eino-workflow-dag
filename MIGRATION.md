# Migration guide

This guide describes how to replace copied DAG renderer sources with a released
`eino-workflow-dag` package. Until the first release exists, use `npm pack` and
install the resulting tarball in a disposable local branch for verification.

For the real application migration, publish the authorized alpha under the
`next` dist-tag first, then install its exact registry version in both
applications. Local tarballs are rehearsal tools, not the committed dependency.
After both application branches pass CI and visual review, the library can move
from alpha to `0.4.0-beta.1`.

## Bundled applications

Install an exact package version:

```bash
npm install --save-exact eino-workflow-dag@0.4.0-alpha.2
```

Replace local model, layout, renderer, and stylesheet imports:

```ts
import {
  mountWorkflowDAG,
  type DAGData,
  type DAGDirection,
  type WorkflowDAGInstance,
} from "eino-workflow-dag";
import "eino-workflow-dag/styles.css";
```

Create one renderer per mounted view and update it in place:

```ts
let dag: WorkflowDAGInstance | null = null;

function mount(container: HTMLElement, root: DAGData) {
  dag = mountWorkflowDAG(container, {
    root,
    pinNodeTip: false,
    onNodeClick(node) {
      if (node.expandable && !node.expanded) return;
      selectTraceNode(node.key);
    },
  });
}

function update(root: DAGData) {
  dag?.setData(root);
}

function changeDirection(direction: DAGDirection) {
  dag?.setDirection(direction);
}

function unmount() {
  dag?.destroy();
  dag = null;
}
```

Remove host-owned Cytoscape event handlers and resize observers when the public
callbacks and automatic resize behavior cover them. Keep application toolbar,
empty-state, navigation, and diagnostics logic in the host.

The package scopes runtime overlay styles to the mounted workflow host. Existing
application elements that happen to use names such as `cy-node-tip` or
`cy-zoom` remain untouched, and renderer teardown restores pre-existing inline
theme values on the host.

After visual and behavioral parity is confirmed, remove the copied renderer,
model, layout, tooltip, and duplicated tests. Remove direct `cytoscape` or
`elkjs` dependencies only after checking that no other feature imports them.

## Static applications without a bundler

Install the package in the release or asset-building environment, then vendor
the two built files under a directory that records the package version:

```text
static/vendor/eino-workflow-dag/0.4.0-alpha.2/
├── eino-workflow-dag.css
└── eino-workflow-dag.umd.cjs
```

Load them in this order:

```html
<link
  rel="stylesheet"
  href="vendor/eino-workflow-dag/0.4.0-alpha.2/eino-workflow-dag.css"
/>
<script src="vendor/eino-workflow-dag/0.4.0-alpha.2/eino-workflow-dag.umd.cjs"></script>
```

The UMD build includes Cytoscape and exposes `window.EinoWorkflowDAG`. Mount it
with `EinoWorkflowDAG.mountWorkflowDAG(container, options)`. A static host does
not need to load separate Cytoscape, model, layout, or renderer scripts.

Treat vendored bundles as generated artifacts: update them only from an exact
package version and never patch them directly. Preserve
`THIRD_PARTY_NOTICES.md` in the distributed application.

## Local pre-release verification

From this repository:

```bash
npm run prepublishOnly
npm pack
```

Install the produced tarball into the bundled application without publishing
it. For a static application, unpack or install that same tarball and copy its
two `dist` assets. Delete the tarball after verification; it is not source.

Avoid committed `file:` dependencies that point outside the consumer
repository. They make clean checkouts and CI non-reproducible.

From an `eino-workflow-dag` source checkout, verify a consumer's declared DAG
payload type directly against the library contract:

```bash
node scripts/check-consumer-types.js \
  /path/to/consumer/dag-api.ts DAGMetrics
```

The checker extracts the named declaration and its local type dependencies,
then asks TypeScript to prove that the consumer value is assignable to
`DAGData`. It does not edit either repository. Runtime payload validation and
visual parity checks are still required because structural typing cannot prove
actual API responses.

## Parity checklist

- Initial critical subgraphs expand as before
- Expand-all and collapse-all controls stay synchronized
- Four layout directions preserve the expected main flow
- Node selection still opens the correct application diagnostics
- Tooltip pinning matches host expectations
- Runtime polling uses `setData()` rather than remounting
- Resizing does not reset the viewport unexpectedly
- Failed, degraded, skipped, running, and successful nodes retain their styles
- Nested graph titles and orthogonal routes do not overlap nodes
- Consumer unit, browser, and production builds pass

Normalize producers before replacing the renderer: every root payload must
emit `version: 2`, every node must use a non-empty `id`, and edges must refer to
those IDs. Versionless roots, `version: 1`, and key-only nodes are no longer
accepted. Nested graphs inherit v2 and may omit their own version.

Normalize nil Go edge slices to `edges: []` before transport. Starting with
`0.4.0-alpha.2`, mounting and `setData()` reject missing or `null` edge arrays,
cyclic graphs, and every other strict contract violation.

### Vue component migration

Vue 3 applications can replace renderer lifecycle boilerplate with the
optional wrapper:

```vue
<script setup lang="ts">
import { EinoWorkflowDAGVue } from "eino-workflow-dag/vue";
import "eino-workflow-dag/styles.css";
</script>

<template>
  <EinoWorkflowDAGVue
    :root="dagData"
    :active-node-id="activeNodeId"
    :direction="direction"
    :pin-node-tip="false"
    @node-click="node => !node.expandable && selectNode(node.key)"
  />
</template>
```

Keep application toolbars, empty states, diagnostics panels, and navigation in
the host component. The wrapper owns only renderer mount/update/destroy and
forwards interaction events as plain data.

Toolbar actions can call `expandAll()`, `collapseAll()`, `zoomIn()`, `zoomOut()`,
`resetView()`, and `resize()` directly through the Vue or React component ref.
Queries such as `getExpanded()`, `listSubgraphs()`, and `getDiagnostics()` are
also forwarded, so ordinary integrations do not need `getInstance().cy()`.

Use the controlled `activeNodeId` prop to mirror a diagnostics-panel selection
back onto the canvas. Prefer the path-qualified `node.id` from `node-click`;
an existing business ID may be passed directly when its graph-local key is
unique among visible nodes. Highlight updates do not remount or relayout.

`node.id` is the unique rendered path (for example `research/search`), while
`node.key` is the node ID inside its own graph layer (`search`). Use `key` for
business lookups and navigation; do not parse the reserved `/` path separator.

## Local integration evidence

The `0.4.0-alpha.2` candidate was exercised without committing consumer changes
against the static UMD, Vue integration, and Go producer shapes. The rehearsal
used disposable copies of both application baselines and migrations that replaced
the copied renderers with the package's public mount, interaction-event,
active-node, incremental-data, direction, theme, resize, and teardown APIs.
Evidence that remains reproducible from this checkout includes:

- the `0.4.0-alpha.2` packaged UMD browser suite rejects v1, versionless,
  cyclic, and incomplete roots while mounting valid nested v2 snapshots;
- a disposable copy of the real static host loads only the exact alpha.2 UMD/CSS
  plus its thin application adapter: the legacy renderer globals, ELK, and
  global Cytoscape are absent, while theme/direction controls, expansion,
  zoom, same-canvas incremental updates, teardown, and v1 rejection pass in
  headless Chrome;
- the five replaced static runtime assets total 2,254,201 bytes / 665,908 bytes
  gzip, compared with 553,202 bytes / 180,182 bytes gzip for the candidate UMD
  and CSS, a roughly 73% gzip reduction before HTTP-level compression tuning;
- the disposable `suggest-platform` migration uses a `DAGMetrics` declaration
  with the required literal `version: 2`; its checked-in declaration still uses
  `number` and must be narrowed on the real migration branch;
- the migrated Vue application produces no additional `vue-tsc` diagnostics
  compared with its unmodified baseline, its 24 focused trace tests pass, and
  its production Vite build completes with the exact candidate installed;
- the migrated trace route builds as one 640.94 KiB / 204.31 KiB gzip chunk,
  replacing the application's legacy DAG lazy chunk and ELK runtime;
- the checked-in `cloud-focus` producer still emits v1 for flat graphs and can
  serialize nil edge slices as `null`; the disposable migration changes both
  flat and nested output to v2 and normalizes empty edges to `[]`;
- after those producer changes, its runtime DAG test package passes and actual
  serialized flat and nested output both pass `npm run validate:snapshot`.

Bundle figures are migration snapshots, not permanent size promises. Recheck
them after consumer dependency or Vite configuration changes. The important
gate is that the package removes the copied renderer and ELK runtime while the
consumer's production build still resolves one installed package version.

Do not treat that as beta evidence. Before publishing the alpha, rerun all
library release gates after the final GitHub metadata and authorization record
are present. After publishing, each consumer must install that exact registry
version and pass its own build, CI, and visual review. The rehearsal does not
replace validation on the actual migration branches.

Neither real consumer repository was modified during this rehearsal.

## Rollback

Keep migration changes separate from unrelated application work. Rollback is a
single dependency and import reversal until the copied sources are deleted.
Only delete copied sources after both the package path and application tests
have passed in CI.
