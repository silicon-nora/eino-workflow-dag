import { expect, test } from "@playwright/test";

test("React wrapper mounts, updates incrementally, and survives StrictMode", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/examples/react-dist/");
  await page.locator(".eino-workflow-dag-react canvas").first().waitFor();
  await expect
    .poll(() => page.evaluate(() => window.reactDagRef.current?.getInstance()?.cy().nodes().length))
    .toBe(2);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.reactDagRef.current
          .getInstance()
          .cy()
          .getElementById("answer")
          .hasClass("active-node"),
      ),
    )
    .toBe(true);
  await page.evaluate(() => window.setReactDagActiveNodeId("input"));
  await expect
    .poll(() => page.evaluate(() => window.reactDagRef.current.getActiveNodeId()))
    .toBe("input");

  const answerPosition = await page.evaluate(() =>
    window.reactDagRef.current
      .getInstance()
      .cy()
      .getElementById("answer")
      .position(),
  );
  await page.evaluate(() => {
    const instance = window.reactDagRef.current.getInstance();
    const next = {
      version: 2,
      nodes: [
        { id: "input", name: "Input", kind: "io", status: "success", cost_ms: 5 },
        { id: "answer", name: "Answer", kind: "llm", status: "success", cost_ms: 30 },
      ],
      edges: [{ from: "input", to: "answer" }],
    };
    window.setReactDagRoot(next);
    window.reactDagInstanceBeforeUpdate = instance;
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.reactDagRef.current
          .getInstance()
          .cy()
          .getElementById("answer")
          .data("status"),
      ),
    )
    .toBe("success");
  await expect(
    page.evaluate(() =>
      window.reactDagRef.current
        .getInstance()
        .cy()
        .getElementById("answer")
        .position(),
    ),
  ).resolves.toEqual(answerPosition);
  await expect(
    page.evaluate(
      () => window.reactDagRef.current.getInstance() === window.reactDagInstanceBeforeUpdate,
    ),
  ).resolves.toBe(true);

  await page.evaluate(() => window.setReactDagDirection("DOWN"));
  await expect
    .poll(() => page.evaluate(() => window.reactDagRef.current.getDirection()))
    .toBe("DOWN");

  await page.evaluate(() =>
    window.setReactDagLocale({ statuses: { success: "完成" } }),
  );
  await page.evaluate(() => window.reactDagRef.current.setActiveNodeId("answer"));
  await expect
    .poll(() => page.evaluate(() => window.reactDagRef.current.getActiveNodeId()))
    .toBe("answer");
  await expect
    .poll(() =>
      page.evaluate(
        () => window.reactDagRef.current.getLocale().statuses.success,
      ),
    )
    .toBe("完成");
  await expect(
    page.evaluate(() => ({
      theme: window.reactDagRef.current.getTheme(),
      subgraphs: window.reactDagRef.current.listSubgraphs().length,
    })),
  ).resolves.toEqual({ theme: "classic", subgraphs: 0 });
  await expect
    .poll(() =>
      page.evaluate(() => window.reactDagRef.current.getDiagnostics().layoutRuns),
    )
    .toBeGreaterThan(0);

  await page.evaluate(() => {
    window.reactDagRef.current
      .getInstance()
      .cy()
      .getElementById("answer")
      .emit("tap");
  });
  await expect.poll(() => page.evaluate(() => window.reactDagEvents.at(-1))).toEqual({
    type: "node",
    id: "answer",
  });

  await page.evaluate(() => window.unmountReactDag());
  await expect(page.locator(".eino-workflow-dag-react")).toHaveCount(0);
  expect(errors).toEqual([]);
});
