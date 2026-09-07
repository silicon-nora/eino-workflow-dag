# Changelog

All notable changes will be documented in this file. The project follows
semantic versioning after `1.0.0`; pre-release compatibility is described in
`RELEASING.md`.

## [0.4.0-alpha.2] - 2026-09-07

### Changed

- DAG Snapshot v2 is now the only browser input. The public GraphInfo
  projection and lifecycle-event alias helpers were removed; Eino producers
  emit the canonical snapshot directly and update it through `setData()`.
- `mount()` and `setData()` now enforce the same strict validation contract,
  including required edge arrays and rejection of cyclic graphs.
- Producer `critical_path` is authoritative when present and is validated for
  unique, connected same-layer nodes; topology/cost calculation is the fallback
  only when producers omit it.
- The root entry is limited to renderer, theme registration, and validation;
  advanced model and layout APIs remain on explicit subpaths.
- Duplicate original JavaScript is omitted from the npm artifact because the
  open repository is the canonical source. Runtime builds, declarations,
  contract, provenance, and license records remain packaged.
- Internal snapshot normalization now separates structural definition from
  runtime state, allowing safe status-only patches while relayouting changes
  that affect critical-path selection or geometry.
- The Cytoscape adapter now depends on an internal layout-engine boundary; the
  existing lightweight layered engine remains the default and only shipped
  implementation.

### Added

- A repository-level `validate:snapshot` command checks JSON files or stdin
  with the exact runtime DAG Snapshot v2 validator, enabling cross-language
  producer contract rehearsals before browser integration.
- Release and migration documentation now records the handoff order: authorize
  and publish the alpha under `next`, migrate both consumers to that exact
  version, then promote to beta only after their CI and visual review pass.
- Package metadata now points to the public
  `silicon-nora/eino-workflow-dag` repository. A short-lived token is limited
  to bootstrapping the first release; later releases use GitHub OIDC trusted
  publishing without retaining an npm publish token.

## [0.4.0-alpha.1] - Unreleased

This first public candidate incorporates the completed 0.1 foundation, 0.2
maintainability, 0.3 runtime-trace, and 0.4 extensibility milestones. The
version is aligned with delivered scope before publication; no earlier package
version has been released.

### Changed

- The public input boundary now accepts only explicit DAG v2 roots. Version 1,
  versionless roots, and the legacy node `key` input alias are rejected; the
  Eino adapter remains a projection into DAG v2 rather than a second protocol.
- Generated source maps are no longer published. Original JavaScript sources,
  ESM, CommonJS, and UMD remain available, with an enforced 400 KiB maximum for
  the exact npm tarball.

### Added

- A guarded `release:dry-run:next` command, release identity validation, a
  protected GitHub Release workflow with npm provenance/OIDC migration, an
  explicit dist-tag policy, and package-contract checks that remain effective
  inside an npm publish dry run.
- Matched ESM and CommonJS runtime/type entries for every public JavaScript
  subpath, enforced by generated declaration checks, publint, and package-level
  TypeScript resolution audits.
- Explicit React wrapper sizing styles and a production example that loads the
  extracted package CSS, so Cytoscape always receives a non-zero canvas height
  in concurrent StrictMode browser tests.
- An automated production-license inventory that rejects unreviewed SPDX
  licenses and stale third-party notices before publication.
- A Node.js 20/22/24 CI matrix, with the Chromium suite gated on successful
  package validation across all supported release lines.
- Structured bug/feature/PR intake, support and conduct policies, and
  commit-pinned GitHub Actions for safer public collaboration.
- A distribution gate that rejects export drift between ESM, CommonJS, and
  the self-contained UMD build.
- A published `API_SURFACE.json` manifest that makes every JavaScript export
  addition or removal an explicit, reviewable change.
- A release-time credential-signature scan and an explicit authorization check
  for source-repository identifiers in the provenance record.
- Release automation checks for a finalized, valid changelog date and exact
  agreement between semver prerelease state and the GitHub Release setting.
- Release automation records and publishes one immutable tarball instead of
  rebuilding between verification and upload.
- A reproducible-build gate that hashes every distribution file, rebuilds, and
  rejects any path or content drift.
- An executable release-readiness gate that blocks publication until source
  authority, approving party/date, and final GitHub metadata are complete.
- Idempotent renderer teardown that rejects post-destroy mutations instead of
  silently remounting Cytoscape and leaking browser resources.
- Prototype-safe graph indexes so JSON-provided node IDs, statuses, locale
  keys, and custom theme IDs such as `__proto__` cannot corrupt lookup state.
- Deterministic randomized stress coverage for nested graphs, unusual IDs,
  forward-edge variants, sibling overlap, and all four layout directions.
- Sensitive-content scanning of the unpacked npm tarball, with generated
  source-map exclusion and leaked-local-path checks before publication.
- Vue wrapper parity for layout-cache configuration, typed events and
  imperative methods, and consistent `error` events from every reactive
  renderer update.
- A core `onError` hook, forwarded by both framework wrappers, for observable
  layout fallback without unconditional production-console noise.
- Host-scoped overlay, tooltip, and zoom styles plus symmetric DOM/theme
  cleanup, preventing class-name collisions and mount residue in consumers.
- CI browser and declaration coverage for the minimum supported React 18.2,
  React DOM 18.2, and Vue 3.4 peer versions on Node.js 20.
