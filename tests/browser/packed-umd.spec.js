import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let work;
let publicRoot;

test.beforeAll(() => {
  work = mkdtempSync(resolve(projectRoot, ".packed-browser-"));
  publicRoot = `/${basename(work)}/package`;
  const packed = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["pack", "--json", "--ignore-scripts", "--pack-destination", work],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        npm_config_audit: "false",
        npm_config_cache: resolve(work, "npm-cache"),
        npm_config_dry_run: "false",
        npm_config_fund: "false",
        npm_config_update_notifier: "false",
      },
      shell: process.platform === "win32",
    },
  );
  if (packed.status !== 0) throw new Error(packed.stderr || packed.stdout);
  const report = JSON.parse(packed.stdout)[0];
  const extracted = spawnSync("tar", ["-xzf", resolve(work, report.filename), "-C", work], { encoding: "utf8" });
  if (extracted.status !== 0) throw new Error(extracted.stderr || extracted.stdout);
});

test.afterAll(() => {
  if (work) rmSync(work, { recursive: true, force: true });
});

test("runs the exact packed UMD and CSS", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204, body: "" }));
  await page.goto("/");
  await page.setContent(`
    <div id="packed-host" class="cy-wrap" style="height:320px">
      <div id="packed" class="cy-root" style="width:100%;height:100%"></div>
    </div>
  `);
  await page.addStyleTag({ url: `${publicRoot}/dist/eino-workflow-dag.css` });
  await page.addScriptTag({ url: `${publicRoot}/dist/eino-workflow-dag.umd.cjs` });

  expect(await page.evaluate(() => Object.keys(window.EinoWorkflowDAG).sort())).toEqual([
    "CURRENT_SCHEMA_VERSION",
    "SUPPORTED_SCHEMA_VERSIONS",
    "WorkflowDAGError",
    "WorkflowSnapshotError",
    "createWorkflowDAG",
    "listWorkflowDAGThemes",
    "parseWorkflowSnapshot",
    "registerWorkflowDAGTheme",
    "validateWorkflowSnapshot",
  ]);

  const strict = await page.evaluate(() => {
    let getterInvoked = false;
    const workflow = { edges: [] };
    Object.defineProperty(workflow, "nodes", {
      enumerable: true,
      get() {
        getterInvoked = true;
        return [];
      },
    });
    const result = window.EinoWorkflowDAG.validateWorkflowSnapshot({
      schemaVersion: 1,
      workflow,
    });
    return { getterInvoked, codes: result.errors.map((entry) => entry.code) };
  });
  expect(strict.getterInvoked).toBe(false);
  expect(strict.codes).toContain("invalid_json_value");
  expect(strict.codes).toContain("invalid_nodes");

  await page.evaluate(() => {
    window.packedSnapshot = {
      schemaVersion: 1,
      workflow: { nodes: [{ id: "node", name: "Node" }], edges: [] },
      execution: { nodes: [{ path: ["node"], status: "success", durationMs: null }] },
    };
    window.packedDAG = window.EinoWorkflowDAG.createWorkflowDAG(
      document.querySelector("#packed"),
      { snapshot: window.packedSnapshot },
    );
  });
  await page.locator("#packed canvas").first().waitFor();
  await page.evaluate(() => {
    const access = Symbol.for("eino-workflow-dag.cytoscape");
    window.getPackedCy = (instance) => instance[access]();
  });
  await expect.poll(() => page.evaluate(() => ({
    version: window.EinoWorkflowDAG.CURRENT_SCHEMA_VERSION,
    nodes: window.getPackedCy(window.packedDAG).nodes().length,
  }))).toEqual({ version: 1, nodes: 1 });

  await page.evaluate(() => {
    const next = structuredClone(window.packedSnapshot);
    next.execution.nodes[0].status = "success";
    window.packedDAG.update(next);
  });
  await expect.poll(() => page.evaluate(() =>
    window.getPackedCy(window.packedDAG).getElementById("node").data("status"),
  )).toBe("success");

  const invalid = await page.evaluate(() => {
    try {
      window.packedDAG.update({ schemaVersion: 2, workflow: { nodes: [], edges: [] } });
      return null;
    } catch (error) {
      return { code: error.code, issue: error.issues[0].code };
    }
  });
  expect(invalid).toEqual({
    code: "INVALID_WORKFLOW_SNAPSHOT",
    issue: "unsupported_schema_version",
  });

  expect(await page.evaluate(() => {
    window.packedDAG.destroy();
    return window.getPackedCy(window.packedDAG);
  })).toBeNull();
  expect(errors).toEqual([]);
});
