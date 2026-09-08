# Changelog

All notable changes are documented here. Prerelease APIs may change while the
public contract is being validated.

## [Unreleased]

### Changed

- Made parallel Level branches advance from their direct predecessors using
  their own node widths. Expanded workflows no longer stretch shorter sibling
  branches, while joins still wait for the furthest incoming branch.

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
