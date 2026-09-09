# Browser Support

## Supported environments

The automated browser suite runs against Chromium, Firefox, and WebKit. It
covers the plain UMD build, Vue 3 ESM wrapper, React StrictMode wrapper,
packed-package delivery, keyboard behavior, accessibility rules, and visual
geometry invariants. The `1.x` support target is the latest two stable releases
of Chrome, Edge, Firefox, and Safari. CI runs Chromium once more with the
minimum declared peers: React 18.2, React DOM 18.2, and Vue 3.4.

The classic-script build is published as `dist/eino-workflow-dag.umd.js` and
exposes `window.EinoWorkflowDAG`. The package's `unpkg` and `jsdelivr` fields
both select that file.

Build tools and data-only imports require Node.js 20 or newer. Renderer entry
points require a browser DOM; `/validation` can be imported without a DOM.

Release gates run on the latest available Node.js 20, 22, and 24 patch
releases. The three-browser suite runs on Node.js 24 with the lockfile peers;
Chromium also runs on Node.js 20 with the minimum framework peers after the
package matrix passes.

All JavaScript package entries support modern ESM and CommonJS resolution.
Legacy TypeScript `moduleResolution: "node"`/Node10-style subpath resolution is
outside the support contract; use `node16`, `nodenext`, or `bundler`.

## Required browser features

- ES modules for the ESM build, or script support for the UMD build
- Canvas 2D
- `ResizeObserver` for automatic resizing
- `Promise`, `Map`, `Set`, and `requestAnimationFrame`
- `Blob` and `URL.createObjectURL()` for PNG, JPEG, and SVG export workflows

No compatibility polyfills are bundled.

## Keyboard and assistive technology

The renderer host is one focusable composite group. Its accessible name
summarizes the visible node, edge, status, and subgraph counts. Arrow keys,
Home, and End move the visual node focus; the accessible name then announces
the focused node's name, component, and status. Enter or Space activates that
node through the same callback as a pointer, and Escape clears node focus and
restores the graph summary.

Expanded-subgraph title buttons remain operable descendants of the group.
Individual canvas nodes are not DOM controls and are not exposed as a virtual
list. Applications that need editable nodes, per-node form controls, or a full
tabular workflow representation should provide those controls alongside the
read-only group. Automated WCAG A/AA checks cannot certify every
browser-and-screen-reader combination, so reproducible assistive-technology
defects remain supported browser defects.

## Content security and images

The project does not fetch graph data or execute node content. Labels and
tooltips are assigned with text APIs rather than HTML injection. Cytoscape is a
runtime dependency, so strict Content Security Policy deployments should test
the selected Cytoscape build as part of their application policy.

Image export uses the browser canvas. Consumer-provided cross-origin node images
can taint that canvas unless the image server and browser request use compatible
CORS settings.

## Support policy

Browser regressions should include the browser/version, a minimal workflow snapshot,
the package version, and whether the ESM or UMD entry was used. A browser is not
removed from the supported set in a patch release.
