import { expect, test } from "@playwright/test";

test("renders, interacts, updates data, and responds to its container", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/examples/plain/");
  await page.locator("#dag canvas").first().waitFor();

  const hostIsolation = await page.evaluate(() => {
    const unrelatedTip = document.createElement("div");
    unrelatedTip.className = "cy-node-tip";
    unrelatedTip.textContent = "consumer tooltip";
    document.body.appendChild(unrelatedTip);

    const host = document.createElement("div");
    host.className = "consumer-shell";
    host.setAttribute("data-theme", "consumer");
    host.style.cssText = "position:relative;width:320px;height:180px";
    host.style.setProperty(
      "--eino-workflow-dag-title-color",
      "hotpink",
      "important",
    );
    const container = document.createElement("div");
    container.style.cssText =
      "width:100%;height:100%;background:rgb(1, 2, 3)";
    host.appendChild(container);
    document.body.appendChild(host);

    const instance = window.EinoWorkflowDAG.mountWorkflowDAG(container, {
      root: {
        version: 2,
        nodes: [{ id: "standalone", name: "Standalone" }],
        edges: [],
      },
    });
    instance.setData({
      version: 2,
      nodes: [{ id: "standalone", name: "Standalone updated" }],
      edges: [],
    });
    const during = {
      marked: host.classList.contains("eino-workflow-dag-host"),
      overlays: host.querySelectorAll(":scope > .cy-overlays").length,
      theme: host.getAttribute("data-theme"),
      nodes: instance.cy().nodes().length,
    };
    instance.destroy();
    const after = {
      marked: host.classList.contains("eino-workflow-dag-host"),
      overlays: host.querySelectorAll(":scope > .cy-overlays").length,
      theme: host.getAttribute("data-theme"),
      titleColor: host.style.getPropertyValue(
        "--eino-workflow-dag-title-color",
      ),
      titleColorPriority: host.style.getPropertyPriority(
        "--eino-workflow-dag-title-color",
      ),
      background: container.style.background,
      unrelatedPosition: getComputedStyle(unrelatedTip).position,
    };
    host.remove();
    unrelatedTip.remove();
    return { during, after };
  });
  expect(hostIsolation).toEqual({
    during: { marked: true, overlays: 1, theme: "classic", nodes: 1 },
    after: {
      marked: false,
      overlays: 0,
      theme: "consumer",
      titleColor: "hotpink",
      titleColorPriority: "important",
      background: "rgb(1, 2, 3)",
      unrelatedPosition: "static",
    },
  });

  await expect
    .poll(() =>
      page.evaluate(() => ({
        nodes: window.dagInstance.cy().nodes().length,
        edges: window.dagInstance.cy().edges().length,
      })),
    )
    .toEqual({ nodes: 6, edges: 4 });
  const activeNodeState = await page.evaluate(() => {
    const before = window.dagInstance.getDiagnostics();
    window.dagInstance.setActiveNodeId("search");
    window.dagInstance.setActiveNodeId("search");
    return {
      configured: window.dagInstance.getActiveNodeId(),
      highlighted: window.dagInstance
        .cy()
        .nodes(".active-node")
        .map((node) => node.id()),
      before,
      after: window.dagInstance.getDiagnostics(),
    };
  });
  expect(activeNodeState.configured).toBe("search");
  expect(activeNodeState.highlighted).toEqual(["research/search"]);
  expect(activeNodeState.after).toEqual(activeNodeState.before);
  await page.evaluate(() => {
    window.dagInstance.setExpanded({
      ...window.dagInstance.getExpanded(),
      "not-expanded": false,
    });
  });
  await expect(
    page.evaluate(() => window.dagExpansionEvents.length),
  ).resolves.toBe(0);
  await expect(page.locator("#dag")).toHaveAttribute("role", "img");
  await expect(page.locator("#dag")).toHaveAttribute(
    "aria-label",
    /Workflow DAG with 6 nodes and 4 edges/,
  );
  await page.locator("#dag").focus();
  await page.keyboard.press("Home");
  await expect
    .poll(() =>
      page.evaluate(() => window.dagInstance.cy().nodes(".keyboard-focus").length),
    )
    .toBe(1);
  const keyboardNodeId = await page.evaluate(() =>
    window.dagInstance.cy().nodes(".keyboard-focus").first().id(),
  );
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => window.dagEvents.at(-1))).toEqual({
    type: "node",
    id: keyboardNodeId,
  });

  await page.evaluate(() => {
    window.dagInstance.cy().getElementById("research/search").emit("tap");
  });
  await expect
    .poll(() =>
      page.evaluate(() => ({
        id: window.lastDagNodeClick?.id,
        key: window.lastDagNodeClick?.key,
      })),
    )
    .toEqual({ id: "research/search", key: "search" });

  await page.evaluate(() => {
    window.dagInstance.cy().getElementById("research/search").emit("mouseover");
  });
  await expect(page.locator(".cy-node-tip")).toContainText("Status: Success");

  await page.evaluate(() => {
    window.dagInstance.setLocale({
      statuses: { success: "成功" },
      tooltip: { status: "状态" },
      collapseSubgraphTitle: "收起子流程",
    });
  });
  await expect(page.locator(".cy-node-tip")).toContainText("状态: 成功");
  await expect(page.getByTitle("收起子流程")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.dagInstance.getLocale().statuses.success))
    .toBe("成功");
  const localeIdempotence = await page.evaluate(() => {
    const before = window.dagInstance.getDiagnostics();
    window.dagInstance.setLocale({
      statuses: { success: "成功" },
      tooltip: { status: "状态" },
      collapseSubgraphTitle: "收起子流程",
    });
    return { before, after: window.dagInstance.getDiagnostics() };
  });
  expect(localeIdempotence.after).toEqual(localeIdempotence.before);
  await page.evaluate(() => window.dagInstance.setLocale());
  await expect(page.locator(".cy-node-tip")).toContainText("Status: Success");

  await page.getByTitle("Collapse subgraph").click();
  await expect
    .poll(() => page.evaluate(() => window.dagInstance.cy().nodes().length))
    .toBe(3);
  await expect
    .poll(() => page.evaluate(() => window.dagInstance.cy().nodes(".active-node").length))
    .toBe(0);
  await expect.poll(() => page.evaluate(() => window.dagExpansionEvents.length)).toBe(1);

  const cacheHitsBefore = await page.evaluate(
    () => window.dagInstance.getDiagnostics().layoutCacheHits,
  );
  await page.evaluate(() => window.dagInstance.expandAll());
  await expect
    .poll(() => page.evaluate(() => window.dagInstance.cy().nodes().length))
    .toBe(6);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.dagInstance.cy().getElementById("research/search").hasClass("active-node"),
      ),
    )
    .toBe(true);
  await expect.poll(() => page.evaluate(() => window.dagExpansionEvents.length)).toBe(2);
  await page.evaluate(() => window.dagInstance.collapseAll());
  await expect
    .poll(() => page.evaluate(() => window.dagInstance.cy().nodes().length))
    .toBe(3);
  await expect.poll(() => page.evaluate(() => window.dagExpansionEvents.length)).toBe(3);
  await expect
    .poll(() =>
      page.evaluate(() => window.dagInstance.getDiagnostics().layoutCacheHits),
    )
    .toBeGreaterThan(cacheHitsBefore);
  await page.evaluate(() => window.dagInstance.setActiveNodeId(null));
  await expect(page.evaluate(() => window.dagInstance.getActiveNodeId())).resolves.toBeNull();

  await page.evaluate(() => window.dagInstance.cy().zoom(1.25));
  const answerPosition = await page.evaluate(() =>
    window.dagInstance.cy().getElementById("answer").position(),
  );
  await page.evaluate(() => {
    const next = structuredClone(window.dagRoot);
    const answer = next.nodes.find((node) => node.id === "answer");
    answer.status = "failed";
    answer.err_msg = "test failure";
    window.dagRoot = next;
    window.dagInstance.setData(next);
  });
  await expect(
    page.evaluate(() => window.dagExpansionEvents.length),
  ).resolves.toBe(3);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        nodes: window.dagInstance.cy().nodes().length,
        status: window.dagInstance.cy().getElementById("answer").data("status"),
        zoom: window.dagInstance.cy().zoom(),
      })),
    )
    .toEqual({ nodes: 3, status: "failed", zoom: 1.25 });
  await expect(
    page.evaluate(() => window.dagInstance.cy().getElementById("answer").position()),
  ).resolves.toEqual(answerPosition);

  await page.evaluate(() => {
    const cy = window.dagInstance.cy();
    cy.getElementById("answer").addClass("consumer-state");
    const next = structuredClone(window.dagRoot);
    next.nodes.push({
      id: "audit",
      name: "Audit",
      kind: "cpu",
      status: "pending",
      cost_ms: 0,
    });
    next.edges.push({ from: "answer", to: "audit" });
    window.dagRoot = next;
    window.dagInstance.setData(next);
  });
  await expect
    .poll(() =>
      page.evaluate(() => ({
        nodes: window.dagInstance.cy().nodes().length,
        edges: window.dagInstance.cy().edges().length,
        preservedClass: window.dagInstance
          .cy()
          .getElementById("answer")
          .hasClass("consumer-state"),
        zoom: window.dagInstance.cy().zoom(),
      })),
    )
    .toEqual({ nodes: 4, edges: 3, preservedClass: true, zoom: 1.25 });
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.dagInstance.cy().getElementById("audit").style("border-width"),
      ),
    )
    .toBe("4px");

  await page.evaluate(() => {
    window.dagInstance.cy().getElementById("answer").emit("tap");
  });
  await expect.poll(() => page.evaluate(() => window.dagEvents.at(-1))).toEqual({
    type: "node",
    id: "answer",
  });
  await expect(page.locator(".cy-node-tip")).toBeHidden();

  const widthBefore = await page.evaluate(() => window.dagInstance.cy().width());
  await page.evaluate(() => {
    document.querySelector(".cy-wrap").style.width = "760px";
  });
  await expect
    .poll(() => page.evaluate(() => window.dagInstance.cy().width()))
    .toBeLessThan(widthBefore);

  await page.evaluate(() => {
    window.dagInstance.setData(window.dagRoot, {
      preserveExpanded: false,
      fit: true,
    });
  });
  await expect
    .poll(() => page.evaluate(() => window.dagInstance.cy().nodes().length))
    .toBe(7);

  const edgeId = await page.evaluate(() => {
    const edge = window.dagInstance.cy().edges().first();
    edge.emit("tap");
    return edge.id();
  });
  await expect.poll(() => page.evaluate(() => window.dagEvents.at(-1))).toEqual({
    type: "edge",
    id: edgeId,
  });
  await expect
    .poll(() =>
      page.evaluate((id) =>
        window.dagInstance.cy().getElementById(id).hasClass("highlight"), edgeId),
    )
    .toBe(true);

  await page.evaluate(() => {
    window.dagInstance.setDirection("LEFT");
    window.dagInstance.setDirection("UP");
    window.dagInstance.setDirection("RIGHT");
    window.dagInstance.setDirection("DOWN");
  });
  await expect
    .poll(() => page.evaluate(() => window.dagInstance.getDirection()))
    .toBe("DOWN");
  const vertical = await page.evaluate(() => {
    const input = window.dagInstance.cy().getElementById("input").position();
    const answer = window.dagInstance.cy().getElementById("answer").position();
    return answer.y > input.y;
  });
  expect(vertical).toBe(true);

  const image = await page.evaluate(async () => {
    const blob = await window.dagInstance.exportImage({
      format: "png",
      maxWidth: 480,
    });
    return { size: blob.size, type: blob.type };
  });
  expect(image.type).toBe("image/png");
  expect(image.size).toBeGreaterThan(1000);

  const vector = await page.evaluate(async () => {
    const blob = await window.dagInstance.exportImage({
      format: "svg",
      maxWidth: 640,
    });
    const text = await blob.text();
    const document = new DOMParser().parseFromString(text, "image/svg+xml");
    return {
      size: blob.size,
      type: blob.type,
      text,
      parseError: document.querySelector("parsererror")?.textContent || "",
      nodes: document.querySelectorAll("[data-element-id]").length,
      routes: document.querySelectorAll("polyline").length,
    };
  });
  expect(vector.type).toBe("image/svg+xml;charset=utf-8");
  expect(vector.size).toBeGreaterThan(500);
  expect(vector.text).toContain('xmlns="http://www.w3.org/2000/svg"');
  expect(vector.text).toContain("<polyline");
  expect(vector.text).toContain("Input");
  expect(vector.text).not.toContain("<script>");
  expect(vector.parseError).toBe("");
  expect(vector.nodes).toBeGreaterThanOrEqual(3);
  expect(vector.routes).toBeGreaterThanOrEqual(1);

  const activeNodeResolution = await page.evaluate(() => {
    window.dagInstance.setData(
      {
        version: 2,
        nodes: [
          {
            id: "left",
            kind: "graph",
            graph: { nodes: [{ id: "duplicate" }], edges: [] },
          },
          {
            id: "right",
            kind: "graph",
            graph: { nodes: [{ id: "duplicate" }], edges: [] },
          },
        ],
        edges: [{ from: "left", to: "right" }],
      },
      { preserveExpanded: false, fit: true },
    );
    window.dagInstance.expandAll();
    window.dagInstance.setActiveNodeId("duplicate");
    const ambiguousCount = window.dagInstance.cy().nodes(".active-node").length;
    window.dagInstance.setActiveNodeId("left/duplicate");
    let invalidMessage = "";
    try {
      window.dagInstance.setActiveNodeId(42);
    } catch (error) {
      invalidMessage = error.message;
    }
    return {
      ambiguousCount,
      exactIds: window.dagInstance
        .cy()
        .nodes(".active-node")
        .map((node) => node.id()),
      configured: window.dagInstance.getActiveNodeId(),
      invalidMessage,
    };
  });
  expect(activeNodeResolution).toEqual({
    ambiguousCount: 0,
    exactIds: ["left/duplicate"],
    configured: "left/duplicate",
    invalidMessage: "active node id must be a string or null",
  });

  const prototypeKeyGraph = await page.evaluate(() => {
    const visible = window.dagInstance.setData(
      {
        version: 2,
        nodes: [
          { id: "__proto__", status: "success", cost_ms: 1 },
          { id: "constructor", status: "running", cost_ms: 2 },
          { id: "toString", status: "pending", cost_ms: 3 },
        ],
        edges: [
          { from: "__proto__", to: "constructor" },
          { from: "constructor", to: "toString" },
        ],
      },
      { preserveExpanded: false, fit: true },
    );
    return {
      visibleIds: visible.nodes.map((node) => node.id),
      levels: visible.nodes.map((node) => node.level),
      edgeCount: visible.edges.length,
      cytoscapeIds: window.dagInstance.cy().nodes().map((node) => node.id()),
    };
  });
  expect(prototypeKeyGraph).toEqual({
    visibleIds: ["__proto__", "constructor", "toString"],
    levels: [1, 1, 1],
    edgeCount: 2,
    cytoscapeIds: ["__proto__", "constructor", "toString"],
  });

  const recoveredLayoutError = await page.evaluate(() => {
    const cy = window.dagInstance.cy();
    const originalLayout = cy.layout.bind(cy);
    let injected = false;
    cy.layout = (options) => {
      if (!injected && options.name === "eino-workflow-dag") {
        injected = true;
        return {
          one() {
            return this;
          },
          run() {
            throw new Error("forced layout failure");
          },
          stop() {},
        };
      }
      return originalLayout(options);
    };
    window.dagInstance.setDirection("LEFT");
    cy.layout = originalLayout;
    return {
      direction: window.dagInstance.getDirection(),
      event: window.dagEvents.at(-1),
      nodeCount: cy.nodes().length,
    };
  });
  expect(recoveredLayoutError).toEqual({
    direction: "LEFT",
    event: { type: "error", message: "forced layout failure" },
    nodeCount: 3,
  });

  expect(errors).toEqual([]);

  await page.evaluate(() => window.dagInstance.destroy());
  await expect(page.locator("#dag canvas")).toHaveCount(0);
  await expect(page.locator(".cy-node-tip")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.dagInstance.cy())).toBeNull();
  await expect(page.locator("#dag")).not.toHaveAttribute("role");
  await expect(page.locator("#dag")).not.toHaveAttribute("aria-label");
  await expect(page.locator("#dag")).not.toHaveAttribute("tabindex");
  await expect(page.locator("#dag")).not.toHaveAttribute("aria-keyshortcuts");

  const destroyedLifecycle = await page.evaluate(() => {
    // Repeated teardown must remain safe for framework cleanup paths.
    window.dagInstance.destroy();
    const messages = {};
    for (const operation of [
      "render",
      "setData",
      "setTheme",
      "setActiveNodeId",
      "resize",
      "zoomIn",
    ]) {
      try {
        if (operation === "setData") {
          window.dagInstance.setData(window.dagRoot);
        } else if (operation === "setTheme") {
          window.dagInstance.setTheme("classic");
        } else {
          window.dagInstance[operation]();
        }
      } catch (error) {
        messages[operation] = error.message;
      }
    }
    return {
      messages,
      canvasCount: document.querySelectorAll("#dag canvas").length,
      cy: window.dagInstance.cy(),
    };
  });
  expect(destroyedLifecycle).toEqual({
    messages: {
      render: "Cannot use a destroyed workflow DAG",
      setData: "Cannot use a destroyed workflow DAG",
      setTheme: "Cannot use a destroyed workflow DAG",
      setActiveNodeId: "Cannot use a destroyed workflow DAG",
      resize: "Cannot use a destroyed workflow DAG",
      zoomIn: "Cannot use a destroyed workflow DAG",
    },
    canvasCount: 0,
    cy: null,
  });
});
