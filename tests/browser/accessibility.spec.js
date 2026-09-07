import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const hosts = [
  { name: "plain UMD", url: "/examples/plain/", canvas: "#dag canvas" },
  { name: "Vue", url: "/examples/vue/", canvas: ".eino-workflow-dag-vue canvas" },
  { name: "React", url: "/examples/react-dist/", canvas: ".eino-workflow-dag-react canvas" },
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
