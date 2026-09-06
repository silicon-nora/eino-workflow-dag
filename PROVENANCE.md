# Source provenance

This file records the known origin of code extracted into
`eino-workflow-dag`. It is an engineering inventory, not a grant of copyright
permission. The first public release remains blocked until the relevant owner
confirms that the listed material may be released under Apache-2.0.

## First-party source history

The initial model, layout, renderer, styles, and related tests were derived
from two application repositories:

- `suggest-platform/web/admin-web/src/trace/focus-dag/`, initially integrated
  in revision `a9656bfda961b33de4d2e3a5bbd6fc8ae288cc9c` and subsequently
  changed by revisions including
  `44f8042c38f31715feefde353b0aff02515085ca`,
  `9daad292a95b8d8d6ab4c96f65b6aebd49b326c9`, and
  `3eb34c97ed05634f9cd1424283dbbc56ddee9849`;
- `cloud-focus/static/focus-dag*`, synchronized and extended by revisions
  including `f72ccf16713f085624c52204eb33e78f04a7b146`,
  `758bb7fa5206aa0053ef8ca85f028dc783967d98`,
  `082c6ee86bd9d19b7dd04965de4040a4ecbcf9f4`,
  `cdd5ca71c00c7e2b032c3eb42df89c3c6278a9ed`,
  `572f2b4a339f6b1f1f4f1e950ec4ccc44ef9aa4a`,
  `2df2fd346f5a241e1c96f1915687d669146e5758`, and
  `4205841fdcb57bc07a27285cafaab4f9102b4044`.

These full object IDs were resolved and checked against the named path
families in local source repositories on 2026-09-06. That check establishes a
repeatable technical trail only; it does not establish copyright ownership,
license authority, or permission to publish the repository identifiers.

History inspection shows contributions from more than one employee account.
Before publication, the maintainer must obtain authorization from the
copyright owner for all extracted contributions, or replace any unapproved
material with independently authored code. Individual commit authorship alone
does not prove authority to relicense employer-owned work.

## Work authored in this repository

The package boundary, adapters, validation, incremental runtime updates,
framework wrappers, accessibility support, localization, layout cache, Worker
protocol, SVG export, benchmarks, browser tests, documentation, and subsequent
module extraction were developed in this repository as part of the open-source preparation.
This statement still requires confirmation by the person or organization that
owns work created during that preparation.

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

- [ ] Confirm the copyright owner for both source application repositories
- [ ] Obtain written approval for an Apache-2.0 public release
- [ ] Confirm that employee and contractor contribution agreements cover the
  extracted revisions
- [ ] Review visual assets, fixtures, and example data for confidential or
  third-party material
- [ ] Confirm that publishing the source application names, paths, and commit
  identifiers recorded above is authorized
- [x] Include the bundled Cytoscape.js MIT notice
- [x] Verify that the exact npm name was unregistered on 2026-09-05; repeat
  immediately before publishing because a lookup does not reserve the name
- [ ] Record the approving party and approval date in the release record

Do not remove this gate merely because the package passes technical checks.

## Release approval record

Use an organization, team, or role name when a person's name should not be
published. Do not include confidential ticket or document contents here.

Approving party: Pending
Approval date: Pending
