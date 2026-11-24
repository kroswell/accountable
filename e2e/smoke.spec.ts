import { test, expect } from "@playwright/test";

test("opens the populated sales cockpit", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /sales dashboard/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pipeline" })).toBeVisible();
});
