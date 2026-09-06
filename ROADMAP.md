# Roadmap

This roadmap records the completed extraction milestones and the remaining
path to a first public release. It is directional rather than a promise of
release dates.

## Current target — 0.4.0-alpha.2

This iteration hardens the architecture before beta. The product remains an
Eino-specific, read-only, embeddable DAG renderer; it is not expanding into a
generic graph protocol, workflow editor, execution engine, or debugger.

- [x] Make DAG Snapshot v2 the only browser input protocol
- [x] Remove the public GraphInfo projection and lifecycle-event alias inputs
- [x] Validate the same strict contract in `mount()` and `setData()`
- [x] Document support for Eino Workflow and DAG-mode Graph, while rejecting
  cyclic Pregel Graph output
- [x] Make producer `critical_path` authoritative when present and compute a
  fallback only when it is omitted
- [x] Narrow the root entry to renderer, theme, and validation APIs
- [x] Separate topology definition and runtime state during internal
  normalization without introducing another public protocol
- [x] Introduce an internal layout-engine boundary while retaining the current
  lightweight engine as the default
- [x] Keep advanced model, layout, validation, and experimental worker entry
  points isolated from the stable root API
- [x] Reduce the exact npm tarball to 350 KiB or less while retaining ESM,
  CommonJS, UMD, declarations, contract, and license records; source remains
  inspectable in the open repository
- [x] Complete unit, type, browser, package, reproducibility, and both consumer
  rehearsals against the exact `0.4.0-alpha.2` artifact
  - The disposable `suggest-platform` migration uses the package's public
    mount, update, direction, and node-event APIs; its focused trace tests and
    production Vite build pass with no new type diagnostics over the baseline
  - The disposable `cloud-focus` static host passes a real Chrome smoke test
    with only the exact package UMD/CSS and its thin application adapter
  - A migrated copy of the Go producer passes its DAG tests, and its actual
    flat and nested JSON output passes the library's strict snapshot checker
  - The real migration branches must still change `version: number` to the
    literal `2`, make flat producers emit v2, and serialize empty edge slices
    as `[]` rather than `null`
- [ ] Confirm code provenance, naming, and open-source release authority
- [ ] Add final GitHub metadata, run the official-registry audit, and publish
  under the npm `next` dist-tag after authorization

## Handoff order

The next owner should finish authorization and publish this alpha before
changing either consumer:

1. Obtain the source-release and npm/GitHub approvals recorded in
   `PROVENANCE.md`.
2. Create the public GitHub repository, fill in the final package metadata, and
   rerun every release gate against the resulting artifact.
3. Publish `0.4.0-alpha.2` under npm's `next` dist-tag, never `latest`.
4. Migrate `suggest-platform` and `cloud-focus` to that exact registry version,
   applying the v2 producer changes identified by the rehearsals.
5. Promote to `0.4.0-beta.1` only after both real consumer branches pass their
   own CI and visual review without a copied renderer.

The disposable rehearsals establish feasibility but do not authorize or
replace real consumer changes. Beta requires the rehearsed migration to land in
both applications.

## Product principles

1. Keep workflow data portable and JSON-safe.
2. Keep business behavior in host applications.
3. Preserve readable nested layouts before optimizing for raw graph size.
4. Avoid framework lock-in; integrations belong in adapters and wrappers.
5. Make full snapshot updates stable enough for polling; defer a public event
   protocol until transport ordering and identity semantics are designed.
6. Measure layout correctness and performance before changing algorithms.

## 0.1 — Foundation

Goal: establish an installable package and validate the extracted behavior.

- [x] Extract the shared model, layout, renderer, and styles
- [x] Add ESM and UMD builds
- [x] Add TypeScript declarations
- [x] Add an Eino `GraphInfo` projection adapter
- [x] Enforce the adapter's JSON-safe output boundary for GraphInfo, traces,
  costs, and incremental event metrics
- [x] Add unit tests and a real-browser smoke test
- [x] Document installation, data contract, API, and architecture
- [x] Add `setData()` for live workflow replacement
- [x] Add strict, opt-in DAG validation
- [x] Enforce JSON-safe values across metrics and extension fields, not only
  nested graph structure
- [x] Validate documented known-field types and protocol versions without
  invoking accessors at the untrusted-data boundary
- [x] Bound strict-validation traversal by unique objects for deeply shared,
  acyclic payload structures
- [x] Make JSON and nested-graph validation iterative so deep untrusted input
  cannot overflow the JavaScript call stack
- [x] Exercise one packed artifact locally against both original applications
  (the static UMD host and the Vue 3 host)
- [x] Add a repeatable, non-mutating consumer-to-`DAGData` type compatibility
  check for integration rehearsals
- [x] Add a reproducible tarball contract gate for exports, files, size, and
  integrity metadata
- [x] Execute the exact packed UMD and stylesheet in the browser test suite
- [x] Type-check and bundle ESM, Vue, React, CSS, data-only, and CommonJS
  consumers from the exact packed artifact
- [x] Add guarded GitHub Release automation with release identity checks,
  prerelease dist-tags, npm provenance, and an OIDC migration path
- [x] Verify every JavaScript package entry under modern ESM, CommonJS, and
  bundler resolution with synchronized declarations
