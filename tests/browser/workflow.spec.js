import { expect, test } from "@playwright/test";

test("renders, updates, addresses nodes by path, and cleans up", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/examples/plain/");
  await page.locator("#dag canvas").first().waitFor();
  await page.evaluate(() => {
    const access = Symbol.for("eino-workflow-dag.cytoscape");
    window.getDAGCy = (instance) => instance[access]();
  });

  await expect
    .poll(() => page.evaluate(() => ({
      nodes: window.getDAGCy(window.dagInstance).nodes().length,
      edges: window.getDAGCy(window.dagInstance).edges().length,
    })))
    .toEqual({ nodes: 6, edges: 4 });

  const selection = await page.evaluate(() => {
    const before = window.dagInstance.getDiagnostics();
    window.dagInstance.setActiveNodePath(["research", "search"]);
    window.dagInstance.setActiveNodePath(["research", "search"]);
    return {
      configured: window.dagInstance.getActiveNodePath(),
      highlighted: window.getDAGCy(window.dagInstance)
        .nodes(".active-node")
        .map((node) => node.id()),
      before,
      after: window.dagInstance.getDiagnostics(),
    };
  });
  expect(selection.configured).toEqual(["research", "search"]);
  expect(selection.highlighted).toEqual(["research/search"]);
  expect(selection.after).toEqual(selection.before);

  await page.evaluate(() => {
    window.dagInstance.setExpanded(window.dagInstance.getExpanded());
  });
  expect(await page.evaluate(() => window.dagExpansionEvents.length)).toBe(0);

  await page.evaluate(() => {
    window.getDAGCy(window.dagInstance)
      .getElementById("research/search")
      .emit("tap");
  });
  await expect.poll(() => page.evaluate(() => window.dagEvents.length)).toBe(1);
  expect(await page.evaluate(() => window.lastDagNodeClick)).toMatchObject({
    path: ["research", "search"],
    id: "search",
    status: "success",
    durationMs: 50,
  });

  await page.evaluate(() => {
    const edge = window.getDAGCy(window.dagInstance)
      .edges()
      .filter((candidate) =>
        candidate.source().id() === "input" && candidate.target().id() === "research")
      .first();
    edge.emit("tap");
  });
  await expect.poll(() => page.evaluate(() => window.lastDagEdgeClick)).toMatchObject({
    source: ["input"],
    target: ["research"],
    channels: ["control", "data"],
    mappings: [{ fromPath: ["query"], toPath: ["query"] }],
    metadata: { transport: "typed" },
    branchMetadata: null,
  });

  const statePatch = await page.evaluate(() => {
    const next = structuredClone(window.dagSnapshot);
    next.execution.nodes.find((node) => node.path.join("/") === "answer").status = "failed";
    const before = window.dagInstance.getDiagnostics();
    window.dagSnapshot = next;
    window.dagInstance.update(next);
    return {
      status: window.getDAGCy(window.dagInstance).getElementById("answer").data("status"),
      before,
      after: window.dagInstance.getDiagnostics(),
    };
  });
  expect(statePatch.status).toBe("failed");
  expect(statePatch.after.dataPatches).toBe(statePatch.before.dataPatches + 1);
  expect(statePatch.after.layoutRuns).toBe(statePatch.before.layoutRuns);

  await page.evaluate(() => {
    const next = structuredClone(window.dagSnapshot);
    next.workflow.nodes.push({ id: "audit", name: "Audit", component: "Lambda" });
    next.workflow.edges.push({ from: "answer", to: "audit", channels: ["control"] });
    next.execution.nodes.push({ path: ["audit"], status: "pending", durationMs: 0 });
    window.dagSnapshot = next;
    window.dagInstance.update(next);
  });
  await expect
    .poll(() => page.evaluate(() => window.getDAGCy(window.dagInstance).nodes().length))
    .toBe(7);

  await expect(page.locator("#dag")).toHaveAttribute("role", "img");
  await expect(page.locator("#dag")).toHaveAttribute("aria-label", /7 nodes and 5 edges/);

  const specialPath = await page.evaluate(() => {
    const snapshot = {
      schemaVersion: 1,
      workflow: {
        nodes: [{
          id: "group/one",
          workflow: { nodes: [{ id: "child/two" }], edges: [] },
        }],
        edges: [],
      },
      execution: {
        nodes: [{ path: ["group/one", "child/two"], status: "running" }],
      },
    };
    window.dagInstance.update(snapshot, { preserveExpanded: false });
    window.dagInstance.setExpanded([["group/one"]]);
    window.dagInstance.setActiveNodePath(["group/one", "child/two"]);
    const cy = window.getDAGCy(window.dagInstance);
    return {
      selected: window.dagInstance.getActiveNodePath(),
      ids: cy.nodes().map((node) => node.id()),
      active: cy.nodes(".active-node").map((node) => node.id()),
    };
  });
  expect(specialPath.selected).toEqual(["group/one", "child/two"]);
  expect(specialPath.ids).toContain("group~1one/child~1two");
  expect(specialPath.active).toEqual(["group~1one/child~1two"]);

  const untimedClick = await page.evaluate(() => {
    window.getDAGCy(window.dagInstance)
      .getElementById("group~1one/child~1two")
      .emit("tap");
    return window.lastDagNodeClick;
  });
  expect(untimedClick).not.toHaveProperty("durationMs");

  const invalid = await page.evaluate(() => {
    try {
      window.dagInstance.update({ schemaVersion: 1, workflow: { nodes: [] } });
      return null;
    } catch (error) {
      return { name: error.name, code: error.code, issues: error.issues.length };
    }
  });
  expect(invalid).toEqual({
    name: "WorkflowSnapshotError",
    code: "INVALID_WORKFLOW_SNAPSHOT",
    issues: 1,
  });

  const teardown = await page.evaluate(() => {
    const cyBefore = window.getDAGCy(window.dagInstance);
    window.dagInstance.destroy();
    window.dagInstance.destroy();
    let message = "";
    try {
      window.dagInstance.setTheme("ink");
    } catch (error) {
      message = error.message;
    }
    return {
      destroyedBefore: cyBefore.destroyed(),
      cyAfter: window.getDAGCy(window.dagInstance),
      message,
    };
  });
  expect(teardown).toEqual({
    destroyedBefore: true,
    cyAfter: null,
    message: "Cannot use a destroyed workflow DAG",
  });
  expect(errors).toEqual([]);
});

