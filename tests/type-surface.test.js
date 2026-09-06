import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  collectTypeSurface,
  validateTypeSurface,
} from "../scripts/type-surface.js";

const work = mkdtempSync(resolve(tmpdir(), "eino-workflow-dag-types-test-"));
try {
  writeFileSync(resolve(work, "index.d.ts"), "export interface API { value: string }\n");
  const manifest = {
    exports: {
      ".": {
        import: { types: "./index.d.ts", default: "./index.js" },
        require: { types: "./index.d.cts", default: "./index.cjs" },
      },
      "./styles.css": "./styles.css",
    },
  };
  const frozen = collectTypeSurface(work, manifest);
  assert.deepEqual(Object.keys(frozen), ["."]);
  assert.equal(frozen["."].path, "index.d.ts");
  assert.deepEqual(validateTypeSurface(frozen, structuredClone(frozen)), []);

  writeFileSync(
    resolve(work, "index.d.ts"),
    "export interface API { value: string }\r\n",
  );
  assert.deepEqual(collectTypeSurface(work, manifest), frozen);

  writeFileSync(
    resolve(work, "index.d.ts"),
    "export interface API { value: number }\n",
  );
  const changed = collectTypeSurface(work, manifest);
  assert(
    validateTypeSurface(changed, frozen).some((failure) =>
      failure.includes("declaration content changed"),
    ),
  );
  assert(
    validateTypeSurface(changed, {}).some((failure) =>
      failure.includes("is missing"),
    ),
  );
  assert(
    validateTypeSurface({}, frozen).some((failure) =>
      failure.includes("unknown typed subpath"),
    ),
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log("OK: public TypeScript surface tests passed");
