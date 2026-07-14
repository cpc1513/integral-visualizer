import { expect, test } from "@playwright/test";

test("五类积分示例都能生成可视化", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page).toHaveTitle(/积分视界/);
  await expect(page.getByRole("heading", { name: "积分区域" })).toBeVisible();

  const cases = [
    ["普通积分", "绘制 x^2"],
    ["二重积分", "填充由"],
    ["三重积分", "三维积分立体"],
    ["曲线积分", "绘制参数"],
    ["曲面积分", "显示由参数"],
  ] as const;
  for (const [label, summary] of cases) {
    const selector = page.getByRole("radio", { name: new RegExp(label) });
    await selector.click();
    await expect(selector).toHaveAttribute("aria-checked", "true");
    await expect(page.locator(".visualization-panel > .sr-only")).toContainText(summary, { timeout: 20_000 });
    await expect(page.locator(".plot-stage")).toHaveAttribute("data-state", "ready", { timeout: 20_000 });
    await expect(page.locator(".plot-error")).toHaveCount(0);
  }

  expect(browserErrors).toEqual([]);
});

test("机考题可以一键载入计算台", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "机考题库" }).click();
  await expect(page).toHaveURL(/#\/computer-exams$/);
  await expect(page.locator(".computer-answer .katex").first()).toBeAttached({ timeout: 15_000 });
  const loadButton = page.getByRole("button", { name: /一键在计算台可视化/ }).first();
  await expect(loadButton).toBeVisible({ timeout: 15_000 });
  await loadButton.click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator(".plot-stage")).toHaveAttribute("data-state", "ready", { timeout: 20_000 });
});

test("无法解析的完整公式不会进入计算模型", async ({ page }) => {
  await page.goto("/");
  const formula = page.locator('math-field[aria-label="输入完整积分公式"]');
  await formula.evaluate((element) => {
    const mathfield = element as HTMLElement & { setValue: (value: string) => void };
    mathfield.setValue("\\int");
    mathfield.dispatchEvent(new InputEvent("input", { bubbles: true }));
  });

  await expect(page.locator(".formula-editor-error")).toContainText("不会用于计算或可视化");
  await expect(page.getByRole("button", { name: "计算并可视化" })).toBeDisabled();
});
