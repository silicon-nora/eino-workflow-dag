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
  expect(caseIds).toEqual(["serial", "fan", "diamond", "nested", "stress"]);
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
