# Browser Support

## Supported environments

The automated browser suite runs against Chromium and covers the plain UMD
build, Vue 3 ESM wrapper, React StrictMode wrapper, and module-worker layout.
The `1.x` support target is the latest two stable releases of Chrome and Edge.
CI runs that suite once with the lockfile framework versions and once with the
minimum declared peers: React 18.2, React DOM 18.2, and Vue 3.4.

Firefox and Safari are currently best-effort during the pre-release series.
They become supported only after their Playwright projects are enabled in CI
and the same interaction suite passes without browser-specific exceptions.

Build tools and data-only imports require Node.js 20 or newer. Renderer entry
points require a browser DOM; `/model`, `/layout`, `/layout-worker`, and
`/validation` can be imported without a DOM.

Release gates run on the latest available Node.js 20, 22, and 24 patch
releases. Chromium browser tests run on Node.js 24 with the lockfile peers and
on Node.js 20 with the minimum framework peers after the package matrix passes.

All JavaScript package entries support modern ESM and CommonJS resolution.
Legacy TypeScript `moduleResolution: "node"`/Node10-style subpath resolution is
outside the support contract; use `node16`, `nodenext`, or `bundler`.

## Required browser features

- ES modules for the ESM build, or script support for the UMD build
- Canvas 2D
- `ResizeObserver` for automatic resizing
- `Promise`, `Map`, `Set`, and `requestAnimationFrame`
- `Blob` and `URL.createObjectURL()` for PNG, JPEG, and SVG export workflows
- Module Workers when the optional `/layout-worker` protocol is used

No compatibility polyfills are bundled.

## Content security and images

The project does not fetch graph data or execute node content. Labels and
tooltips are assigned with text APIs rather than HTML injection. Cytoscape is a
runtime dependency, so strict Content Security Policy deployments should test
the selected Cytoscape build as part of their application policy.

Image export uses the browser canvas. Consumer-provided cross-origin node images
can taint that canvas unless the image server and browser request use compatible
CORS settings.

## Support policy

Browser regressions should include the browser/version, a minimal DAG payload,
the package version, and whether the ESM or UMD entry was used. A browser is not
removed from the supported set in a patch release.
