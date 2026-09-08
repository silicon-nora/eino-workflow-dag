import { expect, test } from "@playwright/test";

async function settleLayout(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }),
  );
}

async function inspectRoutes(page, direction) {
  return page.evaluate((activeDirection) => {
    const access = Symbol.for("eino-workflow-dag.cytoscape");
    const cy = window.routingPreview[access]();
    const tolerance = 1;
    const expectedInputSide = {
      RIGHT: "WEST",
      LEFT: "EAST",
      DOWN: "NORTH",
      UP: "SOUTH",
    }[activeDirection];
    const expectedOutputSide = {
      RIGHT: "EAST",
      LEFT: "WEST",
      DOWN: "SOUTH",
      UP: "NORTH",
    }[activeDirection];
    const crossAxis = activeDirection === "RIGHT" || activeDirection === "LEFT" ? "y" : "x";

    const isOrthogonal = (points) =>
      points.length >= 2 &&
      points.slice(1).every((point, index) => {
        const previous = points[index];
        return (
          Math.abs(point.x - previous.x) <= tolerance ||
          Math.abs(point.y - previous.y) <= tolerance
        );
      });

    const endpointSide = (node, point) => {
      const box = node.boundingBox({
        includeLabels: false,
        includeOverlays: false,
      });
      return [
        ["WEST", Math.abs(point.x - box.x1)],
        ["EAST", Math.abs(point.x - box.x2)],
        ["NORTH", Math.abs(point.y - box.y1)],
        ["SOUTH", Math.abs(point.y - box.y2)],
      ].sort((left, right) => left[1] - right[1])[0][0];
    };

    const failures = [];
    const incoming = new Map();
    const outgoing = new Map();
    cy.edges().forEach((edge) => {
      const planned = edge.scratch("einoWorkflowDAG")?._flowAbsRoute || [];
      const rendered = [
        edge.sourceEndpoint(),
        ...edge.segmentPoints(),
        edge.targetEndpoint(),
      ];
      if (planned.length < 2) failures.push(`${edge.id()}:missing-plan`);
      else if (!isOrthogonal(planned)) failures.push(`${edge.id()}:diagonal-plan`);
      if (!isOrthogonal(rendered)) failures.push(`${edge.id()}:diagonal-render`);

      const sourceId = edge.source().id();
      const targetId = edge.target().id();
      if (!outgoing.has(sourceId)) outgoing.set(sourceId, []);
      if (!incoming.has(targetId)) incoming.set(targetId, []);
      outgoing.get(sourceId).push(endpointSide(edge.source(), rendered[0]));
      incoming.get(targetId).push(endpointSide(edge.target(), rendered.at(-1)));
    });

    for (const [nodeId, sides] of incoming) {
      if (!sides.includes(expectedInputSide)) failures.push(`${nodeId}:missing-primary-input`);
    }
    for (const [nodeId, sides] of outgoing) {
      if (!sides.includes(expectedOutputSide)) failures.push(`${nodeId}:missing-primary-output`);
    }

    const railCoordinate = (node) => {
      if (node.isParent()) {
        const levelZeroChild = node.children().filter((child) => Number(child.data("level")) === 0)[0];
        if (levelZeroChild) return railCoordinate(levelZeroChild);
      }
      return node.position(crossAxis);
    };
    const rails = new Map();
    cy.nodes().forEach((node) => {
      const parentId = node.parent().nonempty() ? node.parent().id() : "root";
      const level = Number(node.data("level"));
      const key = `${parentId}:${level}`;
      if (!rails.has(key)) rails.set(key, []);
      rails.get(key).push({ id: node.id(), value: railCoordinate(node) });
    });
    for (const [key, members] of rails) {
      if (members.length < 2) continue;
      const values = members.map((member) => member.value);
      if (Math.max(...values) - Math.min(...values) > tolerance) {
        failures.push(
          `${key}:nodes-do-not-share-rail:${members
            .map((member) => `${member.id}=${member.value.toFixed(1)}`)
            .join(",")}`,
        );
      }
    }
    return { edgeCount: cy.edges().length, failures };
  }, direction);
}

test("routing preview covers every case and direction", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/examples/routing-preview/");
  await page.locator("#dag canvas").first().waitFor();

  const caseIds = await page.locator("#case option").evaluateAll((options) =>
    options.map((option) => option.value),
  );
  const directions = await page.locator("[data-direction]").evaluateAll((buttons) =>
    buttons.map((button) => button.dataset.direction),
  );
  expect(caseIds).toEqual([
    "serial",
    "fan",
    "diamond",
    "nested",
    "production",
    "stress",
  ]);
  expect(directions).toEqual(["RIGHT", "LEFT", "DOWN", "UP"]);

  for (const caseId of caseIds) {
    await page.locator("#case").selectOption(caseId);
    await settleLayout(page);
    for (const direction of directions) {
      await page.locator(`[data-direction="${direction}"]`).click();
      await settleLayout(page);
      const result = await inspectRoutes(page, direction);
      expect(result.edgeCount, `${caseId}/${direction}: renders edges`).toBeGreaterThan(0);
      expect(result.failures, `${caseId}/${direction}: routing invariants`).toEqual([]);
    }
  }
});

