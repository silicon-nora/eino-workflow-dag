import { expect, test } from "@playwright/test";

test("README quick start renders its first workflow with packaged styles", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.locator("#workflow canvas").first().waitFor();

  await expect(page.locator("#workflow").locator("..")).toHaveClass(
    /eino-workflow-dag-host/,
  );
  await expect(page.locator("#workflow")).toHaveAttribute("tabindex", "0");
  await expect(page.locator("#workflow")).toHaveAttribute("aria-label", /2 nodes/);
  expect(await page.locator("#workflow canvas").count()).toBeGreaterThan(0);
  expect(await page.locator("#workflow + .cy-overlays").count()).toBe(1);
  expect(await page.locator("#workflow + .cy-overlays").evaluate(
    (element) => getComputedStyle(element).position,
  )).toBe("absolute");
  expect(await page.evaluate(() => ({
    update: typeof window.quickstartView?.update,
    destroy: typeof window.quickstartView?.destroy,
  }))).toEqual({ update: "function", destroy: "function" });
  expect(process.env.QUICKSTART_PACKAGE_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  expect(errors).toEqual([]);
});
