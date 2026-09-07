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
  if (packed.status !== 0) {
    throw new Error(packed.stderr || packed.stdout || "npm pack failed");
  }
  const report = JSON.parse(packed.stdout)[0];
  const extracted = spawnSync(
    "tar",
    ["-xzf", resolve(work, report.filename), "-C", work],
    { encoding: "utf8" },
  );
  if (extracted.status !== 0) {
    throw new Error(extracted.stderr || extracted.stdout || "tar extraction failed");
  }
});

test.afterAll(() => {
  if (work) rmSync(work, { recursive: true, force: true });
});

test("runs the exact packed UMD and CSS in a static browser host", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.route("**/favicon.ico", (route) =>
    route.fulfill({ status: 204, body: "" }),
  );
  await page.goto("/");
  await page.setContent(`
    <main>
      <div class="eino-workflow-dag-flow">
        <div id="packed-host" class="cy-wrap" style="height:320px">
          <div id="packed" class="cy-root"></div>
        </div>
      </div>
    </main>
  `);
  await page.addStyleTag({
    url: `${publicRoot}/dist/eino-workflow-dag.css`,
  });
  await page.addScriptTag({
    url: `${publicRoot}/dist/eino-workflow-dag.umd.cjs`,
  });
  const publicKeys = await page.evaluate(() =>
    Object.keys(window.EinoWorkflowDAG).sort(),
  );
  expect(publicKeys).not.toContain("fromEinoGraphInfo");
  expect(publicKeys).not.toContain("applyEinoTraceEvent");
  const nonJSONCodes = await page.evaluate(() =>
    window.EinoWorkflowDAG.validateDAG({
      nodes: [{ id: "unsafe", metrics: { value: 1n } }],
      edges: [],
    }).errors.map((entry) => entry.code),
  );
  expect(nonJSONCodes).toContain("non_json_value");
  const strictBoundary = await page.evaluate(() => {
    let getterInvoked = false;
    const root = { edges: [] };
    Object.defineProperty(root, "nodes", {
      enumerable: true,
      get: () => {
        getterInvoked = true;
        return [];
      },
    });
    const accessorErrors = window.EinoWorkflowDAG.validateDAG(root).errors;
    const nestedErrors = window.EinoWorkflowDAG.validateDAG({
      version: 2,
      nodes: [
        {
          id: "nested",
          kind: "graph",
          graph: { version: 1, nodes: [], edges: [] },
        },
      ],
      edges: [],
    }).errors;
    const missingVersionErrors = window.EinoWorkflowDAG.validateDAG({
      nodes: [],
      edges: [],
    }).errors;
    const v1Errors = window.EinoWorkflowDAG.validateDAG({
      version: 1,
      nodes: [],
      edges: [],
    }).errors;
    return {
      getterInvoked,
      accessorCodes: accessorErrors.map((entry) => entry.code),
      nestedCodes: nestedErrors.map((entry) => entry.code),
      missingVersionCodes: missingVersionErrors.map((entry) => entry.code),
      v1Codes: v1Errors.map((entry) => entry.code),
    };
  });
  expect(strictBoundary.getterInvoked).toBe(false);
  expect(strictBoundary.accessorCodes).toContain("non_json_property");
  expect(strictBoundary.accessorCodes).toContain("invalid_nodes");
  expect(strictBoundary.nestedCodes).toContain("unsupported_version");
  expect(strictBoundary.missingVersionCodes).toContain("missing_version");
  expect(strictBoundary.v1Codes).toContain("unsupported_version");
  await page.evaluate(() => {
    window.packedDAG = window.EinoWorkflowDAG.mountWorkflowDAG(
      document.querySelector("#packed"),
      {
        root: {
          version: 2,
          nodes: [{ id: "partial", name: "Partial runtime graph" }],
          edges: [],
        },
      },
    );
  });
  await page.locator("#packed canvas").first().waitFor();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        version: window.EinoWorkflowDAG.CURRENT_DAG_VERSION,
        nodes: window.packedDAG.cy().nodes().length,
        hostMarked: document
          .querySelector("#packed-host")
          .classList.contains("eino-workflow-dag-host"),
      })),
    )
    .toEqual({ version: 2, nodes: 1, hostMarked: true });

  const protocolBoundary = await page.evaluate(() => {
    const mountErrors = [];
    for (const root of [
      { nodes: [], edges: [] },
      { version: 1, nodes: [], edges: [] },
      { version: 2, nodes: [] },
      {
        version: 2,
        nodes: [{ id: "a" }, { id: "b" }],
        edges: [{ from: "a", to: "b" }, { from: "b", to: "a" }],
      },
    ]) {
      const host = document.createElement("div");
      const container = document.createElement("div");
      host.appendChild(container);
      document.body.appendChild(host);
      try {
        window.EinoWorkflowDAG.mountWorkflowDAG(container, { root });
      } catch (error) {
        mountErrors.push(String(error.message));
      } finally {
        host.remove();
      }
    }
    let updateError = "";
    try {
      window.packedDAG.setData({ version: 1, nodes: [], edges: [] });
    } catch (error) {
      updateError = String(error.message);
    }
    return { mountErrors, updateError };
  });
  expect(protocolBoundary.mountErrors).toHaveLength(4);
  expect(protocolBoundary.mountErrors[0]).toContain("version 2");
  expect(protocolBoundary.mountErrors[1]).toContain("versions are 2");
  expect(protocolBoundary.mountErrors[2]).toContain("edges");
  expect(protocolBoundary.mountErrors[3]).toContain("cycle");
  expect(protocolBoundary.updateError).toContain("versions are 2");

  await page.evaluate(() => {
    window.packedDAG.setData({
      version: 2,
      nodes: [
        {
          id: "nested",
          name: "Nested",
          kind: "graph",
          graph: {
            nodes: [
              { id: "first", name: "First" },
              { id: "second", name: "Second" },
            ],
            edges: [{ from: "first", to: "second" }],
          },
        },
      ],
      edges: [],
    });
    window.packedDAG.expandAll();
  });
  await expect
    .poll(() => page.evaluate(() => window.packedDAG.cy().nodes().length))
    .toBe(3);

  await page.evaluate(() => window.packedDAG.destroy());
  await expect(page.locator("#packed canvas")).toHaveCount(0);
  await expect(page.locator("#packed-host > .cy-overlays")).toHaveCount(0);
  await expect(page.locator("#packed-host")).not.toHaveClass(
    /eino-workflow-dag-host/,
  );
  expect(errors).toEqual([]);
});
