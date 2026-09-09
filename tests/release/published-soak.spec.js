import { expect, test } from "@playwright/test";

const expectedVersion = process.env.RELEASE_VALIDATION_VERSION;
const cycles = Number(process.env.RELEASE_SOAK_CYCLES || 50);

async function settle(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }),
  );
}

async function inspectGeometry(page) {
  return page.evaluate(() => {
    const cy = window.releaseHarness.cy;
    const tolerance = 1;
    const failures = [];
    const nodes = cy.nodes().filter((node) => node.visible());

    nodes.forEach((node) => {
      const level = Number(node.data("level"));
      if (!Number.isInteger(level) || level < 0) {
        failures.push(`${node.id()}:invalid-level`);
      }
    });

    cy.edges().filter((edge) => edge.visible()).forEach((edge) => {
      const route = edge.scratch("einoWorkflowDAG")?._flowAbsRoute || [];
      if (route.length < 2) {
        failures.push(`${edge.id()}:missing-route`);
        return;
      }
      if (
        route.slice(1).some((point, index) => {
          const previous = route[index];
          return (
            Math.abs(point.x - previous.x) > tolerance &&
            Math.abs(point.y - previous.y) > tolerance
          );
        })
      ) {
        failures.push(`${edge.id()}:non-orthogonal-route`);
      }
    });

    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
      const left = nodes[leftIndex];
      for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
        const right = nodes[rightIndex];
        const leftParent = left.parent().nonempty() ? left.parent().id() : "";
        const rightParent = right.parent().nonempty() ? right.parent().id() : "";
        if (leftParent !== rightParent) continue;
        const a = left.boundingBox({ includeLabels: false, includeOverlays: false });
        const b = right.boundingBox({ includeLabels: false, includeOverlays: false });
        const width = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
        const height = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
        if (width > tolerance && height > tolerance) {
          failures.push(`${left.id()}/${right.id()}:overlap`);
        }
      }
    }

    return {
      failures,
      nodes: nodes.length,
      edges: cy.edges().filter((edge) => edge.visible()).length,
    };
  });
}

