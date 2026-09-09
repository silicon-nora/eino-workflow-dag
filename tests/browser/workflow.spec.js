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

  await expect(page.locator("#dag")).toHaveAttribute("role", "group");
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

test("isolates host callback failures after applying built-in behavior", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  await page.goto("/examples/plain/");
  await page.locator("#dag canvas").first().waitFor();

  const result = await page.evaluate(async () => {
    const host = document.createElement("div");
    host.style.cssText = "position:relative;width:720px;height:420px";
    const container = document.createElement("div");
    container.style.cssText = "width:100%;height:100%";
    host.appendChild(container);
    document.body.appendChild(host);

    const reported = [];
    const expandedObservations = [];
    let instance;
    instance = window.EinoWorkflowDAG.createWorkflowDAG(container, {
      snapshot: {
        schemaVersion: 1,
        workflow: {
          nodes: [
            {
              id: "nested",
              name: "Nested",
              workflow: { nodes: [{ id: "inside", name: "Inside" }], edges: [] },
            },
            { id: "finish", name: "Finish" },
          ],
          edges: [{ from: "nested", to: "finish", channels: ["control"] }],
        },
      },
      expanded: [],
      onExpandedChange(value) {
        const access = Symbol.for("eino-workflow-dag.cytoscape");
        expandedObservations.push({
          value,
          renderedNodes: instance[access]().nodes().map((node) => node.id()).sort(),
        });
        throw new Error("expanded observer failed");
      },
      onNodeClick() {
        return Promise.reject(new Error("node observer failed"));
      },
      onEdgeClick() {
        throw new Error("edge observer failed");
      },
      onError(error) {
        reported.push({
          code: error.code,
          message: error.message,
          recoverable: error.recoverable,
        });
        throw new Error("error observer failed");
      },
      tooltipFormatter() {
        throw new Error("tooltip formatter failed");
      },
      nodeLabelFormatter() {
        throw new Error("node label formatter failed");
      },
      accessibilityLabelFormatter() {
        throw new Error("accessibility formatter failed");
      },
    });

    const access = Symbol.for("eino-workflow-dag.cytoscape");
    const cy = instance[access]();
    const edge = cy.edges().first();
    edge.emit("tap");
    const highlightedAfterThrow = edge.hasClass("highlight");

    cy.getElementById("nested").emit("tap");
    await new Promise((resolve) => setTimeout(resolve, 150));
    const expandedAfterThrow = instance.getExpanded();
    const nodesAfterThrow = cy.nodes().map((node) => node.id()).sort();

    let setExpandedThrew = false;
    try {
      instance.setExpanded([]);
    } catch {
      setExpandedThrew = true;
    }
    const collapsedAfterThrow = instance.getExpanded();
    const nodesAfterCollapse = cy.nodes().map((node) => node.id()).sort();
    const labelsAfterFallback = cy.nodes().map((node) => node.data("label"));
    const accessibilityLabel = container.getAttribute("aria-label");

    instance.destroy();
    host.remove();
    return {
      collapsedAfterThrow,
      expandedAfterThrow,
      expandedObservations,
      highlightedAfterThrow,
      labelsAfterFallback,
      nodesAfterCollapse,
      nodesAfterThrow,
      reported,
      setExpandedThrew,
      accessibilityLabel,
    };
  });

  expect(result.highlightedAfterThrow).toBe(true);
  expect(result.expandedAfterThrow).toEqual([["nested"]]);
  expect(result.nodesAfterThrow).toEqual(["finish", "nested", "nested/inside"]);
  expect(result.collapsedAfterThrow).toEqual([]);
  expect(result.nodesAfterCollapse).toEqual(["finish", "nested"]);
  expect(result.labelsAfterFallback).toEqual(["Nested", "Finish"]);
  expect(result.accessibilityLabel).toContain("2 nodes and 1 edge");
  expect(result.setExpandedThrew).toBe(false);
  expect(result.expandedObservations).toEqual([
    {
      value: [["nested"]],
      renderedNodes: ["finish", "nested", "nested/inside"],
    },
    {
      value: [],
      renderedNodes: ["finish", "nested"],
    },
  ]);
  expect(result.reported).toEqual(expect.arrayContaining([
    expect.objectContaining({
      code: "RENDERER_RECOVERED",
      message: "onEdgeClick callback failed: edge observer failed",
      recoverable: true,
    }),
    expect.objectContaining({
      code: "RENDERER_RECOVERED",
      message: "tooltipFormatter callback failed: tooltip formatter failed",
      recoverable: true,
    }),
    expect.objectContaining({
      code: "RENDERER_RECOVERED",
      message: "nodeLabelFormatter callback failed: node label formatter failed",
      recoverable: true,
    }),
    expect.objectContaining({
      code: "RENDERER_RECOVERED",
      message: "accessibilityLabelFormatter callback failed: accessibility formatter failed",
      recoverable: true,
    }),
    expect.objectContaining({
      code: "RENDERER_RECOVERED",
      message: "onNodeClick callback failed: node observer failed",
      recoverable: true,
    }),
    expect.objectContaining({
      code: "RENDERER_RECOVERED",
      message: "onExpandedChange callback failed: expanded observer failed",
      recoverable: true,
    }),
  ]));
  expect(pageErrors).toEqual([]);
});

