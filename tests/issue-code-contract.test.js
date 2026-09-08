import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");

function runtimeIssueCodes(source) {
  return new Set(
    [...source.matchAll(/\bissue\(\s*"([a-z0-9_]+)"/g)].map(
      (match) => match[1],
    ),
  );
}

function declaredIssueCodes(source) {
  const declaration = source.match(
    /export type WorkflowSnapshotIssueCode\s*=([\s\S]*?);/,
  );
  assert(declaration, "WorkflowSnapshotIssueCode declaration exists");
  return new Set(
    [...declaration[1].matchAll(/"([a-z0-9_]+)"/g)].map(
      (match) => match[1],
    ),
  );
}

function sorted(values) {
  return [...values].sort();
}

const runtime = runtimeIssueCodes(
  readFileSync(resolve(projectRoot, "src/validation.js"), "utf8"),
);
const esmDeclaration = declaredIssueCodes(
  readFileSync(resolve(projectRoot, "src/index.d.ts"), "utf8"),
);
const cjsDeclaration = declaredIssueCodes(
  readFileSync(resolve(projectRoot, "src/index.d.cts"), "utf8"),
);

assert.deepEqual(
  sorted(esmDeclaration),
  sorted(runtime),
  "runtime validation issue codes match the ESM TypeScript contract",
);
assert.deepEqual(
  sorted(cjsDeclaration),
  sorted(runtime),
  "runtime validation issue codes match the CommonJS TypeScript contract",
);

console.log("OK: runtime and TypeScript validation issue codes match");
