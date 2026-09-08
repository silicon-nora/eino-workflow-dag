# Changelog

All notable changes are documented here. Prerelease APIs may change while the
public contract is being validated.

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