test("an expanded graph keeps its external Level 0 edge straight", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/examples/routing-preview/");
  await page.locator("#dag canvas").first().waitFor();
  await page.locator("#case").selectOption("production");
  await page.evaluate(() => window.routingPreview.setExpanded([["guided_flow"]]));
  await settleLayout(page);

  for (const direction of ["RIGHT", "LEFT", "DOWN", "UP"]) {
    await page.locator(`[data-direction="${direction}"]`).click();
    await settleLayout(page);
    const geometry = await page.evaluate((activeDirection) => {
      const access = Symbol.for("eino-workflow-dag.cytoscape");
      const cy = window.routingPreview[access]();
      const edge = cy.edges().filter(
        (candidate) =>
          candidate.source().id() === "route_strategy" &&
          candidate.target().id() === "guided_flow",
      )[0];
      const route = edge?.scratch("einoWorkflowDAG")?._flowAbsRoute || [];
      const crossAxis =
        activeDirection === "RIGHT" || activeDirection === "LEFT" ? "y" : "x";
      const levelZeroChild = edge
        ?.target()
        .children()
        .filter((child) => Number(child.data("level")) === 0)[0];
      return {
        sourceLevel: Number(edge?.source().data("level")),
        targetLevel: Number(edge?.target().data("level")),
        pointCount: route.length,
        endpointCrossDelta:
          route.length >= 2
            ? Math.abs(route[0][crossAxis] - route.at(-1)[crossAxis])
            : Infinity,
        targetRailDelta:
          route.length >= 2 && levelZeroChild
            ? Math.abs(route.at(-1)[crossAxis] - levelZeroChild.position(crossAxis))
            : Infinity,
      };
    }, direction);
    expect(geometry.sourceLevel, `${direction}: source Level`).toBe(0);
    expect(geometry.targetLevel, `${direction}: target Level`).toBe(0);
    expect(
      geometry.targetRailDelta,
      `${direction}: wrapper port follows inner Level 0`,
    ).toBeLessThanOrEqual(2);
    expect(
      geometry.endpointCrossDelta,
      `${direction}: endpoints are collinear`,
    ).toBeLessThanOrEqual(1);
    expect(
      geometry.pointCount,
      `${direction}: unobstructed same-Level route is straight`,
    ).toBe(2);
  }
});

test("a same-Level edge may bend when its direct corridor is blocked", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/examples/routing-preview/");
  await page.locator("#dag canvas").first().waitFor();
  await page.evaluate(() => {
    window.routingPreview.update({
      schemaVersion: 1,
      workflow: {
        nodes: [
          { id: "a", name: "A", component: "Lambda" },
          { id: "b", name: "B", component: "Lambda" },
          { id: "c", name: "C", component: "Lambda" },
        ],
        edges: [
          { from: "a", to: "b", channels: ["data"] },
          { from: "b", to: "c", channels: ["data"] },
          { from: "a", to: "c", channels: ["data"] },
        ],
      },
      execution: {
        nodes: [
          { path: ["a"], status: "success", durationMs: 10 },
          { path: ["b"], status: "success", durationMs: 100 },
          { path: ["c"], status: "success", durationMs: 10 },
        ],
      },
    });
  });
  await settleLayout(page);
  const geometry = await page.evaluate(() => {
    const access = Symbol.for("eino-workflow-dag.cytoscape");
    const cy = window.routingPreview[access]();
    const edge = cy.edges().filter(
      (candidate) =>
        candidate.source().id() === "a" && candidate.target().id() === "c",
    )[0];
    const route = edge?.scratch("einoWorkflowDAG")?._flowAbsRoute || [];
    return {
      sourceLevel: Number(edge?.source().data("level")),
      targetLevel: Number(edge?.target().data("level")),
      edgeLevel: Number(edge?.data("level")),
      pointCount: route.length,
    };
  });
  expect(geometry.sourceLevel).toBe(0);
  expect(geometry.targetLevel).toBe(0);
  expect(geometry.edgeLevel).toBe(0);
  expect(
    geometry.pointCount,
    "the route detours around the intervening node",
  ).toBeGreaterThan(2);
});