test("restores host state on destroy", async ({ page }) => {
  await page.goto("/examples/plain/");
  await page.locator("#dag canvas").first().waitFor();
  const result = await page.evaluate(() => {
    const host = document.createElement("div");
    host.setAttribute("data-theme", "consumer");
    host.style.cssText = "position:relative;width:320px;height:180px";
    const container = document.createElement("div");
    container.style.cssText = "width:100%;height:100%;background:rgb(1, 2, 3);cursor:crosshair!important";
    container.style.setProperty(
      "-webkit-tap-highlight-color",
      "rgb(4, 5, 6)",
      "important",
    );
    const consumerChild = document.createElement("span");
    consumerChild.textContent = "consumer-owned";
    container.appendChild(consumerChild);
    const tapHighlightBefore = {
      value: container.style.getPropertyValue("-webkit-tap-highlight-color"),
      priority: container.style.getPropertyPriority("-webkit-tap-highlight-color"),
    };
    host.appendChild(container);
    document.body.appendChild(host);
    const instance = window.EinoWorkflowDAG.createWorkflowDAG(container, {
      snapshot: {
        schemaVersion: 1,
        workflow: { nodes: [{ id: "standalone" }], edges: [] },
      },
    });
    const during = {
      marked: container.classList.contains("eino-workflow-dag-host"),
      overlays: container.querySelectorAll(":scope > .cy-overlays").length,
      hostTheme: host.getAttribute("data-theme"),
      theme: container.getAttribute("data-theme"),
      position: getComputedStyle(container).position,
      cursor: container.style.cursor,
    };
    const access = Symbol.for("eino-workflow-dag.cytoscape");
    const node = instance[access]().nodes().first();
    node.emit("mouseover");
    const cursorDuringHover = container.style.cursor;
    node.emit("mouseout");
    const cursorAfterHover = container.style.cursor;
    node.emit("mouseover");
    instance.destroy();
    const after = {
      marked: container.classList.contains("eino-workflow-dag-host"),
      overlays: container.querySelectorAll(":scope > .cy-overlays").length,
      hostTheme: host.getAttribute("data-theme"),
      theme: container.getAttribute("data-theme"),
      position: getComputedStyle(container).position,
      background: container.style.background,
      cursor: container.style.cursor,
      cursorPriority: container.style.getPropertyPriority("cursor"),
      canvases: container.querySelectorAll("canvas").length,
      consumerChildPreserved:
        container.firstChild === consumerChild &&
        consumerChild.textContent === "consumer-owned",
      tapHighlightPreserved:
        container.style.getPropertyValue("-webkit-tap-highlight-color") ===
          tapHighlightBefore.value &&
        container.style.getPropertyPriority("-webkit-tap-highlight-color") ===
          tapHighlightBefore.priority,
    };
    host.remove();
    return { during, cursorDuringHover, cursorAfterHover, after };
  });
  expect(result).toEqual({
    during: {
      marked: true,
      overlays: 1,
      hostTheme: "consumer",
      theme: "classic",
      position: "relative",
      cursor: "crosshair",
    },
    cursorDuringHover: "pointer",
    cursorAfterHover: "crosshair",
    after: {
      marked: false,
      overlays: 0,
      hostTheme: "consumer",
      theme: null,
      position: "relative",
      background: "rgb(1, 2, 3)",
      cursor: "crosshair",
      cursorPriority: "important",
      canvases: 0,
      consumerChildPreserved: true,
      tapHighlightPreserved: true,
    },
  });
});