- A tested consumer-type compatibility checker that proves an application's
  declared DAG payload remains structurally assignable to the public contract.
- Tolerant rendering of missing or `null` runtime edge lists, while strict DAG
  validation continues to require arrays for persisted contract data.
- Integration evidence now distinguishes reproducible library compatibility
  checks from unrelated consumer-worktree baseline failures.
- Browser execution of the exact packed UMD and stylesheet, covering static
  delivery independently from direct worktree `dist` tests.
- Node event payloads now preserve the graph-local `key` alongside the unique
  path-qualified render `id`, eliminating fragile consumer-side path parsing.
- Vue and React refs now forward the complete non-lifecycle instance API,
  including expansion queries, zoom, resize, subgraphs, and diagnostics.
- The built-in themes now give `degraded` nodes a distinct warning treatment,
  with customizable `warning` and `warnBg` color tokens.
- An exact-tarball consumer gate now type-checks and bundles ESM, Vue, React,
  CSS, and data-only imports and loads every JavaScript entry through CommonJS.
- Accessible summaries now announce `degraded` and custom statuses and use
  grammatically correct node, edge, and subgraph counts.
- Strict validation now rejects non-string node IDs, nested graphs attached to
  non-graph nodes, and unsupported versions declared inside nested graphs.
- Expansion updates are now idempotent, preventing equivalent controlled props
  or routine data polling from causing relayouts and false change callbacks.
- Locale updates are idempotent after resolving built-in defaults, avoiding
  redundant wrapper renders when only a locale object's identity changes.
- Controlled active-node highlighting now accepts path-qualified render IDs or
  unique visible graph-local keys, survives data/expansion updates, and is
  forwarded by the Vue and React wrappers without triggering layout.
- A disposable exact-package migration rehearsal now covers the real Vue
  consumer's production bundle and records its baseline-relative type and
  route-size evidence without modifying the consumer repository.
- The real static host shape now has a headless-browser UMD migration rehearsal
  covering asset loading, controls, same-instance updates, and teardown; the
  package assets are about 73% smaller gzip than the five replaced runtimes.
- Source provenance now records full, locally verified commit object IDs for
  both extraction origins while keeping legal release authority explicitly
  pending.
- A public-asset inventory gate now rejects undeclared binary, visual, font,
  archive, document, database, and executable files in both the repository and
  exact npm tarball, with reviewed files pinned by provenance and SHA-256.
- The Eino adapter now projects `GraphInfo.Branches` from JSON-safe `EndNodes`
  arrays or maps and preserves combined control, data, and branch edge
  semantics.
- A checked-in TypeScript surface manifest now pins the declarations behind all
  eight typed package subpaths and rejects unreviewed structural API drift.
- Strict DAG validation now rejects non-JSON values, non-finite numbers, class
  instances, sparse arrays, and cycles inside metrics or extension fields while
  continuing to allow shared acyclic objects.
- The package contract now checks relative links after unpacking the exact npm
  tarball and no longer advertises a repository-only example as a packaged file.
- Original JavaScript sources are shipped once, while the package gate rejects
  generated maps and stale mapping comments.
- Local package checks and release artifact creation now share one exact-tarball
  contract that recomputes byte size and hashes, validates archive and file
  reports, and runs every package-level audit against the artifact being
  published.
- Strict validation now checks documented field types, rejects unsupported
  versions, and never invokes getters
  on known fields or array elements.
- Strict validation now memoizes completed JSON values and graph contexts, so
  valid diamond-shaped shared structures cannot trigger exponential traversal.
- The Eino adapter now rejects cyclic or accessor-backed projections,
  non-finite converted costs, and unsafe metrics before they can enter a DAG;
  incremental events validate only the metrics value they write.
- JSON-safe and nested-graph validation now use explicit work stacks, avoiding
  call-stack overflow on deeply nested untrusted payloads.

- Framework-agnostic nested DAG renderer with ESM and self-contained UMD builds
- Eino `GraphInfo` and incremental callback-event adapters
- Runtime data patching, topology reconciliation, and topology layout cache
- Node/edge events, themes, localization, keyboard navigation, and image export
- Optional Vue 3 component with incremental prop updates
- DAG v2 validation, contract documentation, benchmarks, and browser tests
- Native ESM boundaries for the renderer, Cytoscape layout adapter, and
  orthogonal port/routing engine
- Renderer lifecycle and theme modules, with obsolete ELK-shaped internal
  configuration removed
- Browser-level visual geometry checks for node overlap, routed endpoints,
  nested overlays, and all four layout directions
- A narrowed renderer object that exposes only documented public methods;
  routing primitives remain internal modules
- Runtime locale updates through `setLocale()` and reactive Vue locale props
- Automated dependency updates and an official-registry production audit gate
- A pure port-planning policy module, separated from orthogonal route geometry
- A reproducible packed-tarball contract gate with isolated npm cache and
  published-file allowlist checks
- Official npm registry lockfile URLs and a CI workflow that exercises the
  same prepublish gate used by maintainers
- An optional module-worker protocol for portable off-main-thread layout, with
  cancellation, lifecycle cleanup, declarations, and browser coverage
- A first-party React 18/19 wrapper with incremental props, ref methods,
  StrictMode-safe cleanup, declarations, and browser coverage
- Dependency-free SVG snapshots generated from final node geometry,
  orthogonal routes, labels, and active Cytoscape styles
- Automated WCAG A/AA scans for the plain, Vue, and React host examples