test("published package survives representative integration use", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => window.releaseReady && window.releaseHarness.cy);
  await page.locator("#dag canvas").first().waitFor();

  expect(await page.evaluate(() => window.releaseHarness.version)).toBe(expectedVersion);
  expect(await page.evaluate(() => window.releaseHarness.baseSnapshot.workflow.name)).toBe(
    "support-assistant",
  );

  const callbacks = await page.evaluate(() => {
    const cy = window.releaseHarness.cy;
    cy.getElementById("prepare").emit("tap");
    cy.edges()
      .filter(
        (edge) => edge.source().id() === "route" && edge.target().id() === "answer",
      )
      .first()
      .emit("tap");
    return [
      window.releaseHarness.events.filter((event) => event.type === "node").at(-1),
      window.releaseHarness.events.filter((event) => event.type === "edge").at(-1),
    ];
  });
  expect(callbacks[0]).toMatchObject({
    type: "node",
    value: { path: ["prepare"], metadata: { validation: "node-callback" } },
  });
  expect(callbacks[1]).toMatchObject({
    type: "edge",
    value: { metadata: { validation: "edge-callback" } },
  });

  const executionUpdates = await page.evaluate((count) => {
    const harness = window.releaseHarness;
    const before = harness.instance.getDiagnostics();
    for (let index = 0; index < count; index += 1) {
      const next = structuredClone(harness.baseSnapshot);
      const answer = next.execution.nodes.find((node) => node.path.join("/") === "answer");
      answer.status = index % 2 === 0 ? "failed" : "success";
      if (answer.status === "failed") answer.errorMessage = `probe-${index}`;
      harness.instance.update(next);
      harness.instance.setActiveNodePath(index % 2 === 0 ? ["answer"] : ["route"]);
    }
    const after = harness.instance.getDiagnostics();
    return { before, after };
  }, cycles);
  expect(executionUpdates.after.dataPatches).toBe(
    executionUpdates.before.dataPatches + cycles,
  );
  expect(executionUpdates.after.layoutRuns).toBe(executionUpdates.before.layoutRuns);

  const updateCoverage = await page.evaluate(() => {
    const harness = window.releaseHarness;
    const withoutExecution = structuredClone(harness.baseSnapshot);
    delete withoutExecution.execution;
    harness.instance.update(withoutExecution);
    const unknown = harness.cy.nodes().filter((node) => node.data("status") == null).length;

    const topology = structuredClone(harness.baseSnapshot);
    topology.workflow.nodes.push({ id: "audit", name: "Audit", component: "Lambda" });
    topology.workflow.edges = topology.workflow.edges.filter(
      (edge) => !(edge.from === "answer" && edge.to === "end"),
    );
    topology.workflow.edges.push(
      { from: "answer", to: "audit", channels: ["control", "data"] },
      { from: "audit", to: "end", channels: ["control", "data"] },
    );
    topology.execution.nodes.push({ path: ["audit"], status: "success", durationMs: 1 });
    const before = harness.instance.getDiagnostics();
    harness.instance.update(topology);
    const withAudit = harness.cy.getElementById("audit").length;
    const after = harness.instance.getDiagnostics();
    harness.instance.update(harness.baseSnapshot);
    return { unknown, withAudit, before, after };
  });
  expect(updateCoverage.unknown).toBeGreaterThan(0);
  expect(updateCoverage.withAudit).toBe(1);
  expect(updateCoverage.after.topologySyncs).toBeGreaterThan(
    updateCoverage.before.topologySyncs,
  );

  for (const direction of ["RIGHT", "LEFT", "DOWN", "UP"]) {
    for (const expanded of [false, true]) {
      await page.evaluate(
        ({ activeDirection, shouldExpand }) => {
          const instance = window.releaseHarness.instance;
          instance.setDirection(activeDirection);
          instance.setExpanded(shouldExpand ? [["answer"]] : []);
          instance.resetView();
        },
        { activeDirection: direction, shouldExpand: expanded },
      );
      await settle(page);
      const geometry = await inspectGeometry(page);
      expect(geometry.nodes).toBeGreaterThanOrEqual(expanded ? 5 : 4);
      expect(geometry.edges).toBeGreaterThan(0);
      expect(geometry.failures, `${direction}/${expanded ? "expanded" : "collapsed"}`).toEqual([]);
    }
  }

  const interaction = await page.evaluate((count) => {
    const harness = window.releaseHarness;
    const directions = ["RIGHT", "LEFT", "DOWN", "UP"];
    const paintThemes = [
      { base: "classic", tokens: { colors: { paper: "#ffffff" } } },
      { base: "classic", tokens: { colors: { paper: "#f8fafc" } } },
    ];
    const before = harness.instance.getDiagnostics();
    for (let index = 0; index < count; index += 1) {
      harness.instance.setDirection(directions[index % directions.length]);
      harness.instance.setExpanded(index % 2 === 0 ? [["answer"]] : []);
      harness.instance.setActiveNodePath(index % 3 === 0 ? ["answer"] : null);
      harness.instance.setTheme(paintThemes[index % paintThemes.length]);
    }
    return { before, after: harness.instance.getDiagnostics() };
  }, cycles);
  expect(interaction.after.layoutRuns).toBe(interaction.before.layoutRuns);
  expect(interaction.after.layoutCacheHits).toBeGreaterThan(
    interaction.before.layoutCacheHits,
  );

  const beforeGeometryTheme = await page.evaluate(() => {
    const instance = window.releaseHarness.instance;
    const before = instance.getDiagnostics();
    instance.setTheme("ink");
    return { before, after: instance.getDiagnostics() };
  });
  expect(beforeGeometryTheme.after.layoutRuns).toBe(
    beforeGeometryTheme.before.layoutRuns + 1,
  );
  await settle(page);
  expect((await inspectGeometry(page)).failures).toEqual([]);

  const afterGeometryTheme = await page.evaluate(() => {
    const instance = window.releaseHarness.instance;
    const before = instance.getDiagnostics();
    instance.setTheme("classic");
    return { before, after: instance.getDiagnostics() };
  });
  expect(afterGeometryTheme.after.layoutRuns).toBe(
    afterGeometryTheme.before.layoutRuns + 1,
  );
  await settle(page);
  expect((await inspectGeometry(page)).failures).toEqual([]);

  const lifecycle = await page.evaluate((count) =>
    window.releaseHarness.cycleLifecycle(count),
  cycles);
  expect(lifecycle.failures).toEqual([]);
  expect(lifecycle.canvases).toBeGreaterThan(0);
  expect(lifecycle.overlays).toBe(1);
  expect(errors).toEqual([]);
});