test("rolls back a partial mount and silences callbacks after destroy", async ({ page }) => {
  await page.goto("/examples/plain/");
  await page.locator("#dag canvas").first().waitFor();

  const result = await page.evaluate(async () => {
    const snapshot = {
      schemaVersion: 1,
      workflow: { nodes: [{ id: "standalone" }], edges: [] },
    };
    const failedContainer = document.createElement("div");
    failedContainer.style.cssText = "width:320px;height:180px;background:salmon";
    failedContainer.setAttribute("role", "region");
    failedContainer.setAttribute("aria-label", "Consumer graph");
    document.body.appendChild(failedContainer);

    const NativeResizeObserver = window.ResizeObserver;
    let mountMessage = null;
    try {
      window.ResizeObserver = class BrokenResizeObserver {
        constructor() {
          throw new Error("observer unavailable");
        }
      };
      window.EinoWorkflowDAG.createWorkflowDAG(failedContainer, { snapshot });
    } catch (error) {
      mountMessage = error.message;
    } finally {
      window.ResizeObserver = NativeResizeObserver;
    }
    const failedMount = {
      message: mountMessage,
      canvases: failedContainer.querySelectorAll("canvas").length,
      overlays: failedContainer.querySelectorAll(":scope > .cy-overlays").length,
      marked: failedContainer.classList.contains("eino-workflow-dag-host"),
      theme: failedContainer.getAttribute("data-theme"),
      role: failedContainer.getAttribute("role"),
      label: failedContainer.getAttribute("aria-label"),
      background: failedContainer.style.background,
      children: Array.from(failedContainer.children).map((child) => ({
        tag: child.tagName,
        className: child.className,
        childTags: Array.from(child.children).map((nested) => nested.tagName),
      })),
    };
    failedContainer.remove();

    const callbackContainer = document.createElement("div");
    callbackContainer.style.cssText = "width:320px;height:180px";
    document.body.appendChild(callbackContainer);
    const errors = [];
    const instance = window.EinoWorkflowDAG.createWorkflowDAG(callbackContainer, {
      snapshot,
      onNodeClick() {
        return Promise.reject(new Error("late callback failure"));
      },
      onError(error) {
        errors.push(error.message);
      },
    });
    const access = Symbol.for("eino-workflow-dag.cytoscape");
    instance[access]().nodes().first().emit("tap");
    instance.destroy();
    await Promise.resolve();
    await Promise.resolve();
    callbackContainer.remove();
    return { failedMount, errors };
  });

  expect(result).toEqual({
    failedMount: {
      message: "observer unavailable",
      canvases: 0,
      overlays: 0,
      marked: false,
      theme: null,
      role: "region",
      label: "Consumer graph",
      background: "salmon",
      children: [],
    },
    errors: [],
  });
});

