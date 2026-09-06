import assert from "node:assert/strict";
import { validateReleaseReadiness } from "../scripts/check-release-readiness.js";

const manifest = {
  name: "eino-workflow-dag",
  version: "0.4.0-alpha.2",
  license: "Apache-2.0",
  repository: "https://github.com/example-org/eino-workflow-dag.git",
  homepage: "https://github.com/example-org/eino-workflow-dag#readme",
  bugs: { url: "https://github.com/example-org/eino-workflow-dag/issues" },
  publishConfig: { access: "public" },
};
const approved = `
- [x] Confirm the copyright owner for both source application repositories
- [x] Obtain written approval for an Apache-2.0 public release
- [x] Confirm that employee and contractor contribution agreements cover the
  extracted revisions
- [x] Review visual assets, fixtures, and example data for confidential or
  third-party material
- [x] Confirm that publishing the source application names, paths, and commit
  identifiers recorded above is authorized
- [x] Include the bundled Cytoscape.js MIT notice
- [x] Verify that the exact npm name was unregistered on 2026-09-05; repeat
  immediately before publishing because a lookup does not reserve the name
- [x] Record the approving party and approval date in the release record

Approving party: Example Open Source Office
Approval date: 2026-09-06
`;

assert.deepEqual(validateReleaseReadiness(manifest, approved), {
  approvingParty: "Example Open Source Office",
  approvalDate: "2026-09-06",
  repository: "example-org/eino-workflow-dag",
});

assert.throws(
  () =>
    validateReleaseReadiness(
      manifest,
      approved
        .replace(
          "- [x] Obtain written approval for an Apache-2.0 public release",
          "- [ ] Obtain written approval for an Apache-2.0 public release",
        )
        .replace("Example Open Source Office", "Pending")
        .replace("2026-09-06", "2026-02-30"),
    ),
  (error) => {
    assert.match(error.message, /Incomplete provenance item/);
    assert.match(error.message, /must record the approving party/);
    assert.match(error.message, /approval date is invalid/);
    return true;
  },
);

assert.throws(
  () =>
    validateReleaseReadiness(
      manifest,
      approved.replace("- [x] Include the bundled Cytoscape.js MIT notice\n", ""),
    ),
  /Missing provenance item: Include the bundled Cytoscape\.js MIT notice/,
);

assert.throws(
  () =>
    validateReleaseReadiness(
      manifest,
      `${approved}\n- [ ] Complete a newly added release review\n`,
    ),
  /Incomplete provenance item: Complete a newly added release review/,
);

assert.throws(
  () =>
    validateReleaseReadiness(
      { ...manifest, homepage: "https://example.com", bugs: undefined },
      approved,
    ),
  (error) => {
    assert.match(error.message, /homepage must be/);
    assert.match(error.message, /bugs URL must be/);
    return true;
  },
);

assert.throws(
  () =>
    validateReleaseReadiness(
      { ...manifest, publishConfig: { access: "restricted" } },
      approved,
    ),
  /publishConfig\.access must be public/,
);

console.log("OK: release readiness tests passed");
