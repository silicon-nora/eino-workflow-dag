# Changelog

All notable changes are documented here. Prerelease APIs may change while the
public contract is being validated.

## [Unreleased]

### Added

- Extended the independent RC host with live visual presets and interaction
  policy controls for the published customization contract.
- Added a Chromium RC-host suite covering paint and geometry theme boundaries,
  every interaction-policy remount, and representative configuration combinations.

## [1.0.0-rc.3] - 2026-09-08

### Added

- Defined a renderer-neutral visual and interaction customization contract,
  including instance theme overrides, validated geometry and tooltip tokens,
  and opt-out policies for built-in pointer, keyboard, pan, and zoom actions.

### Changed

- Theme changes now relayout only when node geometry or spacing changes; paint
  changes preserve the current layout and viewport.

### Fixed

- Excluded nested consumer dependency directories from repository sensitive-content
  scans while continuing to scan their source manifests and lockfiles.

## [1.0.0-rc.2] - 2026-09-08

### Added

- Added exact-Registry release-candidate validation that combines real Go Eino
  projection, clean framework consumers, three-browser geometry checks, and
  repeated update and lifecycle soak cycles in one retained report.

### Changed

- Bounded Registry installation retries so an unavailable network produces a
  failed validation report instead of an indefinitely waiting RC run.

### Fixed

- Canonicalized temporary consumer directories before invoking Vite so clean
  Registry builds work when macOS exposes `/var` through `/private/var`.
- Cleared stale node status and duration data when an incremental update omits
  execution state, preserving the schema rule that missing outcomes are unknown.

## [1.0.0-rc.1] - 2026-09-08

### Changed

- Started the `1.0.0` release-candidate line after completing the protocol,
  layout, lifecycle, package, framework, and browser release-blocker audit.

### Fixed

- Kept runtime validation issue codes synchronized with the public TypeScript
  union, including required node status and duration failures.
- Assigned every accepted acyclic graph component to a deterministic Level,
  even when only part of a disconnected graph declares explicit `start` or
  `end` relationships, preventing overlapping fallback positions.
- Made `expandAll()` reject use after `destroy()` consistently with every
  other mutating instance method.

### Added

- Added automatic runtime-to-TypeScript validation-code contract coverage,
  partial-boundary layout fixtures in all four directions, and a lifecycle
  check covering every mutating instance method after destruction.

## [0.4.0-beta.3] - 2026-09-08

### Changed

- Finalized node execution status as the closed `success`, `failed`, or
  `skipped` outcome enum. Execution records now require an explicit nullable
  duration, and nodes without a final outcome are omitted rather than exposed
  through non-final `pending`, `running`, or `degraded` presentation states.
- Added explicit skipped-node recording to the Go adapter; generic Eino
  callbacks continue to supply successful and failed outcomes.
- Made parallel Level branches advance from their direct predecessors using
  their own node widths. Expanded workflows no longer stretch shorter sibling
  branches, while joins still wait for the furthest incoming branch.

### Fixed

- Kept each graph-local Level on a deterministic side of Level 0 when nested
  workflows expand or collapse. Measured bounds may push a rail outward for
  clearance, but no longer make it jump across the Level 0 rail.

## [0.4.0-beta.2] - 2026-09-08

### Changed

- Changed default node labels to show the original Eino component and to omit
  timing when no node execution duration was supplied.
- Preserved an absent node duration in formatter, click, and visible-graph data
  instead of reporting it as zero.
- Replaced the dual path classification with graph-local numeric Levels. Each
  graph now starts at Level 0, assigns one global rail per Level, and exposes
  node and edge Levels through the public renderer data.
- Renamed visible-graph path summaries to `levelZeroPath` and
  `levelZeroDurationMs` and removed the redundant edge `main` flag.

### Added

- Exposed field mappings, edge metadata, and branch metadata in rendered-edge
  data, including edge-click callbacks.
- Added an interactive routing preview with multiple topology cases, including
  an anonymized production-scale nested workflow, and
  browser coverage across every supported layout direction.

### Fixed

- Kept every same-graph, same-Level node on one cross-axis rail, including
  expanded workflows whose content waist is aligned to a parent Level.
- Allowed higher-Level rails to expand on either side of Level 0, selecting the
  side from connected-rail distance and the occupied layout envelope.
- Aligned expanded-workflow boundary ports with the workflow's inner Level 0
  rail, keeping unobstructed same-Level connections straight without disabling
  obstacle detours.

## [0.4.0-beta.1] - 2026-09-08

### Changed

- Froze the schema-version-1 protocol and public package surface for beta
  compatibility validation.
- Extended every npm release with clean Registry consumer builds for the
  supported React and Vue peer ranges.

### Added

- Added a reusable published-package smoke workflow covering React 18, React
  19, Vue 3, ESM bundling, package CSS, TypeScript, and CommonJS loading.
- Added browser routing-invariant coverage for fan-in/fan-out graphs across
  topology updates, all four directions, and layout-cache round trips.

### Fixed

- Committed orthogonal edge styles before the layout completion event, so
  consumers and the layout cache never observe transient diagonal routes.
- Restored absolute route points and port assignments together with cached
  positions and styles.
- Preferred the workflow direction's primary input/output sides until those
  sides are actually occupied, instead of treating a reservation as use.

## [0.4.0-alpha.3] - 2026-09-08

### Changed

- Defined the library-owned `EinoWorkflowSnapshot` schema version 1 as the only
  public input protocol.
- Separated nested workflow topology from path-addressed execution state.
- Aligned workflow topology with Eino `compose.GraphInfo`: nodes expose
  `component`, control and data dependencies use explicit `channels`, branches
  are separate relationships, and data edges can carry field mappings.
- Kept execution state as an optional section of the same snapshot while
  removing renderer-only highlighted-path and inactive-edge inputs.
- Renamed inactive-edge theme tokens to secondary-route tokens so presentation
  terminology no longer implies an execution state.
- Replaced ambiguous local/global string IDs in the public API with `NodePath`
  arrays.
- Replaced the mount aliases with the single `createWorkflowDAG()` entry and
  renamed instance updates to `update()`.
- Moved Cytoscape access and selector styles to `eino-workflow-dag/cytoscape`.
- Removed model, layout, and layout-worker implementation entries from package
  exports.
- Changed the CommonJS `main` entry from the self-contained UMD bundle to the
  regular CommonJS build.

### Added

- Added a deterministic Go projection from Eino `compose.GraphInfo` and a
  shared cross-language fixture generated from a compiled Eino Workflow.
- Added a Go Eino callback recorder that projects nested node paths, timing,
  success, and failure into the snapshot execution section.
- Added CI coverage and a documented compatibility range for Eino 0.9.x.
- Added Chromium, Firefox, and WebKit browser gates plus keyboard node
  announcements for assistive technology.
- Added the versioned API, schema, extension, theme, and deprecation policy.
- Added strict `parseWorkflowSnapshot()` and `validateWorkflowSnapshot()` APIs
  with stable issue codes and `WorkflowSnapshotError`.
- Added typed `WorkflowDAGError` values for recoverable renderer failures.
- Added structured timing rules, metadata boundaries, and Eino-aligned
  `start`/`end` endpoints.