test("isolates vanilla instances that share one parent", async ({ page }) => {
  await page.goto("/examples/plain/");
  await page.locator("#dag canvas").first().waitFor();

  const result = await page.evaluate(async () => {
    const parent = document.createElement("div");
    parent.style.cssText = "display:flex;width:900px;height:360px";
    const firstContainer = document.createElement("div");
    const secondContainer = document.createElement("div");
    firstContainer.style.cssText = "width:50%;height:100%";
    secondContainer.style.cssText = "width:50%;height:100%";
    parent.append(firstContainer, secondContainer);
    document.body.appendChild(parent);

    const snapshot = {
      schemaVersion: 1,
      workflow: {
        nodes: [{
          id: "nested",
          workflow: { nodes: [{ id: "inside" }], edges: [] },
        }],
        edges: [],
      },
    };
    const first = window.EinoWorkflowDAG.createWorkflowDAG(firstContainer, {
      snapshot,
      expanded: [["nested"]],
      theme: "ink",
    });
    const second = window.EinoWorkflowDAG.createWorkflowDAG(secondContainer, {
      snapshot,
      expanded: [["nested"]],
      theme: "midnight",
    });
    await new Promise((resolve) => setTimeout(resolve, 80));

    const mounted = {
      parentMarked: parent.classList.contains("eino-workflow-dag-host"),
      firstTheme: firstContainer.getAttribute("data-theme"),
      secondTheme: secondContainer.getAttribute("data-theme"),
      firstOverlays: firstContainer.querySelectorAll(":scope > .cy-overlays").length,
      secondOverlays: secondContainer.querySelectorAll(":scope > .cy-overlays").length,
    };
    first.destroy();
    const afterFirstDestroy = {
      firstMarked: firstContainer.classList.contains("eino-workflow-dag-host"),
      firstTheme: firstContainer.getAttribute("data-theme"),
      firstOverlays: firstContainer.querySelectorAll(":scope > .cy-overlays").length,
      secondMarked: secondContainer.classList.contains("eino-workflow-dag-host"),
      secondTheme: secondContainer.getAttribute("data-theme"),
      secondOverlays: secondContainer.querySelectorAll(":scope > .cy-overlays").length,
      secondCanvases: secondContainer.querySelectorAll("canvas").length,
      secondExpanded: second.getExpanded(),
    };
    second.destroy();
    parent.remove();
    return { mounted, afterFirstDestroy };
  });

  expect(result).toEqual({
    mounted: {
      parentMarked: false,
      firstTheme: "ink",
      secondTheme: "midnight",
      firstOverlays: 1,
      secondOverlays: 1,
    },
    afterFirstDestroy: {
      firstMarked: false,
      firstTheme: null,
      firstOverlays: 0,
      secondMarked: true,
      secondTheme: "midnight",
      secondOverlays: 1,
      secondCanvases: 3,
      secondExpanded: [["nested"]],
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
      tooltipBg: container.style.getPropertyValue("--eino-workflow-dag-tooltip-bg"),
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

test("applies theme geometry to root and nested layout in every direction", async ({
  page,
}) => {
  await page.goto("/examples/plain/");
  await page.locator("#dag canvas").first().waitFor();

  const results = await page.evaluate(async () => {
    const access = Symbol.for("eino-workflow-dag.cytoscape");
    const directions = ["RIGHT", "LEFT", "DOWN", "UP"];
    const theme = {
      base: "classic",
      tokens: {
        node: { width: 181, height: 43, textMaxWidth: 160 },
        spacing: {
          nodeNode: 31,
          betweenLayers: 37,
          nestedNodeNode: 41,
          nestedBetweenLayers: 29,
        },
      },
    };

    function forwardGap(source, target, direction) {
      const boxOptions = { includeLabels: false, includeOverlays: false };
      const sourceBox = source.boundingBox(boxOptions);
      const targetBox = target.boundingBox(boxOptions);
      if (direction === "RIGHT") {
        return targetBox.x1 - sourceBox.x2;
      }
      if (direction === "LEFT") {
        return sourceBox.x1 - targetBox.x2;
      }
      if (direction === "DOWN") {
        return targetBox.y1 - sourceBox.y2;
      }
      return sourceBox.y1 - targetBox.y2;
    }

    async function render(snapshot, direction, expanded) {
      const host = document.createElement("div");
      host.style.cssText = "position:relative;width:720px;height:420px";
      const container = document.createElement("div");
      container.style.cssText = "width:100%;height:100%";
      host.appendChild(container);
      document.body.appendChild(host);
      const instance = window.EinoWorkflowDAG.createWorkflowDAG(container, {
        snapshot,
        direction,
        expanded,
        theme,
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        instance,
        cy: instance[access](),
        remove() {
          instance.destroy();
          host.remove();
        },
      };
    }

    const output = [];
    for (const direction of directions) {
      const root = await render(
        {
          schemaVersion: 1,
          workflow: {
            nodes: [{ id: "source" }, { id: "target" }],
            edges: [{ from: "source", to: "target", channels: ["control"] }],
          },
        },
        direction,
        [],
      );
      const rootSource = root.cy.getElementById("source");
      const rootTarget = root.cy.getElementById("target");
      const rootMeasurement = {
        gap: forwardGap(rootSource, rootTarget, direction),
        width: rootSource.width(),
        height: rootSource.height(),
      };
      root.remove();

      const nested = await render(
        {
          schemaVersion: 1,
          workflow: {
            nodes: [
              {
                id: "group",
                workflow: {
                  nodes: [{ id: "first" }, { id: "second" }],
                  edges: [
                    { from: "first", to: "second", channels: ["control"] },
                  ],
                },
              },
            ],
            edges: [],
          },
        },
        direction,
        [["group"]],
      );
      const first = nested.cy.getElementById("group/first");
      const second = nested.cy.getElementById("group/second");
      const nestedMeasurement = {
        gap: forwardGap(first, second, direction),
        width: first.width(),
        height: first.height(),
      };
      nested.remove();

      output.push({ direction, root: rootMeasurement, nested: nestedMeasurement });
    }
    return output;
  });

  for (const result of results) {
    expect(result.root.width).toBeCloseTo(181, 3);
    expect(result.root.height).toBeCloseTo(43, 3);
    expect(result.root.gap).toBeCloseTo(37, 3);
    expect(result.nested.width).toBeCloseTo(181, 3);
    expect(result.nested.height).toBeCloseTo(43, 3);
    expect(result.nested.gap).toBeCloseTo(29, 3);
  }
});

test("renders an empty nested workflow as a labeled non-expandable node", async ({ page }) => {
  await page.goto("/examples/plain/");

  const result = await page.evaluate(async () => {
    const host = document.createElement("div");
    host.style.cssText = "position:relative;width:480px;height:260px";
    document.body.appendChild(host);
    const expansionEvents = [];
    const instance = window.EinoWorkflowDAG.createWorkflowDAG(host, {
      snapshot: {
        schemaVersion: 1,
        workflow: {
          nodes: [{
            id: "empty",
            name: "Empty workflow",
            workflow: { nodes: [], edges: [] },
          }],
          edges: [],
        },
      },
      onExpandedChange(paths) {
        expansionEvents.push(paths);
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const access = Symbol.for("eino-workflow-dag.cytoscape");
    const cy = instance[access]();
    const node = cy.getElementById("empty");
    node.emit("tap");
    const output = {
      nodes: cy.nodes().length,
      label: node.data("label"),
      subgraph: node.data("subgraph"),
      expandable: node.data("expandable"),
      expanded: node.data("expanded"),
      isParent: node.isParent(),
      configuredExpanded: instance.getExpanded(),
      expansionEvents,
    };
    instance.destroy();
    host.remove();
    return output;
  });

  expect(result).toEqual({
    nodes: 1,
    label: "Empty workflow",
    subgraph: true,
    expandable: false,
    expanded: false,
    isParent: false,
    configuredExpanded: [],
    expansionEvents: [],
  });
});

test("retains an edge when a legal node ID resembles its generated ID", async ({ page }) => {
  await page.goto("/examples/plain/");

  const result = await page.evaluate(async () => {
    const host = document.createElement("div");
    host.style.cssText = "position:relative;width:480px;height:260px";
    document.body.appendChild(host);
    const instance = window.EinoWorkflowDAG.createWorkflowDAG(host, {
      snapshot: {
        schemaVersion: 1,
        workflow: {
          nodes: [
            { id: "a" },
            { id: "b" },
            { id: "e0_a__b" },
          ],
          edges: [{ from: "a", to: "b", channels: ["control"] }],
        },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const access = Symbol.for("eino-workflow-dag.cytoscape");
    const cy = instance[access]();
    const edge = cy.edges().first();
    const output = {
      nodes: cy.nodes().length,
      edges: cy.edges().length,
      collisionNodePresent: cy.getElementById("e0_a__b").isNode(),
      edgeId: edge.id(),
      source: edge.source().id(),
      target: edge.target().id(),
    };
    instance.destroy();
    host.remove();
    return output;
  });

  expect(result).toEqual({
    nodes: 3,
    edges: 1,
    collisionNodePresent: true,
    edgeId: "e0_a__b:1",
    source: "a",
    target: "b",
  });
});

test("invalidates measured geometry without relayout for paint-only theme changes", async ({
  page,
}) => {
  await page.goto("/examples/plain/");
  await page.locator("#dag canvas").first().waitFor();

  const result = await page.evaluate(() => {
    const directions = ["RIGHT", "LEFT", "DOWN", "UP"];
    return directions.map((direction, index) => {
      window.dagInstance.setDirection(direction);
      const nodeTokens = {
        borderWidth: 2 + index * 0.25,
        fontSize: 17 + index,
        fontWeight: 600,
        fontFamily: 'Georgia, "Times New Roman", serif',
        textOutlineWidth: index % 2,
      };
      const before = window.dagInstance.getDiagnostics();
      window.dagInstance.setTheme({
        base: "classic",
        tokens: { node: nodeTokens },
      });
      const afterGeometry = window.dagInstance.getDiagnostics();
      window.dagInstance.setTheme({
        base: "classic",
        tokens: {
          node: nodeTokens,
          colors: { paper: index % 2 ? "#f8fafc" : "#fff7ed" },
        },
      });
      const afterPaint = window.dagInstance.getDiagnostics();
      return {
        geometryDelta: afterGeometry.layoutRuns - before.layoutRuns,
        paintDelta: afterPaint.layoutRuns - afterGeometry.layoutRuns,
      };
    });
  });

  expect(result).toEqual([
    { geometryDelta: 1, paintDelta: 0 },
    { geometryDelta: 1, paintDelta: 0 },
    { geometryDelta: 1, paintDelta: 0 },
    { geometryDelta: 1, paintDelta: 0 },
  ]);
});

test("invalidates formatted-label layouts and shares complete node callback data", async ({
  page,
}) => {
  await page.goto("/examples/plain/");
  await page.locator("#dag canvas").first().waitFor();

  const result = await page.evaluate(() => {
    const host = document.createElement("div");
    host.style.cssText = "width:760px;height:420px";
    document.body.appendChild(host);
    const formatterInputs = [];
    const clickInputs = [];
    const makeSnapshot = (status, detail) => ({
      schemaVersion: 1,
      workflow: {
        nodes: [
          {
            id: "inspect",
            name: "Inspect",
            component: "Lambda",
            metadata: { detail },
            workflow: { nodes: [{ id: "inside" }], edges: [] },
          },
          { id: "finish", name: "Finish" },
        ],
        edges: [{ from: "inspect", to: "finish", channels: ["control"] }],
      },
      execution: {
        nodes: [
          {
            path: ["inspect"],
            status,
            durationMs: 8,
            metrics: { attempts: 1 },
          },
        ],
      },
    });
    const instance = window.EinoWorkflowDAG.createWorkflowDAG(host, {
      snapshot: makeSnapshot("success", "one"),
      expanded: [],
      nodeLabelFormatter: (node) => `${node.name}\n${node.status}:${node.metadata.detail}`,
      tooltipFormatter: (node) => {
        formatterInputs.push(node);
        return node.label;
      },
      onNodeClick: (node) => clickInputs.push(node),
    });
    const access = Symbol.for("eino-workflow-dag.cytoscape");
    const cy = instance[access]();

    const beforeStatus = instance.getDiagnostics();
    instance.update(makeSnapshot("failed", "one"));
    const afterStatus = instance.getDiagnostics();

    const directionDeltas = [];
    ["RIGHT", "LEFT", "DOWN", "UP"].forEach((direction, index) => {
      instance.setDirection(direction);
      const before = instance.getDiagnostics();
      instance.update(makeSnapshot("failed", `detail-${index}\nextra-${index}`));
      const after = instance.getDiagnostics();
      directionDeltas.push({
        layout: after.layoutRuns - before.layoutRuns,
        cache: after.layoutCacheHits - before.layoutCacheHits,
      });
    });

    const node = cy.getElementById("inspect");
    node.emit("mouseover");
    node.emit("tap");
    const output = {
      statusLayoutDelta: afterStatus.layoutRuns - beforeStatus.layoutRuns,
      statusPatchDelta: afterStatus.dataPatches - beforeStatus.dataPatches,
      directionDeltas,
      tooltip: formatterInputs.at(-1),
      click: clickInputs.at(-1),
    };
    instance.destroy();
    host.remove();
    return output;
  });

  expect(result.statusLayoutDelta).toBe(1);
  expect(result.statusPatchDelta).toBe(0);
  expect(result.directionDeltas).toEqual([
    { layout: 1, cache: 0 },
    { layout: 1, cache: 0 },
    { layout: 1, cache: 0 },
    { layout: 1, cache: 0 },
  ]);
  expect(result.tooltip).toEqual(result.click);
  expect(result.click).toMatchObject({
    path: ["inspect"],
    id: "inspect",
    name: "Inspect",
    label: "Inspect\nfailed:detail-3\nextra-3",
    kind: "graph",
    component: "Lambda",
    metadata: { detail: "detail-3\nextra-3" },
    status: "failed",
    durationMs: 8,
    metrics: { attempts: 1 },
    errorMessage: "",
    expandable: true,
    subgraph: true,
    expanded: false,
    level: expect.any(Number),
  });
});
