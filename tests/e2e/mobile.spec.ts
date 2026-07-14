import { expect, test } from "@playwright/test";

test("移动端首页不产生横向溢出且核心控件可用", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "在线计算", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /计算并可视化/ })).toBeVisible();
  await expect(page.locator(".plot-stage")).toHaveAttribute("data-state", "ready", { timeout: 20_000 });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("移动端点击参数框后参数 math-field 能获得焦点", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".plot-stage")).toHaveAttribute("data-state", "ready", { timeout: 20_000 });

  const lowerBoundField = page.locator(".bound-row math-field").nth(1);
  await lowerBoundField.tap();

  await expect.poll(() =>
    lowerBoundField.evaluate((element) => document.activeElement === element || element.matches(":focus-within")),
  ).toBe(true);
});
