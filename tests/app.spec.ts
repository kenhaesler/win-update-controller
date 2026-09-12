import { test, expect } from "@playwright/test";
test("reading and checking never select or install packages", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("INTERACTIVE PREVIEW")).toBeVisible();
  await page
    .getByRole("button", { name: "Read about .NET reliability update" })
    .click();
  await expect(
    page.getByRole("heading", { name: ".NET reliability update", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Select .NET reliability update" }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Download selected" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Check for updates", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Nothing was downloaded or installed",
  );
  await expect(
    page.getByRole("button", { name: "Download selected" }),
  ).toBeDisabled();
});
test("download, review, installation and history form distinct steps", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("checkbox", { name: "Select Windows security update" })
    .check();
  await page.getByRole("button", { name: "Download selected" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(
    "separate installation action",
  );
  await page.getByRole("button", { name: "Download these updates" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Your PC was not changed",
  );
  await expect(
    page.getByRole("button", { name: "Read about Windows security update" }),
  ).toContainText("Downloaded");
  await page
    .getByRole("checkbox", { name: "Select Windows security update" })
    .check();
  await page.getByRole("button", { name: "Review installation" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "will not restart automatically",
  );
  await page.getByRole("button", { name: "Install these updates" }).click();
  await expect(page.getByRole("status")).toContainText("A restart is required");
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Update history" }),
  ).toBeVisible();
  await expect(page.locator(".history-row")).toContainText(
    "Windows security update",
  );
});
test("cancel leaves policy untouched and keyboard Escape closes review", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Restore previous policy" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Configured", exact: true }),
  ).toBeDisabled();
});
test("compact layout opens and returns from details", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Read about Display driver" }).click();
  await expect(
    page.getByRole("heading", { name: "Display driver", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "All updates", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Available updates" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
