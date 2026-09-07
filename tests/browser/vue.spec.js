import { expect, test } from "@playwright/test";

test("Vue wrapper mounts, updates incrementally, reports errors, and cleans up", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/examples/vue/");
  await page.locator(".eino-workflow-dag-vue canvas").first().waitFor();
  await page.evaluate(() => {
    const access = Symbol.for("eino-workflow-dag.cytoscape");
    window.getDAGCy = (instance) => instance[access]();
  });

  await expect.poll(() => page.evaluate(() =>
    window.getDAGCy(window.vueDagInstance).nodes().length,
  )).toBe(2);
  await page.evaluate(() => { window.vueDagActiveNodePath.value = ["input"]; });
  await expect.poll(() => page.evaluate(() =>
    window.vueDagComponent.value.getActiveNodePath(),
  )).toEqual(["input"]);

  const answerPosition = await page.evaluate(() =>
    window.getDAGCy(window.vueDagInstance).getElementById("answer").position(),
  );
  await page.evaluate(() => {
    const next = JSON.parse(JSON.stringify(window.vueDagRoot.value));
    next.execution.nodes.find((node) => node.path[0] === "answer").status = "success";
    window.vueDagRoot.value = next;
  });
  await expect.poll(() => page.evaluate(() =>
    window.getDAGCy(window.vueDagInstance).getElementById("answer").data("status"),
  )).toBe("success");
  expect(await page.evaluate(() =>
    window.getDAGCy(window.vueDagInstance).getElementById("answer").position(),
  )).toEqual(answerPosition);

  await page.evaluate(() => { window.vueDagDirection.value = "DOWN"; });
  await expect.poll(() => page.evaluate(() => window.vueDagInstance.getDirection())).toBe("DOWN");
  await page.evaluate(() => window.vueDagComponent.value.setTheme("midnight"));
  await expect.poll(() => page.evaluate(() => window.vueDagComponent.value.getTheme())).toBe("midnight");
  await page.evaluate(() => { window.vueDagLocale.value = { statuses: { success: "完成" } }; });
  await expect.poll(() => page.evaluate(() =>
    window.vueDagComponent.value.getLocale().statuses.success,
  )).toBe("完成");

  await page.evaluate(() => {
    window.vueDagRoot.value = {
      schemaVersion: 1,
      workflow: { nodes: [{ id: "invalid" }] },
    };
  });
  await expect.poll(() => page.evaluate(() => window.vueDagEvents.at(-1)?.type)).toBe("error");
  await expect.poll(() => page.evaluate(() =>
    window.getDAGCy(window.vueDagInstance).nodes().length,
  )).toBe(2);

  await page.evaluate(() => {
    window.getDAGCy(window.vueDagInstance).getElementById("answer").emit("tap");
  });
  await expect.poll(() => page.evaluate(() => window.vueDagEvents.at(-1))).toEqual({
    type: "node",
    path: ["answer"],
  });

  await page.evaluate(() => window.vueDagApp.unmount());
  await expect(page.locator(".eino-workflow-dag-vue")).toHaveCount(0);
  expect(errors).toEqual([]);
});
