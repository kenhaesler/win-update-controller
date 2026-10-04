import { test, expect } from "@playwright/test";
import { demoScan } from "../src/demo";
test("installation review shows dated cached issues and explicit unknown compatibility", async ({ page }) => {
  await page.addInitScript(scan => {
    localStorage.setItem(`update-controller.notes.${scan.updates[0].id}.1`, JSON.stringify({
      source: "https://support.microsoft.com/help/1234", title: "KB1234", retrievedAt: "2026-01-01T12:00:00Z",
      sections: [{ heading: "Known issues", text: "Some applications may fail to start." }], unavailableReason: null,
    }));
  }, demoScan);
  await page.goto("/");
  await page.getByRole("checkbox", { name: "Select Windows security update" }).check();
  await page.getByRole("checkbox", { name: "Select .NET reliability update" }).check();
  await page.getByRole("button", { name: "Download selected", exact: true }).click();
  await page.getByRole("button", { name: "Download these updates", exact: true }).click();
  await expect(page.getByRole("button", { name: "Check for updates", exact: true })).toBeEnabled();
  await page.getByRole("checkbox", { name: "Select Windows security update" }).check();
  await page.getByRole("checkbox", { name: "Select .NET reliability update" }).check();
  await page.getByRole("button", { name: "Review installation", exact: true }).click();
  const review = page.getByRole("dialog");
  await expect(review.getByText("Some applications may fail to start.", { exact: true })).toBeVisible();
  await expect(review.getByText(/at least a week old/)).toBeVisible();
  await expect(review.getByText("Known issues have not been checked for this package.", { exact: true })).toBeVisible();
  await expect(review.getByRole("button", { name: "Review Windows 25H2 health at Microsoft" })).toBeVisible();
  await review.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("A restart is required", { exact: false })).toHaveCount(0);
});
