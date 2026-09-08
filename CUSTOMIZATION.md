# Visual and interaction customization

This document defines the stable customization boundary for the renderer. It is
separate from `EinoWorkflowSnapshot`: presentation settings belong to the host
application and never become workflow data.

## Theme input

The `theme` option and `setTheme()` accept either a registered theme name or an
instance definition:

```ts
const dag = createWorkflowDAG(container, {
  snapshot,
  theme: {
    base: "classic",
    tokens: {
      canvas: { bg: "#f8fafc" },
      colors: {
        highlighted: "#2563eb",
        probe: "#7c3aed",
        probeGlow: "#c4b5fd",
      },
      node: {
        width: 240,
        height: 68,
        textMaxWidth: 216,
        radius: 10,
      },
      spacing: {
        nodeNode: 64,
        betweenLayers: 56,
      },
      tooltip: {
        bg: "rgba(15, 23, 42, 0.97)",
        color: "#f8fafc",
        borderColor: "#334155",
      },
    },
  },
});
```

`base` defaults to `classic`. Instance tokens override the base without
registering a global name. Use `registerWorkflowDAGTheme(name, tokens)` when
several renderer instances should share the same theme.

`setTheme()` applies paint-only changes without a layout run. Changes to node
dimensions or spacing clear the instance layout cache and run layout again.
`getTheme()` returns the current registered name or a detached copy of the
instance definition.

Unknown token sections, unknown token names, invalid types, non-finite numbers,
and out-of-range geometry throw `TypeError`. This prevents a misspelled public
token from silently producing a partially themed graph.

## Token groups

All fields are optional. Omitted fields inherit from the base theme.

| Group | Purpose |
| --- | --- |
| `canvas` | Canvas background |
| `colors` | Node kinds, execution states, routes, and interaction colors |
| `node` | Node dimensions, typography, shape, border, and state opacity |
| `edge` | Route width, arrows, secondary route pattern, and Level 0 emphasis |
| `overlay` | Expanded subgraph title presentation |
| `tooltip` | Tooltip surface, border, shadow, dimensions, and typography |
| `spacing` | Root/nested node gaps, layer gaps, and fit padding |

Geometry bounds are part of the contract:

| Token | Accepted range |
| --- | --- |
| `node.width` | 80–600 px |
| `node.height` | 32–240 px |
| `node.textMaxWidth` | 40–560 px |
| `spacing.nodeNode`, `spacing.nestedNodeNode` | 8–240 px |
| `spacing.betweenLayers`, `spacing.nestedBetweenLayers` | 16–320 px |
| `spacing.fitPadding` | 0–160 px |

TypeScript exposes the complete field list and bounds-sensitive fields are also
validated at runtime. A node's `textMaxWidth` should normally remain smaller
than its `width`.

## Interaction policy

The optional `interaction` object controls the renderer's built-in actions:

```ts
createWorkflowDAG(container, {
  snapshot,
  interaction: {
    expandOnNodeClick: false,
    pinTooltipOnNodeClick: false,
    highlightEdgeOnClick: false,
    panOnDrag: true,
    zoomOnCtrlWheel: true,
  },
  onNodeClick(node) {
    openInspector(node.path);
  },
});
```

| Option | Default | Built-in action |
| --- | --- | --- |
| `expandOnNodeClick` | `true` | Expand a collapsed nested workflow after node click |
| `tooltipOnHover` | `true` | Show and hide the node tooltip on pointer hover |
| `pinTooltipOnNodeClick` | `true` | Toggle a pinned tooltip on node click |
| `highlightEdgeOnClick` | `true` | Toggle route highlighting on edge click |
| `clearHighlightOnCanvasClick` | `true` | Clear route highlighting on canvas click |
| `keyboardNavigation` | `true` | Add graph keyboard navigation and shortcuts |
| `panOnDrag` | `true` | Allow pointer dragging to pan the viewport |
| `zoomOnCtrlWheel` | `true` | Allow Ctrl/pinch-style wheel zoom handled by the renderer |

Callbacks are observation points, not default-action switches. `onNodeClick`
and `onEdgeClick` still run when the corresponding built-in action is disabled.
The host can then call `toggle()`, `setExpanded()`, or other instance methods to
implement its own interaction.

`pinNodeTip` and `keyboardNavigation` are deprecated compatibility aliases.
When the same setting is present in `interaction`, the `interaction` value wins.

## Fixed renderer semantics

Customization does not change protocol or graph semantics. The renderer keeps
these rules fixed:

- graph-local Levels and duration-based Level 0 selection;
- `(Level, path length)` port ordering and port-side selection;
- orthogonal route construction and collision clearance;
- snapshot validation and execution status meaning;
- lifecycle cleanup, accessibility state, and public callback payloads.

The renderer passes `metadata` through callback and formatter data but never
reads it to select colors, sizes, layout, or behavior. A host that wants
metadata-driven presentation must explicitly translate its own data into theme
tokens or formatter output.

The optional `additionalStyles` field in `eino-workflow-dag/cytoscape` remains
an adapter escape hatch. It is intentionally outside the renderer-neutral
theme contract and may depend on Cytoscape selectors.
