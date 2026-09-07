# Migration guide

This guide describes how to replace copied DAG renderer sources with a released
`eino-workflow-dag` package. Until the first release exists, use `npm pack` and
install the resulting tarball in a disposable local branch for verification.

For production adoption, publish the authorized alpha under the `next` dist-tag
first, then install its exact registry version. Local tarballs are verification
tools, not committed dependencies. Beta promotion follows package CI, browser
coverage, compatibility checks, and prerelease feedback.

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
  /path/to/application/workflow-api.ts WorkflowSnapshot
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

## Package verification

The release gates exercise the exact packed artifact rather than importing the
working tree directly. They cover ESM, CommonJS, UMD, Vue, React, CSS, static
browser delivery, TypeScript declarations, strict DAG Snapshot v2 validation,
reproducible builds, and the package size budget.

Applications should add their own contract, interaction, visual, and production
build checks before adopting a prerelease. Those checks belong to the
application and are not part of this library's release record.

## Rollback

Keep migration changes separate from unrelated application work. Rollback is a
single dependency and import reversal until the copied sources are deleted.
Only delete copied sources after both the package path and application tests
have passed in CI.
