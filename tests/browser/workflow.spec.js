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

  const clearedExecution = await page.evaluate(() => {
    const next = structuredClone(window.dagSnapshot);
    delete next.execution;
    window.dagInstance.update(next);
    const data = window.getDAGCy(window.dagInstance)
      .getElementById("answer")
      .data();
    const cleared = {
      status: data.status ?? null,
      durationMs: data.cost_ms ?? null,
    };
    window.dagInstance.update(window.dagSnapshot);
    return cleared;
  });
  expect(clearedExecution).toEqual({ status: null, durationMs: null });

  await page.evaluate(() => {
    const next = structuredClone(window.dagSnapshot);
    next.workflow.nodes.push({ id: "audit", name: "Audit", component: "Lambda" });
    next.workflow.edges.push({ from: "answer", to: "audit", channels: ["control"] });
    next.execution.nodes.push({ path: ["audit"], status: "skipped", durationMs: null });
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
        nodes: [{ path: ["group/one", "child/two"], status: "success", durationMs: null }],
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
    const mutations = [
      () => window.dagInstance.update(window.dagSnapshot),
      () => window.dagInstance.expandAll(),
      () => window.dagInstance.collapseAll(),
      () => window.dagInstance.toggle(["group/one"]),
      () => window.dagInstance.setExpanded([]),
      () => window.dagInstance.setActiveNodePath(null),
      () => window.dagInstance.setDirection("LEFT"),
      () => window.dagInstance.setTheme("ink"),
      () => window.dagInstance.setLocale(),
      () => window.dagInstance.zoomIn(),
      () => window.dagInstance.zoomOut(),
      () => window.dagInstance.resetView(),
      () => window.dagInstance.resize(),
      () => window.dagInstance.exportImage(),
    ];
    const mutationMessages = mutations.map((mutate) => {
      try {
        mutate();
        return null;
      } catch (error) {
        return error.message;
      }
    });
    return {
      destroyedBefore: cyBefore.destroyed(),
      cyAfter: window.getDAGCy(window.dagInstance),
      mutationMessages,
    };
  });
  expect(teardown.destroyedBefore).toBe(true);
  expect(teardown.cyAfter).toBeNull();
  expect(teardown.mutationMessages).toHaveLength(14);
  expect(new Set(teardown.mutationMessages)).toEqual(
    new Set(["Cannot use a destroyed workflow DAG"]),
  );
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

test("applies instance themes and opt-out interaction policy", async ({ page }) => {
  await page.goto("/examples/plain/");
  await page.locator("#dag canvas").first().waitFor();

  const result = await page.evaluate(async () => {
    const host = document.createElement("div");
    host.style.cssText = "position:relative;width:720px;height:420px";
    const container = document.createElement("div");
    container.style.cssText = "width:100%;height:100%";
    host.appendChild(container);
    document.body.appendChild(host);
    let nodeClicks = 0;
    let edgeClicks = 0;
    const snapshot = {
      schemaVersion: 1,
      workflow: {
        nodes: [
          {
            id: "nested",
            name: "Nested",
            workflow: { nodes: [{ id: "inside" }], edges: [] },
          },
          { id: "finish", name: "Finish" },
        ],
        edges: [{ from: "nested", to: "finish", channels: ["control"] }],
      },
    };
    const instance = window.EinoWorkflowDAG.createWorkflowDAG(container, {
      snapshot,
      expanded: [],
      theme: {
        base: "classic",
        tokens: {
          canvas: { bg: "#f8fafc" },
          colors: { highlighted: "#2563eb" },
          tooltip: { bg: "#111827", color: "#f9fafb" },
        },
      },
      interaction: {
        expandOnNodeClick: false,
        tooltipOnHover: false,
        pinTooltipOnNodeClick: false,
        highlightEdgeOnClick: false,
        clearHighlightOnCanvasClick: false,
        keyboardNavigation: false,
        panOnDrag: false,
        zoomOnCtrlWheel: false,
      },
      onNodeClick: () => { nodeClicks += 1; },
      onEdgeClick: () => { edgeClicks += 1; },
    });
    const access = Symbol.for("eino-workflow-dag.cytoscape");
    const cy = instance[access]();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const initial = instance.getDiagnostics();
    const node = cy.getElementById("nested");
    const edge = cy.edges().first();
    node.emit("mouseover");
    node.emit("tap");
    edge.emit("tap");

    instance.setTheme({
      base: "classic",
      tokens: {
        canvas: { bg: "#fff7ed" },
        colors: { highlighted: "#ea580c" },
      },
    });
    const painted = instance.getDiagnostics();
    const paintCanvas = container.style.background;
    instance.setTheme({
      base: "classic",
      tokens: {
        node: { width: 280, height: 76, textMaxWidth: 250 },
        spacing: { nodeNode: 72, betweenLayers: 68 },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const resized = instance.getDiagnostics();
    const returnedTheme = instance.getTheme();
    returnedTheme.tokens.node.width = 90;
    const stableTheme = instance.getTheme();
    const output = {
      nodeClicks,
      edgeClicks,
      expanded: instance.getExpanded(),
      edgeHighlighted: edge.hasClass("highlight"),
      tooltipCount: host.querySelectorAll(".cy-node-tip:not([hidden])").length,
      tabIndex: container.getAttribute("tabindex"),
      panning: cy.userPanningEnabled(),
      paintLayoutDelta: painted.layoutRuns - initial.layoutRuns,
      geometryLayoutDelta: resized.layoutRuns - painted.layoutRuns,
      width: node.width(),
      height: node.height(),
      themeWidth: stableTheme.tokens.node.width,
      paintCanvas,
      canvas: container.style.background,
      tooltipBg: host.style.getPropertyValue("--eino-workflow-dag-tooltip-bg"),
    };
    instance.destroy();
    host.remove();
    return output;
  });

  expect(result).toEqual({
    nodeClicks: 1,
    edgeClicks: 1,
    expanded: [],
    edgeHighlighted: false,
    tooltipCount: 0,
    tabIndex: null,
    panning: false,
    paintLayoutDelta: 0,
    geometryLayoutDelta: 1,
    width: 280,
    height: 76,
    themeWidth: 280,
    paintCanvas: "rgb(255, 247, 237)",
    canvas: "rgb(244, 246, 248)",
    tooltipBg: "rgba(255, 255, 255, 0.97)",
  });
});