test("restores host state on destroy", async ({ page }) => {
  await page.goto("/examples/plain/");
  await page.locator("#dag canvas").first().waitFor();
  const result = await page.evaluate(() => {
    const host = document.createElement("div");
    host.setAttribute("data-theme", "consumer");
    host.style.cssText = "position:relative;width:320px;height:180px";
    const container = document.createElement("div");
    container.style.cssText = "width:100%;height:100%;background:rgb(1, 2, 3)";
    host.appendChild(container);
    document.body.appendChild(host);
    const instance = window.EinoWorkflowDAG.createWorkflowDAG(container, {
      snapshot: {
        schemaVersion: 1,
        workflow: { nodes: [{ id: "standalone" }], edges: [] },
      },
    });
    const during = {
      marked: host.classList.contains("eino-workflow-dag-host"),
      overlays: host.querySelectorAll(":scope > .cy-overlays").length,
      theme: host.getAttribute("data-theme"),
    };
    instance.destroy();
    const after = {
      marked: host.classList.contains("eino-workflow-dag-host"),
      overlays: host.querySelectorAll(":scope > .cy-overlays").length,
      theme: host.getAttribute("data-theme"),
      background: container.style.background,
    };
    host.remove();
    return { during, after };
  });
  expect(result).toEqual({
    during: { marked: true, overlays: 1, theme: "classic" },
    after: {
      marked: false,
      overlays: 0,
      theme: "consumer",
      background: "rgb(1, 2, 3)",
    },
  });
});
