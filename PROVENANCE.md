# Source provenance

This file records the release boundary for `eino-workflow-dag`. It is an
engineering inventory, not a grant of copyright permission. The first public
release remains blocked until the relevant owner confirms that the material in
this repository may be released under Apache-2.0.

## Project boundary

`eino-workflow-dag` is an independent open-source library. The applications
that motivated its extraction are separate products and are not part of this
repository, are not relicensed by this project, and are not covered by this
project's Apache-2.0 license.

Some initial DAG behavior was consolidated from implementations maintained in
those separate applications. Only the code and documentation that now exist in
this repository are candidates for public release. Authorization of this
library does not authorize publication of either application repository or of
any unrelated application code, configuration, data, or history.

## Work authored in this repository

The package boundary, adapters, validation, incremental runtime updates,
framework wrappers, accessibility support, localization, layout cache, Worker
protocol, SVG export, benchmarks, browser tests, documentation, and subsequent
module extraction were developed in this repository as part of the open-source
preparation. This statement still requires confirmation by the person or
organization that owns work created during that preparation.

## Third-party code

The self-contained UMD build bundles Cytoscape.js under the MIT License. Its
license text is reproduced in `THIRD_PARTY_NOTICES.md`.

No ELK or Dagre runtime is included in the package. The layout and orthogonal
routing implementation is part of this repository's source inventory and must
be covered by the first-party authorization above.

The automated public-asset inventory contained no binary or visual assets on
2026-09-06. Future additions are rejected unless `PUBLIC_ASSETS.json` records
their source, license, reviewer, review date, and SHA-256. This does not review
data embedded in source or documentation and does not complete the human
authorization item below.

## Release authorization checklist

- [x] Confirm that all code and documentation present in this repository may
  be publicly released under Apache-2.0
- [x] Confirm that permission covers any code adapted from separate application
  repositories without relicensing those applications
- [x] Confirm that authorization covers all contributor work present in this
  repository
- [x] Review visual assets, fixtures, and example data for confidential or
  third-party material
- [x] Include the bundled Cytoscape.js MIT notice
- [x] Verify that the exact npm name was unregistered on 2026-09-05; repeat
  immediately before publishing because a lookup does not reserve the name
- [x] Record the approving party and approval date in the release record

Do not remove this gate merely because the package passes technical checks.

## Release approval record

Use an organization, team, or role name when a person's name should not be
published. Do not include confidential ticket or document contents here.

Approval scope: Only the code, tests, and documentation in `eino-workflow-dag`;
this approval does not apply to or change the ownership or licensing of the
separate applications that motivated the library.
Approving party: Nora (silicon-nora)
Approval date: 2026-09-07
