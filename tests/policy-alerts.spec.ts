import { test, expect } from "@playwright/test";
import { demoStatus } from "../src/demo";
test("policy monitoring notifies once per change and honors native alert preference", async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(status => {
    const state = window as any;
    state.isTauri = true;
    state.liveStatus = status; state.notifications = [];
    state.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
    state.__TAURI_INTERNALS__ = { transformCallback: () => 1, unregisterCallback: () => {},
      invoke: async (cmd: string, args: any) => {
        if (cmd === "notify_policy_change") { state.notifications.push(args.message); return; }
        if (cmd !== "windows_request") return 1;
        if (args.request.command === "status") return structuredClone(state.liveStatus);
        if (args.request.command === "appRelease") return { version: "0.1.3" };
        throw Error("Unexpected command");
      } };
  }, demoStatus);
  await page.goto("/");
  await expect(page.getByText("Manual mode configured", { exact: true }).first()).toBeVisible();
  await page.evaluate(() => { (window as any).liveStatus.manualConfigured = false; });
  await page.clock.fastForward(60_001);
  await expect(page.getByRole("status")).toContainText("outside the controller");
  await page.clock.fastForward(60_001);
  expect(await page.evaluate(() => (window as any).notifications.length)).toBe(1);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("checkbox", { name: "Notify when update control changes" }).uncheck();
  await page.evaluate(() => { (window as any).liveStatus.conflicts = ["An organization manages this PC."]; });
  await page.clock.fastForward(60_001);
  await expect(page.getByRole("status")).toContainText("conflicts changed");
  expect(await page.evaluate(() => (window as any).notifications.length)).toBe(1);
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Notify when update control changes" })).not.toBeChecked();
});
