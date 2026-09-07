import { expect, test } from "@playwright/test";

test("runs portable layout in a module worker", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/examples/plain/");
  const result = await page.evaluate(async () => {
    const { createLayoutWorkerClient } = await import("/dist/layout-worker.js");
    const worker = new Worker("/examples/plain/layout-worker.js", {
      type: "module",
    });
    const client = createLayoutWorkerClient(worker, {
      terminateOnDestroy: true,
    });
    const visible = {
      nodes: [
        {
          id: "a",
          key: "a",
          name: "A",
          parent: null,
          kind: "io",
          status: "success",
          cost_ms: 1,
          metrics: null,
          err_msg: "",
          expandable: false,
          subgraph: false,
          expanded: false,
        },
        {
          id: "b",
          key: "b",
          name: "B",
          parent: null,
          kind: "llm",
          status: "running",
          cost_ms: 2,
          metrics: null,
          err_msg: "",
          expandable: false,
          subgraph: false,
          expanded: false,
        },
      ],
      edges: [
        {
          id: "a->b",
          from: "a",
          to: "b",
          kind: "",
          stroke: "critical",
        },
      ],
      criticalPath: ["a", "b"],
      criticalCostMs: 3,
    };
    const layout = await client.run(visible, { direction: "LEFT" });
    const value = {
      direction: layout.profile.direction,
      a: layout.positions.a,
      b: layout.positions.b,
      pending: client.pendingCount(),
    };
    client.destroy();
    return value;
  });

  expect(result.direction).toBe("LEFT");
  expect(result.b.x).toBeLessThan(result.a.x);
  expect(result.pending).toBe(0);
  expect(errors).toEqual([]);
});
