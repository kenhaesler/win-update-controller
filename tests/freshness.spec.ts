import { openToolbarMenu } from "./toolbar.helpers";
import { test, expect } from "@playwright/test";
import { demoScan, demoStatus } from "../src/demo";
test("cached results show age and a fresh scan highlights changed revisions", async ({ page }) => {
  await page.addInitScript(({ scan, status }) => {
    const state = window as any;
    state.isTauri = true;
    state.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
    localStorage.setItem("update-controller.scan.v1", JSON.stringify(scan));
    state.__TAURI_INTERNALS__ = { transformCallback: () => 1, unregisterCallback: () => {},
      invoke: async (cmd: string, args: any) => {
        if (cmd !== "windows_request") return 1;
        if (args.request.command === "status") return status;
        if (args.request.command === "appRelease") return { version: "0.1.3" };
        if (args.request.command === "scan") return { ...scan, checkedAt: new Date().toISOString(), updates: scan.updates.map((u: any, i: number) => i === 0 ? { ...u, revision: u.revision + 1 } : u) };
        throw Error("Unexpected command");
      } };
  }, { scan: { ...demoScan, checkedAt: new Date(Date.now() - 3 * 86_400_000).toISOString() }, status: demoStatus });
  await page.goto("/");
  await expect(page.getByText(/Cached results · 3 days ago/)).toBeVisible();
  await page.getByRole("combobox", { name: "Sort updates", exact: true }).selectOption("size");
  await expect(page.locator(".package-title").first()).toHaveText(".NET reliability update");
  await page.getByRole("button", { name: "Check for updates", exact: true }).click();
  await expect(page.getByText(/Last checked · less than a minute ago/)).toBeVisible();
  await expect(page.getByLabel("New since previous check")).toHaveCount(1);
  await openToolbarMenu(page, "More update filters");
  await page.getByRole("button", { name: "Downloaded", exact: true }).click();
  await openToolbarMenu(page, "Package selection tools");
  await expect(page.getByRole("button", { name: "Select visible (0)", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.screenshot({ path: "test-results/freshness-desktop.png" });
  await page.setViewportSize({ width: 700, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
