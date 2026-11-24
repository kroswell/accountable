import { test, expect } from "@playwright/test";

test("opens the populated sales cockpit", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sales cockpit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Revenue won" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pipeline funnel" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pipeline board" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pipeline" })).toBeVisible();
});
