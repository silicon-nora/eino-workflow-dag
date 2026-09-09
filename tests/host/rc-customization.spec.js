import { expect, test } from "@playwright/test";

const appearances = ["classic", "ink", "compact", "observatory"];
const directions = ["RIGHT", "DOWN", "LEFT", "UP"];
const scenarios = ["success", "fallback", "failed", "unknown"];
const interactionDefaults = {
  expandOnNodeClick: true,
  tooltipOnHover: true,
  pinTooltipOnNodeClick: false,
  highlightEdgeOnClick: true,
  clearHighlightOnCanvasClick: true,
  keyboardNavigation: true,
  panOnDrag: true,
  zoomOnCtrlWheel: true,
};

function captureErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function openHost(page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.locator("#dag canvas").first().waitFor();
  await expect(page.locator("#observation-state")).toHaveText("布局已稳定");
  await expect(page.locator("#candidate-version")).toHaveText("1.0.0-rc.4");
}

async function waitForStable(page) {
  await expect(page.locator("#observation-state")).toHaveText("布局已稳定");
}

async function inspectHost(page) {
  return page.evaluate(() => {
    const cy = window.rcHost.cy;
    const failures = [];
    cy.nodes().filter((node) => node.visible()).forEach((node) => {
      const level = Number(node.data("level"));
      if (!Number.isInteger(level) || level < 0) failures.push(`${node.id()}:invalid-level`);
    });
    cy.edges().filter((edge) => edge.visible()).forEach((edge) => {
      const route = edge.scratch("einoWorkflowDAG")?._flowAbsRoute || [];
      if (route.length < 2) {
        failures.push(`${edge.id()}:missing-route`);
        return;
      }
      if (route.slice(1).some((point, index) => {
        const previous = route[index];
        return Math.abs(point.x - previous.x) > 1 && Math.abs(point.y - previous.y) > 1;
      })) {
        failures.push(`${edge.id()}:non-orthogonal-route`);
      }
    });
    return {
      failures,
      state: window.rcHost.state,
      diagnostics: window.rcHost.instance.getDiagnostics(),
      visibleNodes: cy.nodes().filter((node) => node.visible()).length,
      visibleEdges: cy.edges().filter((edge) => edge.visible()).length,
      canvases: document.querySelectorAll("#dag canvas").length,
      overlays: document.querySelectorAll(".cy-overlays").length,
      verdict: document.querySelector("#verdict")?.dataset.state,
      eventErrors: Array.from(document.querySelectorAll("#event-log strong"))
        .filter((element) => element.textContent === "error").length,
    };
  });
}

test("distinguishes paint-only and geometry-changing appearance presets", async ({ page }) => {
  const errors = captureErrors(page);
  await openHost(page);

  const initial = await page.evaluate(() => window.rcHost.instance.getDiagnostics());
  await page.locator('[data-appearance="ink"]').click();
  await waitForStable(page);
  const ink = await page.evaluate(() => ({
    state: window.rcHost.state,
    theme: window.rcHost.instance.getTheme(),
    diagnostics: window.rcHost.instance.getDiagnostics(),
  }));
  expect(ink.state.appearance).toBe("ink");
  expect(ink.theme).toBe("ink");
  expect(ink.diagnostics.layoutRuns).toBe(initial.layoutRuns);

  await page.locator('[data-appearance="compact"]').click();
  await waitForStable(page);
  const compact = await page.evaluate(() => {
    const node = window.rcHost.cy.getElementById("prepare");
    const target = window.rcHost.cy.getElementById("route");
    return {
      state: window.rcHost.state,
      theme: window.rcHost.instance.getTheme(),
      diagnostics: window.rcHost.instance.getDiagnostics(),
      width: node.width(),
      height: node.height(),
      gap:
        target.position("x") - target.width() / 2 -
        (node.position("x") + node.width() / 2),
    };
  });
  expect(compact.state.appearance).toBe("compact");
  expect(compact.theme.tokens.node.width).toBe(176);
  expect(compact.width).toBe(176);
  expect(compact.height).toBe(52);
  expect(compact.gap).toBeCloseTo(34, 3);
  expect(compact.diagnostics.layoutRuns).toBe(ink.diagnostics.layoutRuns + 1);

  await page.locator('[data-appearance="observatory"]').click();
  await waitForStable(page);
  const observatory = await page.evaluate(() => {
    const node = window.rcHost.cy.getElementById("prepare");
    const target = window.rcHost.cy.getElementById("route");
    return {
      state: window.rcHost.state,
      theme: window.rcHost.instance.getTheme(),
      diagnostics: window.rcHost.instance.getDiagnostics(),
      width: node.width(),
      height: node.height(),
      gap:
        target.position("x") - target.width() / 2 -
        (node.position("x") + node.width() / 2),
    };
  });
  expect(observatory.state.appearance).toBe("observatory");
  expect(observatory.theme.base).toBe("midnight");
  expect(observatory.width).toBe(242);
  expect(observatory.height).toBe(68);
  expect(observatory.gap).toBeCloseTo(58, 3);
  expect(observatory.diagnostics.layoutRuns).toBe(compact.diagnostics.layoutRuns + 1);
  expect((await inspectHost(page)).failures).toEqual([]);
  expect(errors).toEqual([]);
});

