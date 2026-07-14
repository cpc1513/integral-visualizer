import { expect, test } from "@playwright/test";

test("移动端首页不产生横向溢出且核心控件可用", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "在线计算", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /计算并可视化/ })).toBeVisible();
  await expect(page.locator(".plot-stage")).toHaveAttribute("data-state", "ready", { timeout: 20_000 });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
