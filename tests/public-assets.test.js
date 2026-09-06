import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  findReviewableAssets,
  validatePublicAssetInventory,
} from "../scripts/public-assets.js";

const work = mkdtempSync(resolve(tmpdir(), "eino-workflow-dag-assets-test-"));
try {
  writeFileSync(resolve(work, "example.js"), "export default 'public';\n");
  writeFileSync(resolve(work, "logo.svg"), "<svg></svg>\n");

  const found = findReviewableAssets(work);
  assert.equal(found.length, 1);
  assert.equal(found[0].path, "logo.svg");
  assert.equal(found[0].kind, "svg");

  assert.deepEqual(
    validatePublicAssetInventory(work, { version: 1, assets: [] }),
    ["unreviewed public asset: logo.svg"],
  );

  const reviewed = {
    version: 1,
    assets: [
      {
        ...found[0],
        source: "Original project artwork",
        license: "Apache-2.0",
        reviewedBy: "Example Open Source Office",
        reviewedOn: "2026-09-06",
      },
    ],
  };
  assert.deepEqual(validatePublicAssetInventory(work, reviewed), []);

  const invalidDate = structuredClone(reviewed);
  invalidDate.assets[0].reviewedOn = "2026-02-30";
  assert(
    validatePublicAssetInventory(work, invalidDate).some((failure) =>
      failure.includes("valid YYYY-MM-DD date"),
    ),
  );

  writeFileSync(resolve(work, "logo.svg"), "<svg><path /></svg>\n");
  assert(
    validatePublicAssetInventory(work, reviewed).some((failure) =>
      failure.includes("SHA-256 does not match"),
    ),
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log("OK: public asset inventory tests passed");