- [x] Enforce an auditable production-license inventory and third-party notice
  contract
- [x] Exercise the complete package gate across the supported Node 20, 22, and
  24 release lines in CI
- [x] Add structured issue and pull-request intake, support boundaries, and a
  project code of conduct
- [x] Pin third-party GitHub Actions to reviewed commit SHAs
- [x] Enforce public API export parity across ESM, CommonJS, and UMD builds
- [x] Freeze a machine-readable public export manifest and reject accidental
  API surface drift
- [x] Freeze each typed subpath's declaration content and reject unreviewed
  TypeScript API drift
- [x] Scan public source files for common credential signatures before packing
- [x] Inventory public binary and visual assets by provenance, license, review
  metadata, and content hash before packing
- [x] Reject broken relative links in the exact npm package documentation
- [x] Reject GitHub releases whose prerelease state or changelog date disagrees
  with the package version
- [x] Publish the exact verified tarball and record its integrity metadata in
  the release job summary
- [x] Revalidate the final release tarball's bytes, archive paths, complete file
  report, exported targets, and all package-level audits before publication
- [x] Reject non-reproducible distribution builds with per-file SHA-256 checks
- [x] Make provenance approval and final public repository metadata executable
  release gates rather than documentation-only checks

## 0.2 — Maintainability and integration

Goal: make routine changes safe and remove legacy extraction boundaries.

- [x] Extract reusable, animation-frame-throttled subgraph overlays
- [x] Extract tooltip state and its testable plain-text formatter
- [x] Extract Cytoscape pointer interactions and delayed expansion lifecycle
- [x] Extract viewport, pan, zoom, wheel, and responsive resize lifecycle
- [x] Extract edge highlight, draw order, and skipped-state presentation
- [x] Extract direction and axis-profile primitives from the legacy renderer
- [x] Extract the Cytoscape layout adapter and combined port/routing engine
- [x] Extract renderer lifecycle from the public API assembly
- [x] Separate port selection from orthogonal route computation
- [x] Replace legacy `elk*` internal terminology with domain-specific names
  (the legacy IIFE boundary has also been removed)
- [x] Add node and edge event callbacks without requiring direct Cytoscape access
- [x] Add controlled active-node highlighting without remounting or relayout
- [x] Add a tooltip formatter
- [x] Add a node label formatter
- [x] Preserve Eino `GraphInfo.Branches` in the JSON-safe graph projection
- [x] Add runtime direction changes without remounting
- [x] Add `ResizeObserver`-based responsive resizing
- [x] Add a first-party JavaScript browser test runner to CI
- [x] Add browser-level visual geometry checks across all four directions
- [x] Document migration for existing embedded copies
- [x] Publish original module sources while omitting generated source maps
- [x] Reject published `.map` files and stale `sourceMappingURL` comments

## 0.3 — Efficient runtime traces

Goal: support long-running and frequently updated Eino executions.

- [x] Patch Cytoscape data when visible topology is unchanged
- [x] Diff Cytoscape elements when visible topology changes
- [x] Skip layout when only runtime status or metrics changed
- [x] Cache layout positions and orthogonal routes by graph topology
- [x] Define an incremental trace update helper for Eino events
- [x] Preserve highlights, expansion, and viewport across updates
- [x] Add cancellation and stale-update protection for overlapping layouts

Target baseline: smooth status updates for a 100-node visible graph on a
typical developer laptop. The exact frame and latency budgets will be fixed
after benchmark fixtures exist.

## 0.4 — Extensibility and scale

Goal: support broader applications without putting their business logic in the
core renderer.

- [x] Theme token extension points
- [x] Node-style extension points through appended Cytoscape selector rules
- [x] Custom node kinds and status presentation through locale and style hooks
- [x] Optional React 18/19 wrapper with StrictMode-safe lifecycle
- [x] First-party Vue 3 wrapper with incremental prop updates
- [x] Keep Vue and React refs aligned with the core non-lifecycle instance API
- [x] Add repeatable layout benchmarks for 10, 100, and 500 visible nodes
- [x] Define and enforce performance budgets for portable layout fixtures
- [x] Add deterministic nested-DAG stress coverage across all four directions
- [x] Optional off-main-thread layout protocol with explicit Worker lifecycle
- [x] Non-blocking PNG and JPEG image snapshots
- [x] Dependency-free SVG snapshots with route and theme preservation
- [x] Keyboard navigation with node activation and visible focus state
- [x] Accessible graph summaries with host override hooks
- [x] Locale hooks for built-in node, status, tooltip, and overlay labels

## Future 1.0 — Stability

`1.0.0` requires:

- the same released package running in at least two independent applications;
- a documented and versioned DAG contract;
- stable mount, update, event, theme, and lifecycle APIs;
- automated unit, type, browser, visual, and performance checks;
- documented browser support and upgrade policy;
- no known high-severity accessibility or security issues;
- a migration guide for every breaking pre-release API change.

## Explicit non-goals

- Workflow editing or authoring
- Backend workflow execution
- Application-specific permissions, navigation, or data fetching
- Persisting traces or graph state
- Replacing Eino's runtime, debugger, or development tools
