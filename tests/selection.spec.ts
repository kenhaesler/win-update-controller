import { test, expect } from "@playwright/test";

test("bulk selection replaces the selection with visible matches and downloaded matches", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Select visible (3)", exact: true }).click();
  await expect(page.getByText("3 updates selected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Security", exact: true }).click();
  await expect(page.getByText("No updates selected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Select visible (1)", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Select Windows security update" })).toBeChecked();
  await expect(page.getByRole("button", { name: "Select downloaded (0)", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Download selected", exact: true }).click();
  await page.getByRole("button", { name: "Download these updates", exact: true }).click();
  await expect(page.getByRole("button", { name: "Select downloaded (1)", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByRole("button", { name: "Select visible (3)", exact: true }).click();
  await page.getByRole("button", { name: "Select downloaded (1)", exact: true }).click();
  await expect(page.getByText("1 update selected", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review installation", exact: true })).toBeEnabled();
  await expect(page.getByRole("checkbox", { name: "Select .NET reliability update" })).not.toBeChecked();
});
