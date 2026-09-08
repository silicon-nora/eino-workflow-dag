import { expect, test } from "@playwright/test";

const directions = ["RIGHT", "LEFT", "DOWN", "UP"];

const fanSnapshot = {
  schemaVersion: 1,
  workflow: {
    nodes: [
      { id: "a", name: "A", component: "Lambda" },
      { id: "b", name: "B", component: "Lambda" },
      { id: "c", name: "C", component: "Lambda" },
      { id: "d", name: "D", component: "Lambda" },
      { id: "e", name: "E", component: "Lambda" },
      { id: "f", name: "F", component: "Lambda" },
      { id: "g", name: "G", component: "Lambda" },
    ],
    edges: [
      { from: "a", to: "b", channels: ["control"] },
      { from: "a", to: "c", channels: ["control"] },
      { from: "a", to: "d", channels: ["control"] },
      { from: "b", to: "e", channels: ["control"] },
      { from: "c", to: "e", channels: ["control"] },
      { from: "d", to: "e", channels: ["control"] },
      { from: "b", to: "f", channels: ["control"] },
      { from: "c", to: "f", channels: ["control"] },
      { from: "d", to: "f", channels: ["control"] },
      { from: "e", to: "g", channels: ["control"] },
      { from: "f", to: "g", channels: ["control"] },
      { from: "a", to: "g", channels: ["control"] },
    ],
  },
};

async function settleLayout(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );
}

async function setDirection(page, direction) {
  await page.evaluate((nextDirection) => {
    window.dagInstance.setDirection(nextDirection);
    window.dagInstance.resetView();
  }, direction);
  await expect
    .poll(() => page.evaluate(() => window.dagInstance.getDirection()))
    .toBe(direction);
  await settleLayout(page);
}

async function inspectRoutes(page, direction) {
  return page.evaluate((activeDirection) => {
    const access = Symbol.for("eino-workflow-dag.cytoscape");
    const cy = window.dagInstance[access]();
    const tolerance = 1;
    const expectedInputSide = {
      RIGHT: "WEST",
      LEFT: "EAST",
      DOWN: "NORTH",
      UP: "SOUTH",
    }[activeDirection];

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
      const distances = [
        ["WEST", Math.abs(point.x - box.x1)],
        ["EAST", Math.abs(point.x - box.x2)],
        ["NORTH", Math.abs(point.y - box.y1)],
        ["SOUTH", Math.abs(point.y - box.y2)],
      ];
      distances.sort((left, right) => left[1] - right[1]);
      return distances[0][0];
    };

    const missingPlannedRoutes = [];
    const diagonalPlannedRoutes = [];
    const diagonalRenderedRoutes = [];
    const incomingSides = new Map();

    cy.edges().forEach((edge) => {
      const scratch = edge.scratch("einoWorkflowDAG") || {};
      const planned = scratch._flowAbsRoute || [];
      const rendered = [
        edge.sourceEndpoint(),
        ...edge.segmentPoints(),
        edge.targetEndpoint(),
      ];

      if (planned.length < 2) missingPlannedRoutes.push(edge.id());
      else if (!isOrthogonal(planned)) diagonalPlannedRoutes.push(edge.id());
      if (!isOrthogonal(rendered)) diagonalRenderedRoutes.push(edge.id());

      const targetSide = endpointSide(edge.target(), rendered.at(-1));
      const targetId = edge.target().id();
      if (!incomingSides.has(targetId)) incomingSides.set(targetId, []);
      incomingSides.get(targetId).push(targetSide);
    });

    const targetsMissingPrimaryInput = [];
    for (const [targetId, sides] of incomingSides) {
      if (!sides.includes(expectedInputSide)) targetsMissingPrimaryInput.push(targetId);
    }

    return {
      missingPlannedRoutes,
      diagonalPlannedRoutes,
      diagonalRenderedRoutes,
      targetsMissingPrimaryInput,
      diagnostics: window.dagInstance.getDiagnostics(),
    };
  }, direction);
}

async function expectRoutingInvariants(page, direction) {
  const result = await inspectRoutes(page, direction);
  expect(
    result.missingPlannedRoutes,
    `${direction}: every edge has a route`,
  ).toEqual([]);
  expect(
    result.diagonalPlannedRoutes,
    `${direction}: planned routes are orthogonal`,
  ).toEqual([]);
  expect(
    result.diagonalRenderedRoutes,
    `${direction}: rendered routes are orthogonal`,
  ).toEqual([]);
  expect(
    result.targetsMissingPrimaryInput,
    `${direction}: every fan-in uses the primary input side when it is available`,
  ).toEqual([]);
  return result;
}

test("preserves routing invariants across updates, directions, and cache hits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/examples/plain/");
  await page.locator("#dag canvas").first().waitFor();

  // Warm the original graph in every direction before replacing its topology.
  for (const direction of directions) await setDirection(page, direction);

  await page.evaluate((snapshot) => window.dagInstance.update(snapshot), fanSnapshot);
  await settleLayout(page);
  await expectRoutingInvariants(page, "UP");

  for (const direction of directions) {
    await setDirection(page, direction);
    await expectRoutingInvariants(page, direction);
  }

  // The second pass restores each direction from the layout cache.
  for (const direction of directions.toReversed()) {
    await setDirection(page, direction);
    const result = await expectRoutingInvariants(page, direction);
    expect(result.diagnostics.layoutCacheHits).toBeGreaterThan(0);
  }
});
