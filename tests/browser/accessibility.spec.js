import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const hosts = [
  { name: "vanilla UMD", url: "/examples/vanilla/", canvas: "#dag canvas" },
  { name: "Vue", url: "/examples/vue/", canvas: ".eino-workflow-dag-vue canvas" },
  { name: "React", url: "/.artifacts/examples/react/", canvas: ".eino-workflow-dag-react canvas" },
];

for (const host of hosts) {
  test(`${host.name} host has no serious automated accessibility violations`, async ({
    page,
  }) => {
    await page.goto(host.url);
    await page.locator(host.canvas).first().waitFor();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const violations = results.violations
      .filter((violation) => ["serious", "critical"].includes(violation.impact))
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        targets: violation.nodes.flatMap((node) => node.target),
      }));
    expect(violations).toEqual([]);
  });
}

test("keyboard navigation announces and activates workflow nodes", async ({
  page,
}) => {
  await page.goto("/examples/vanilla/");
  await page.locator("#dag canvas").first().waitFor();

  const dag = page.locator("#dag");
  await expect(dag).toHaveAttribute("tabindex", "0");
  await expect(dag).toHaveAttribute("aria-keyshortcuts", /Home.*Enter.*Escape/);
  const graphLabel = await dag.getAttribute("aria-label");

  await dag.focus();
  await page.keyboard.press("Home");
  await expect(dag).toHaveAttribute("aria-label", /Focused workflow node/);
  const focused = await page.evaluate(() => {
    const access = Symbol.for("eino-workflow-dag.cytoscape");
    return window.dagInstance[access]()
      .nodes(".keyboard-focus")
      .map((node) => node.id());
  });
  expect(focused).toHaveLength(1);

  const before = await page.evaluate(() => window.dagEvents.length);
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => window.dagEvents.length))
    .toBe(before + 1);
  expect(
    await page.evaluate(() => window.lastDagNodeClick.path.join("/")),
  ).toBe(focused[0]);

  await page.keyboard.press("Escape");
  expect(await dag.getAttribute("aria-label")).toBe(graphLabel);
  expect(
    await page.evaluate(() => {
      const access = Symbol.for("eino-workflow-dag.cytoscape");
      return window.dagInstance[access]().nodes(".keyboard-focus").length;
    }),
  ).toBe(0);
});
