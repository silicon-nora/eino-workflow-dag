import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function settle(page) {
  await page.evaluate(
    () => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }),
  );
}

async function nodeCenter(page, key, parentKey) {
  return page.evaluate(({ nodeKey, parentNodeKey }) => {
    const access = Symbol.for("eino-workflow-dag.cytoscape");
    const cy = window.playground.instance[access]();
    const node = cy.nodes().filter((candidate) =>
      candidate.data("key") === nodeKey
        && candidate.parent().data("key") === parentNodeKey,
    ).first();
    const position = node.renderedPosition();
    const bounds = document.querySelector("#dag").getBoundingClientRect();
    return { x: bounds.left + position.x, y: bounds.top + position.y };
  }, { nodeKey: key, parentNodeKey: parentKey });
}

test("public playground validates, renders, and links nodes to protocol JSON", async ({ page }) => {
  await page.setViewportSize({ width: 1560, height: 980 });
  await page.goto("/.artifacts/pages/?lang=en");
  await page.waitForFunction(() => window.playground?.ready);
  await page.locator("#dag canvas").first().waitFor();

  await expect(page.locator("#validation-result")).toContainText("Valid schema-v1 snapshot");
  await expect(page.locator("#render-summary")).toContainText("9 nodes");
  await expect(page.locator("#theme-controls [data-theme]")).toHaveCount(3);
  expect(await page.evaluate(() => {
    const access = Symbol.for("eino-workflow-dag.cytoscape");
    const cy = window.playground.instance[access]();
    const draft = cy.nodes().filter((node) =>
      node.data("key") === "draft" && node.parent().data("key") === "research",
    ).first();
    return {
      component: draft.data("component"),
      kind: draft.data("kind"),
      label: draft.data("label"),
      lambdaLabels: cy.nodes().filter((node) =>
        String(node.data("label") || "").includes("Lambda"),
      ).length,
    };
  })).toEqual({
    component: "Lambda",
    kind: "llm",
    label: "Draft answer\nLLM  ·  606ms",
    lambdaLabels: 0,
  });

  await page.locator('[data-direction="DOWN"]').click();
  await page.locator('#theme-controls [data-theme="midnight"]').click();
  await settle(page);
  expect(await page.evaluate(() => window.playground.instance.getDirection())).toBe("DOWN");
  expect(await page.evaluate(() => window.playground.instance.getTheme())).toBe("midnight");

  const draftCenter = await nodeCenter(page, "draft", "research");
  await page.mouse.click(draftCenter.x, draftCenter.y);
  await expect(page.locator("#selected-path")).toHaveText("research / draft");
  expect(await page.locator("#snapshot-json").evaluate((editor) =>
    editor.value.slice(editor.selectionStart, editor.selectionEnd),
  )).toBe('"id": "draft"');

  await page.mouse.click(draftCenter.x, draftCenter.y);
  await expect(page.locator("#selected-path")).toHaveText("Click a node to locate it in the protocol");
  expect(await page.evaluate(() => ({
    activePath: window.playground.instance.getActiveNodePath(),
    highlightedNodes: window.playground.instance[Symbol.for("eino-workflow-dag.cytoscape")]()
      .nodes(".active-node").length,
    hoveredNodes: window.playground.instance[Symbol.for("eino-workflow-dag.cytoscape")]()
      .nodes(".hover").length,
  }))).toEqual({ activePath: null, highlightedNodes: 0, hoveredNodes: 0 });

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

test("public playground supports Chinese without resetting the workflow view", async ({ page }) => {
  await page.setViewportSize({ width: 1560, height: 980 });
  await page.goto("/.artifacts/pages/?lang=en");
  await page.waitForFunction(() => window.playground?.ready);
  await page.locator("#sample").selectOption("recovery");
  await page.locator('[data-direction="DOWN"]').click();
  await page.locator('#theme-controls [data-theme="midnight"]').click();
  const snapshotBefore = await page.locator("#snapshot-json").inputValue();

  await page.locator('[data-language="zh"]').click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page).toHaveTitle("Eino Workflow DAG · 在线演示");
  await expect(page.locator("#playground-title")).toContainText("读懂工作流");
  await expect(page.locator("#sample option:checked")).toHaveText("失败与恢复");
  await expect(page.locator("#validation-result")).toContainText("已在本地渲染");
  await expect(page.locator('[data-direction="RIGHT"] em')).toHaveText("向右");
  await expect(page.locator("#snapshot-json")).toHaveValue(/"name": "准备输入"/);
  await expect(page.locator("#snapshot-json")).toHaveValue(/"name": "主模型"/);
  expect(await page.locator("#snapshot-json").inputValue()).not.toBe(snapshotBefore);
  expect(await page.evaluate(() => ({
    language: window.playground.language,
    direction: window.playground.instance.getDirection(),
    theme: window.playground.instance.getTheme(),
    workflowName: window.playground.snapshot.workflow.name,
    nodeName: window.playground.snapshot.workflow.nodes[0].name,
    primaryLabel: window.playground.instance[Symbol.for("eino-workflow-dag.cytoscape")]()
      .nodes()
      .filter((node) => node.data("key") === "primary")
      .first()
      .data("label"),
  }))).toEqual({
    language: "zh",
    direction: "DOWN",
    theme: "midnight",
    workflowName: "容错生成",
    nodeName: "准备输入",
    primaryLabel: "主模型\n大模型  ·  311ms",
  });

  await page.reload();
  await page.waitForFunction(() => window.playground?.ready);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.locator("#sample").evaluate((select) => {
    select.value = "agent";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("#snapshot-json")).toHaveValue(/"name": "规范化请求"/);
  expect(new URL(page.url()).searchParams.get("lang")).toBe("zh");

  await page.locator("#snapshot-json").evaluate((editor) => {
    editor.value = editor.value.replace('"name": "规范化请求"', '"name": "自定义入口"');
  });
  await page.locator("#apply-json").click();
  await page.locator('[data-language="en"]').click();
  await expect(page.locator("#snapshot-json")).toHaveValue(/"name": "自定义入口"/);
});

test("public playground remains usable across narrow, tablet, and desktop screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/.artifacts/pages/?lang=zh");
  await page.waitForFunction(() => window.playground?.ready);
  await page.locator("#dag canvas").first().waitFor();

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 900 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    await settle(page);
    await expect(page.locator("#playground-title")).toBeVisible();
    await expect(page.locator("#snapshot-json")).toBeVisible();
    await expect(page.locator('[data-language="zh"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  }
});

test("public playground has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/.artifacts/pages/?lang=zh");
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
