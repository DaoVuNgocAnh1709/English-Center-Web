import { expect, test } from "@playwright/test";

test("homepage renders its primary conversion journey", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Học chắc nền tảng");
  await expect(page.getByRole("link", { name: /Đăng ký học thử/ }).first()).toBeVisible();
  await expect(page.locator("#dang-ky")).toBeAttached();
});

test("layout does not overflow its viewport", async ({ page }) => {
  await page.goto("/");
  const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
});
