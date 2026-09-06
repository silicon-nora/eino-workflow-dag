import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const checker = resolve(projectRoot, "scripts/check-consumer-types.js");
const work = mkdtempSync(resolve(tmpdir(), "eino-workflow-dag-consumer-test-"));

function run(source, typeName = "ApplicationDAG") {
  const file = resolve(work, `${typeName}.ts`);
  writeFileSync(file, source, "utf8");
  return spawnSync(process.execPath, [checker, file, typeName], {
    cwd: projectRoot,
    encoding: "utf8",
  });
}

try {
  const compatible = run(`
    interface ApplicationNode {
      id: string;
      name: string;
      graph?: ApplicationDAG;
    }
    interface ApplicationEdge { from: string; to: string; kind: string; }
    interface BaseDAG {
      nodes: ApplicationNode[];
      edges: ApplicationEdge[];
    }
    export interface ApplicationDAG extends BaseDAG {
      version: 2;
      scene: string;
    }
  `);
  assert.equal(compatible.status, 0, compatible.stderr || compatible.stdout);
  assert.match(compatible.stdout, /is assignable to DAGData/);

  const incompatible = run(`
    export interface ApplicationDAG {
      nodes: string[];
      edges: number[];
    }
  `);
  assert.notEqual(incompatible.status, 0);
  assert.match(
    `${incompatible.stdout}\n${incompatible.stderr}`,
    /is not assignable to DAGData/,
  );

  const missing = run("export interface SomethingElse {}", "MissingDAG");
  assert.notEqual(missing.status, 0);
  assert.match(
    `${missing.stdout}\n${missing.stderr}`,
    /type is not declared in source: MissingDAG/,
  );

  console.log("OK: consumer DAG type compatibility tests passed");
} finally {
  rmSync(work, { recursive: true, force: true });
}
