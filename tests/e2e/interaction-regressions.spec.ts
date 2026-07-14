import { expect, test } from "@playwright/test";

test("ordinary and double plots default to pan interactions", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".plot-stage")).toHaveAttribute("data-state", "ready", { timeout: 20_000 });
  await expect
    .poll(() => page.locator(".js-plotly-plot").evaluate((element) => (element as any)._fullLayout?.dragmode))
    .toBe("pan");

  await page.locator(".integral-type-button").nth(1).click();
  await expect(page.locator(".plot-stage")).toHaveAttribute("data-state", "ready", { timeout: 20_000 });
  await expect
    .poll(() => page.locator(".js-plotly-plot").evaluate((element) => (element as any)._fullLayout?.dragmode))
    .toBe("pan");
});
