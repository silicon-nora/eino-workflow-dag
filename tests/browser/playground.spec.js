import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function settle(page) {
  await page.evaluate(
    () => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }),
  );
}

test("public playground validates, renders, and links nodes to protocol JSON", async ({ page }) => {
  await page.setViewportSize({ width: 1560, height: 980 });
  await page.goto("/.artifacts/pages/");
  await page.waitForFunction(() => window.playground?.ready);
  await page.locator("#dag canvas").first().waitFor();

  await expect(page.locator("#validation-result")).toContainText("Valid schema-v1 snapshot");
  await expect(page.locator("#render-summary")).toContainText("9 nodes");
  await expect(page.locator("#theme-controls [data-theme]")).toHaveCount(3);

  await page.locator('[data-direction="DOWN"]').click();
  await page.locator('#theme-controls [data-theme="midnight"]').click();
  await settle(page);
  expect(await page.evaluate(() => window.playground.instance.getDirection())).toBe("DOWN");
  expect(await page.evaluate(() => window.playground.instance.getTheme())).toBe("midnight");

  await page.evaluate(() => {
    const access = Symbol.for("eino-workflow-dag.cytoscape");
    const cy = window.playground.instance[access]();
    cy.nodes().filter((node) =>
      node.data("key") === "draft" && node.parent().data("key") === "research",
    ).first().emit("tap");
  });
  await expect(page.locator("#selected-path")).toHaveText("research / draft");
  expect(await page.locator("#snapshot-json").evaluate((editor) =>
    editor.value.slice(editor.selectionStart, editor.selectionEnd),
  )).toBe('"id": "draft"');

  await page.locator("#sample").selectOption("recovery");
  await expect(page.locator("#render-summary")).toContainText("5 nodes");
  await expect(page.locator("#snapshot-json")).toHaveValue(/"status": "failed"/);

  await page.locator("#snapshot-json").evaluate((editor) => {
    editor.value = editor.value.replace('"kind": "llm"', '"kind": "unknown"');
  });
  await page.locator("#snapshot-json").focus();
  await page.keyboard.press("Control+Enter");
  await expect(page.locator("#validation-result")).toContainText("1 protocol issue");
  await expect(page.locator("#issue-list")).toContainText("invalid_node_kind");
  await expect(page.locator("#dag canvas").first()).toBeVisible();
});

test("public playground remains usable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/.artifacts/pages/");
  await page.waitForFunction(() => window.playground?.ready);
  await page.locator("#dag canvas").first().waitFor();

  await expect(page.locator("#playground-title")).toBeVisible();
  await expect(page.locator("#snapshot-json")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("public playground has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/.artifacts/pages/");
  await page.waitForFunction(() => window.playground?.ready);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const violations = results.violations
    .filter((violation) => ["serious", "critical"].includes(violation.impact))
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.flatMap((node) => node.target),
    }));
  expect(violations).toEqual([]);
});
