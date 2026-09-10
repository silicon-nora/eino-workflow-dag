import { expect, test } from "@playwright/test";

const directions = ["RIGHT", "LEFT", "DOWN", "UP"];

test("preserves visual geometry invariants in every direction", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/examples/vanilla/");
  await page.locator("#dag canvas").first().waitFor();
  await page.evaluate(() => {
    const access = Symbol.for("eino-workflow-dag.cytoscape");
    window.getDAGCy = (instance) => instance[access]();
  });

  await page.evaluate(() => window.dagInstance.expandAll());
  await expect(page.locator(".cy-subgraph-title")).toHaveCount(1);

  for (const direction of directions) {
    await page.evaluate((nextDirection) => {
      window.dagInstance.setDirection(nextDirection);
      window.dagInstance.resetView();
    }, direction);

    await expect
      .poll(() => page.evaluate(() => window.dagInstance.getDirection()))
      .toBe(direction);

    const geometry = await page.evaluate(() => {
      const cy = window.getDAGCy(window.dagInstance);
      const input = cy.getElementById("input").position();
      const answer = cy.getElementById("answer").position();
      const boxes = cy
        .nodes()
        .filter((node) => !node.isParent())
        .map((node) => {
          const box = node.renderedBoundingBox({
            includeLabels: false,
            includeOverlays: false,
          });
          return { id: node.id(), ...box };
        });
      const overlaps = [];
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i];
          const b = boxes[j];
          const width = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
          const height = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
          if (width > 1 && height > 1) overlaps.push([a.id, b.id]);
        }
      }
      return {
        input,
        answer,
        overlaps,
        edgeStyles: cy.edges().map((edge) => ({
          curve: edge.style("curve-style"),
          routePoints:
            edge.scratch("einoWorkflowDAG")?._flowAbsRoute?.length ?? 0,
        })),
      };
    });

    expect(geometry.overlaps, `${direction} leaf-node overlaps`).toEqual([]);
    expect(
      geometry.edgeStyles.filter(
        (edge) =>
          edge.curve !== "segments" ||
          edge.routePoints < 2 ||
          edge.routePoints > 4,
      ),
      `${direction} orthogonal edge endpoints`,
    ).toEqual([]);

    if (direction === "RIGHT") expect(geometry.answer.x).toBeGreaterThan(geometry.input.x);
    if (direction === "LEFT") expect(geometry.answer.x).toBeLessThan(geometry.input.x);
    if (direction === "DOWN") expect(geometry.answer.y).toBeGreaterThan(geometry.input.y);
    if (direction === "UP") expect(geometry.answer.y).toBeLessThan(geometry.input.y);
  }

  const overlay = await page.locator(".cy-subgraph-title").boundingBox();
  const wrap = await page.locator(".cy-wrap").boundingBox();
  expect(overlay).not.toBeNull();
  expect(wrap).not.toBeNull();
  expect(overlay.x).toBeGreaterThanOrEqual(wrap.x);
  expect(overlay.y).toBeGreaterThanOrEqual(wrap.y);
  expect(overlay.x + overlay.width).toBeLessThanOrEqual(wrap.x + wrap.width);
  expect(overlay.y + overlay.height).toBeLessThanOrEqual(wrap.y + wrap.height);
});
