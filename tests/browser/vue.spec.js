import { expect, test } from "@playwright/test";

test("Vue wrapper mounts, updates incrementally, and cleans up", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/examples/vue/");
  await page.locator(".eino-workflow-dag-vue canvas").first().waitFor();
  await expect
    .poll(() => page.evaluate(() => window.vueDagInstance?.cy().nodes().length))
    .toBe(2);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.vueDagInstance.cy().getElementById("answer").hasClass("active-node"),
      ),
    )
    .toBe(true);
  await page.evaluate(() => {
    window.vueDagActiveNodeId.value = "input";
  });
  await expect
    .poll(() => page.evaluate(() => window.vueDagComponent.value.getActiveNodeId()))
    .toBe("input");
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.vueDagInstance.cy().getElementById("input").hasClass("active-node"),
      ),
    )
    .toBe(true);

  const answerPosition = await page.evaluate(() =>
    window.vueDagInstance.cy().getElementById("answer").position(),
  );
  await page.evaluate(() => {
    const next = JSON.parse(JSON.stringify(window.vueDagRoot.value));
    next.nodes.find((node) => node.id === "answer").status = "success";
    window.vueDagRoot.value = next;
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.vueDagInstance.cy().getElementById("answer").data("status"),
      ),
    )
    .toBe("success");
  await expect(
    page.evaluate(() =>
      window.vueDagInstance.cy().getElementById("answer").position(),
    ),
  ).resolves.toEqual(answerPosition);

  await page.evaluate(() => {
    window.vueDagDirection.value = "DOWN";
  });
  await expect
    .poll(() => page.evaluate(() => window.vueDagInstance.getDirection()))
    .toBe("DOWN");

  await page.evaluate(() => window.vueDagComponent.value.setDirection("LEFT"));
  await expect
    .poll(() => page.evaluate(() => window.vueDagComponent.value.getDirection()))
    .toBe("LEFT");
  await page.evaluate(() => window.vueDagComponent.value.setTheme("midnight"));
  await expect
    .poll(() => page.evaluate(() => window.vueDagComponent.value.getTheme()))
    .toBe("midnight");
  await page.evaluate(() => window.vueDagComponent.value.setActiveNodeId("answer"));
  await expect
    .poll(() => page.evaluate(() => window.vueDagComponent.value.getActiveNodeId()))
    .toBe("answer");

  await page.evaluate(() => {
    window.vueDagLocale.value = {
      statuses: { success: "完成" },
      tooltip: { status: "状态" },
    };
  });
  await expect
    .poll(() => page.evaluate(() => window.vueDagComponent.value.getLocale().statuses.success))
    .toBe("完成");
  await expect(
    page.evaluate(() => ({
      subgraphs: window.vueDagComponent.value.listSubgraphs().length,
    })),
  ).resolves.toEqual({ subgraphs: 0 });
  await expect
    .poll(() =>
      page.evaluate(() => window.vueDagComponent.value.getDiagnostics().layoutRuns),
    )
    .toBeGreaterThan(0);

  await page.evaluate(() => {
    window.vueDagRoot.value = {
      version: 2,
      nodes: [{ id: "invalid-edges" }],
      edges: "not-an-array",
    };
  });
  await expect
    .poll(() => page.evaluate(() => window.vueDagEvents.at(-1)?.type))
    .toBe("error");
  await expect
    .poll(() => page.evaluate(() => window.vueDagInstance.cy().nodes().length))
    .toBe(2);

  await page.evaluate(() => {
    window.vueDagInstance.cy().getElementById("answer").emit("tap");
  });
  await expect.poll(() => page.evaluate(() => window.vueDagEvents.at(-1))).toEqual({
    type: "node",
    id: "answer",
  });

  await page.evaluate(() => window.vueDagApp.unmount());
  await expect(page.locator(".eino-workflow-dag-vue")).toHaveCount(0);
  expect(errors).toEqual([]);
});
