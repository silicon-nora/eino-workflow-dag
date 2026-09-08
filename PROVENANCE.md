# Release authorization

This file records the release review for `eino-workflow-dag`. The approval
applies to the source, tests, documentation, examples, and package metadata in
this repository at the approved revision.

## First-party work

The package protocol, public APIs, model, layout and routing engines, browser
renderer, framework wrappers, accessibility support, localization, Worker
protocol, exports, tests, examples, and documentation are maintained as one
independent open-source library. The approving party confirms that the
first-party material may be published under Apache-2.0.

## Third-party code

The self-contained UMD build bundles Cytoscape.js under the MIT License. Its
license text is reproduced in `THIRD_PARTY_NOTICES.md`.

No ELK or Dagre runtime is included in the package. The layout and orthogonal
routing implementation is covered by the first-party authorization above.

The automated public-asset inventory contained no binary or visual assets on
2026-09-06. Future additions are rejected unless `PUBLIC_ASSETS.json` records
their source, license, reviewer, review date, and SHA-256. This does not review
data embedded in source or documentation and does not complete the human
authorization item below.

## Release authorization checklist

- [x] Confirm that all code and documentation present in this repository may
  be publicly released under Apache-2.0
- [x] Confirm that authorization covers all contributor work present in this
  repository
- [x] Review visual assets, fixtures, and example data for confidential or
  third-party material
- [x] Include the bundled Cytoscape.js MIT notice
- [x] Verify npm package ownership and current published metadata immediately
  before publishing
- [x] Record the approving party and approval date in the release record

Do not remove this gate merely because the package passes technical checks.

## Release approval record

Use an organization, team, or role name when a person's name should not be
published. Do not include confidential ticket or document contents here.

Approval scope: The code, tests, documentation, examples, and package metadata
present in `eino-workflow-dag` at the approved revision.
Approving party: Nora (silicon-nora)
Approval date: 2026-09-08
