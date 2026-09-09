# Compatibility and evolution

This document defines the compatibility promises in effect since `1.0.0`.
Every compatibility-affecting public change is recorded in the changelog before
release.

## Stable public surface

The root entry, `/validation`, `/react`, `/vue`, and `/styles.css` follow
Semantic Versioning. Within `1.x`, existing exported names, option meanings,
instance methods, callback payload fields, and adapter props or events are not
removed or repurposed. New optional capabilities may be added in a minor
release.

`createWorkflowDAG()` owns the renderer until `destroy()` is called. `destroy()`
is idempotent, and other instance mutations after destruction continue to
throw. Node identity in instance methods and callbacks is always a `NodePath`
array. `onExpandedChange` is emitted only when the effective expanded set
changes. Pointer and keyboard activation use the same `onNodeClick` payload.

React and Vue adapters preserve the core lifecycle and payloads. Their
framework-native refs, props, callbacks, and events are stable; rendering and
scheduling details owned by React or Vue are not observable contracts.

The `/cytoscape` entry is intentionally implementation-specific. Its exported
factory and accessor still follow Semantic Versioning, but Cytoscape objects,
selector data, classes, layout geometry, and engine behavior must be treated as
upstream implementation details. `getDiagnostics()` field names are stable,
while exact counter values are diagnostic rather than application state.

## Snapshot schema and errors

`EinoWorkflowSnapshot` schema version `1` permits additive, library-owned
optional fields in minor releases. Existing fields are not removed, renamed,
or repurposed, so older snapshots remain valid in newer renderers. A producer
using a newly added field must require the renderer version that introduced it.
Incompatible protocol changes require a new `schemaVersion`. Application data
belongs in `metadata`, so a renderer upgrade is not required for business
extensions.

`WorkflowSnapshotError.code`, `WorkflowDAGError.code`, and individual
`WorkflowSnapshotIssue.code` values are machine-readable contracts. Human
messages, issue order, stack traces, and underlying `cause` values are not.
Consumers should still include an unknown-code fallback so they can report
errors introduced by a future schema or package major.

## Component and status values

Eino component categories are open strings. Known values receive built-in
labels and visual treatment; unknown component values remain visible and use
the generic fallback. A node may instead declare the closed node-kind enum
`llm`, `io`, `cpu`, `branch`, `merge`, or `graph`; explicit kind wins over
component inference without changing the original component identity.

Node execution status is the closed final-outcome enum `success`, `failed`, or
`skipped`. A node without a final outcome is omitted from `execution.nodes`.
Adding another status requires a new snapshot schema version.

Applications can localize component kinds and the three statuses with
`locale.kinds` and `locale.statuses`, or customize rendered text with
`nodeLabelFormatter` and `tooltipFormatter`. Formatters receive renderer-owned
plain data, not mutable engine objects.

## Themes

`classic`, `ink`, and `midnight` are built-in theme IDs and cannot be replaced.
Custom themes registered with `registerWorkflowDAGTheme()` inherit omitted
tokens from `classic`. Registration returns an idempotent disposer for that
specific registration; an unknown selected theme falls back to `classic`.

Built-in token names and their value types remain compatible within `1.x`.
Exact colors, spacing, font fallback results, and pixel geometry may be refined
in minor or patch releases when the documented meaning remains intact.

## Deprecation and support changes

A stable JavaScript API scheduled for removal is documented as deprecated for
at least one minor release and is removed only in the next major. A stable
schema field is not removed from its schema version. Browser, Node.js,
framework-peer, Go, or Eino support ranges are changed according to their
published support documents and never narrowed in a patch release.

Security fixes, legal requirements, or behavior that risks data exposure may
require an immediate protective change. Such exceptions are called out in the
security advisory and changelog.
