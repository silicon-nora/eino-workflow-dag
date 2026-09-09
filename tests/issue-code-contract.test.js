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

// Public issue-code unions are append-only across 1.x. A validator correction
// may stop producing a code, but the declared literal remains available so
// existing exhaustive consumers continue to type-check.
const legacyDeclaredCodes = new Set(["duplicate_branch"]);

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
  sorted(new Set([...runtime, ...legacyDeclaredCodes])),
  "runtime validation issue codes match the ESM TypeScript contract",
);
assert.deepEqual(
  sorted(cjsDeclaration),
  sorted(new Set([...runtime, ...legacyDeclaredCodes])),
  "runtime validation issue codes match the CommonJS TypeScript contract",
);

for (const code of legacyDeclaredCodes) {
  assert(!runtime.has(code), `${code} is compatibility-only and is not emitted`);
}

console.log("OK: runtime and TypeScript validation issue codes match");
