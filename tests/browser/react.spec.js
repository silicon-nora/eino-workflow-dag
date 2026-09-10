import { expect, test } from "@playwright/test";

test("React wrapper mounts, updates incrementally, and survives StrictMode", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/.artifacts/examples/react/");
  await page.locator(".eino-workflow-dag-react canvas").first().waitFor();
  await page.evaluate(() => {
    const access = Symbol.for("eino-workflow-dag.cytoscape");
    window.getDAGCy = (instance) => instance[access]();
  });

  await expect.poll(() => page.evaluate(() =>
    window.getDAGCy(window.reactDagRef.current?.getInstance()).nodes().length,
  )).toBe(2);
  await expect.poll(() => page.evaluate(() =>
    window.getDAGCy(window.reactDagRef.current.getInstance())
      .getElementById("answer").hasClass("active-node"),
  )).toBe(true);

  await page.evaluate(() => window.setReactDagActiveNodeId(["input"]));
  await expect.poll(() => page.evaluate(() =>
    window.reactDagRef.current.getActiveNodePath(),
  )).toEqual(["input"]);

  const before = await page.evaluate(() => ({
    position: window.getDAGCy(window.reactDagRef.current.getInstance())
      .getElementById("answer").position(),
  }));
  await page.evaluate(() => {
    const next = {
      schemaVersion: 1,
      workflow: {
        nodes: [
          { id: "input", name: "Input", component: "Lambda" },
          { id: "answer", name: "Answer", component: "ChatModel" },
        ],
        edges: [{ from: "input", to: "answer", channels: ["control", "data"] }],
      },
      execution: { nodes: [
        { path: ["input"], status: "success", durationMs: 5 },
        { path: ["answer"], status: "success", durationMs: 30 },
      ] },
    };
    window.reactDagInstanceBeforeUpdate = window.reactDagRef.current.getInstance();
    window.setReactDagRoot(next);
  });
  await expect.poll(() => page.evaluate(() =>
    window.getDAGCy(window.reactDagRef.current.getInstance())
      .getElementById("answer").data("status"),
  )).toBe("success");
  expect(await page.evaluate(() =>
    window.getDAGCy(window.reactDagRef.current.getInstance())
      .getElementById("answer").position(),
  )).toEqual(before.position);
  expect(await page.evaluate(() =>
    window.reactDagRef.current.getInstance() === window.reactDagInstanceBeforeUpdate,
  )).toBe(true);

  await page.evaluate(() => window.setReactDagDirection("DOWN"));
  await expect.poll(() => page.evaluate(() => window.reactDagRef.current.getDirection())).toBe("DOWN");
  await page.evaluate(() => window.setReactDagLocale({ statuses: { success: "完成" } }));
  await expect.poll(() => page.evaluate(() =>
    window.reactDagRef.current.getLocale().statuses.success,
  )).toBe("完成");

  await page.evaluate(() => {
    window.getDAGCy(window.reactDagRef.current.getInstance())
      .getElementById("answer").emit("tap");
  });
  await expect.poll(() => page.evaluate(() => window.reactDagEvents.at(-1))).toEqual({
    type: "node",
    path: ["answer"],
  });

  await page.evaluate(() => window.unmountReactDag());
  await expect(page.locator(".eino-workflow-dag-react")).toHaveCount(0);
  expect(errors).toEqual([]);
});
