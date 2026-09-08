# Roadmap to 1.0

The `1.0.0` target is a small, read-only, Eino-specific workflow renderer with
one portable snapshot protocol. Version 1 does not execute or edit workflows,
provide a general graph editor, or support non-Eino producer protocols.

External application adoption is useful feedback but is not a release gate.
Repository tests built with the real Go Eino module are the reproducible
integration gate: they compile and execute representative workflows, project
their topology and execution state, and validate the resulting JSON with the
JavaScript contract.

## 1.0 acceptance target

### Protocol and Eino interoperability

- [x] Keep `EinoWorkflowSnapshot` schema version 1 as the only input protocol
- [x] Keep workflow topology, execution state, and application metadata semantically separate
- [x] Represent nested graphs, control/data dependencies, branches, and field mappings
- [x] Use path arrays for nested node identity and JSON-safe metadata boundaries
- [x] Project topology from a compiled Go Eino Workflow into a shared JavaScript fixture
- [x] Collect execution state from real Eino callbacks into the same snapshot contract
- [x] Test Eino `>=0.9.0 <0.10.0` and publish the exact compatibility policy
- [x] Freeze schema terminology and validation issue-code semantics

### Public library surface

- [x] Expose one framework-independent `createWorkflowDAG()` lifecycle
- [x] Keep React and Vue as optional adapters with equivalent behavior
- [x] Keep rendering-engine access in the explicit `/cytoscape` adapter
- [x] Keep internal model, layout, routing, and worker APIs out of package exports
- [x] Freeze instance lifecycle, callback payloads, and adapter stability promises

### Portability and quality

- [x] Ship and test ESM, CommonJS, UMD, CSS, React, Vue, validation, and Cytoscape entries
- [x] Enforce deterministic builds, strict types, package consumers, and license checks
- [x] Enforce measured 100- and 500-node layout budgets
- [x] Keep the exact npm tarball below 350 KiB
- [x] Run the interaction and accessibility suite in Chromium, Firefox, and WebKit
- [x] Complete keyboard behavior and screen-reader review without critical issues

### Release and maintenance

- [x] Publish support, security, contribution, provenance, and release procedures
- [x] Publish compatibility, deprecation, component/status, and theme policies
- [x] Verify React 18/19 and Vue 3 from clean installations of the published package
- [ ] Publish a release candidate and resolve every release-blocking defect
- [ ] Publish `1.0.0` under npm's `latest` dist-tag

## Current milestone — 0.4.0-beta.3

- [x] Use execution duration when assigning graph-local Levels
- [x] Keep branch geometry stable across nested-workflow expansion
- [x] Finalize node execution as `success`, `failed`, or `skipped` outcomes
- [x] Treat missing execution records as unknown instead of inventing a state
- [x] Publish beta.3 under npm's `next` dist-tag
- [ ] Resolve every defect classified as release-blocking
- [ ] Publish the first release candidate

## Alpha.3 — public boundary

- [x] Define one library-owned `EinoWorkflowSnapshot` schema
- [x] Start the first public schema at `schemaVersion: 1`
- [x] Separate workflow topology from execution state inside the snapshot
- [x] Use explicit node-path arrays for expansion, selection, and callbacks
- [x] Map Eino control edges, data edges, branches, and field mappings
- [x] Align virtual endpoint values with Eino's `start` and `end`
- [x] Replace ambiguous mount aliases with `createWorkflowDAG()`
- [x] Move Cytoscape access and selector styles to a dedicated adapter
- [x] Remove model, layout, and worker internals from package exports
- [x] Provide typed parsing, validation issues, and renderer errors
- [x] Publish a reference Go projection from Eino `GraphInfo`
- [x] Add a cross-language fixture shared by the Go producer and JavaScript validator
- [x] Validate nested branches and field mappings from a compiled Eino Workflow
- [x] Set measured performance budgets for 100- and 500-node visible graphs
- [x] Replace external-project integration as a gate with real in-repository Eino tests
- [x] Publish the alpha under npm's `next` dist-tag

## Next implementation order

1. Review beta.3 compatibility results and resolve release-blocking defects.
2. Publish `0.4.0-rc.1` under npm's `next` dist-tag.
3. Promote the validated stable version to `latest`.

Off-main-thread layout is deferred from `1.0.0`. It may return later as an
optional adapter if measured browser workloads justify the added API and bundle
surface.

## Product principles

1. Represent Eino workflows, not arbitrary graph applications.
2. Keep one portable, JSON-safe snapshot protocol.
3. Keep topology, execution state, and renderer implementation boundaries clear.
4. Prefer explicit identity and semantics over convenient string conventions.
5. Keep framework and rendering-engine integrations outside the stable core.
6. Measure layout behavior before adding scale-oriented complexity.