test("preserves host state while every interaction policy is remounted", async ({ page }) => {
  const errors = captureErrors(page);
  await openHost(page);

  await page.locator('[data-scenario="fallback"]').click();
  await page.locator('[data-direction="DOWN"]').click();
  await page.locator('[data-appearance="observatory"]').click();
  await page.locator("#toggle-expanded").click();
  await waitForStable(page);

  let expectedRemounts = 0;
  for (const [name, defaultValue] of Object.entries(interactionDefaults)) {
    const input = page.locator(`input[data-interaction="${name}"]`);
    await input.setChecked(!defaultValue);
    expectedRemounts += 1;
    await waitForStable(page);
    const disabled = await page.evaluate((policy) => ({
      state: window.rcHost.state,
      remounts: Number(document.querySelector("#metric-remounts")?.textContent),
      tabIndex: document.querySelector("#dag")?.getAttribute("tabindex"),
      panning: window.rcHost.cy.userPanningEnabled(),
      policy,
    }), name);
    expect(disabled.state).toMatchObject({
      scenario: "fallback",
      direction: "DOWN",
      appearance: "observatory",
      expanded: false,
      remounts: expectedRemounts,
    });
    expect(disabled.state.interaction[name]).toBe(!defaultValue);
    expect(disabled.remounts).toBe(expectedRemounts);
    if (name === "keyboardNavigation") expect(disabled.tabIndex).toBeNull();
    if (name === "panOnDrag") expect(disabled.panning).toBe(false);

    await input.setChecked(defaultValue);
    expectedRemounts += 1;
    await waitForStable(page);
    const restored = await page.evaluate((policy) => ({
      state: window.rcHost.state,
      tabIndex: document.querySelector("#dag")?.getAttribute("tabindex"),
      panning: window.rcHost.cy.userPanningEnabled(),
      policy,
    }), name);
    expect(restored.state.interaction[name]).toBe(defaultValue);
    expect(restored.state.remounts).toBe(expectedRemounts);
    if (name === "keyboardNavigation") expect(restored.tabIndex).toBe("0");
    if (name === "panOnDrag") expect(restored.panning).toBe(true);
  }

  const final = await inspectHost(page);
  expect(final.state).toMatchObject({
    scenario: "fallback",
    direction: "DOWN",
    appearance: "observatory",
    expanded: false,
    remounts: Object.keys(interactionDefaults).length * 2,
    interaction: interactionDefaults,
  });
  expect(final.canvases).toBeGreaterThan(0);
  expect(final.overlays).toBe(1);
  expect(final.failures).toEqual([]);
  expect(final.eventErrors).toBe(0);
  expect(await page.locator("#event-log li").count()).toBeLessThanOrEqual(8);
  expect(errors).toEqual([]);
});

test("keeps representative configuration combinations geometrically valid", async ({ page }) => {
  const errors = captureErrors(page);
  await openHost(page);

  for (let directionIndex = 0; directionIndex < directions.length; directionIndex += 1) {
    const direction = directions[directionIndex];
    await page.locator(`[data-direction="${direction}"]`).click();
    for (let appearanceIndex = 0; appearanceIndex < appearances.length; appearanceIndex += 1) {
      const appearance = appearances[appearanceIndex];
      const scenario = scenarios[(directionIndex + appearanceIndex) % scenarios.length];
      await page.locator(`[data-appearance="${appearance}"]`).click();
      await page.locator(`[data-scenario="${scenario}"]`).click();
      const shouldExpand = (directionIndex + appearanceIndex) % 2 === 0;
      const expanded = await page.evaluate(() => window.rcHost.state.expanded);
      if (expanded !== shouldExpand) await page.locator("#toggle-expanded").click();
      await waitForStable(page);

      const result = await inspectHost(page);
      expect(result.state, `${direction}/${appearance}/${scenario}`).toMatchObject({
        direction,
        appearance,
        scenario,
        expanded: shouldExpand,
      });
      expect(result.visibleNodes).toBeGreaterThanOrEqual(shouldExpand ? 5 : 4);
      expect(result.visibleEdges).toBeGreaterThan(0);
      expect(result.canvases).toBeGreaterThan(0);
      expect(result.overlays).toBe(1);
      expect(result.verdict).toBe("passed");
      expect(result.failures, `${direction}/${appearance}/${scenario}`).toEqual([]);
      expect(result.eventErrors).toBe(0);
    }
  }
  expect(errors).toEqual([]);
});
