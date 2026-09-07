import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const checker = resolve(projectRoot, "scripts/check-consumer-types.js");
const work = mkdtempSync(resolve(tmpdir(), "eino-workflow-dag-consumer-test-"));

function run(source, typeName = "ApplicationWorkflowSnapshot") {
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
    }
    type ApplicationEdgeChannel = "control" | "data";
    interface ApplicationEdge {
      from: string;
      to: string;
      channels: ApplicationEdgeChannel[];
    }
    interface ApplicationWorkflow {
      nodes: ApplicationNode[];
      edges: ApplicationEdge[];
    }
    export interface ApplicationWorkflowSnapshot {
      schemaVersion: 1;
      workflow: ApplicationWorkflow;
    }
  `);
  assert.equal(compatible.status, 0, compatible.stderr || compatible.stdout);
  assert.match(compatible.stdout, /is assignable to EinoWorkflowSnapshot/);

  const incompatible = run(`
    export interface ApplicationWorkflowSnapshot {
      nodes: string[];
      edges: number[];
    }
  `);
  assert.notEqual(incompatible.status, 0);
  assert.match(
    `${incompatible.stdout}\n${incompatible.stderr}`,
    /is not assignable to EinoWorkflowSnapshot/,
  );

  const missing = run("export interface SomethingElse {}", "MissingSnapshot");
  assert.notEqual(missing.status, 0);
  assert.match(
    `${missing.stdout}\n${missing.stderr}`,
    /type is not declared in source: MissingSnapshot/,
  );

  console.log("OK: consumer workflow snapshot type compatibility tests passed");
} finally {
  rmSync(work, { recursive: true, force: true });
}
