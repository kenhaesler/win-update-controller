import { test, expect } from "@playwright/test";
import { demoScan, demoStatus } from "../src/demo";
test("an interrupted installation offers read-only recovery and expandable technical details", async ({ page }) => {
  await page.addInitScript(({ scan, status }) => {
    const state = window as any;
    state.isTauri = true;
    state.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
    state.calls = [];
    localStorage.setItem("update-controller.scan.v1", JSON.stringify(scan));
    state.__TAURI_INTERNALS__ = { transformCallback: () => 1, unregisterCallback: () => {},
      invoke: async (cmd: string, args: any) => {
        if (cmd !== "windows_request") return 1;
        const request = args.request; state.calls.push(request.command);
        if (request.command === "status") return status;
        if (request.command === "appRelease") return { version: "0.1.3" };
        if (request.command === "review") return { updates: scan.updates.slice(0, 1), licenses: [], reviewToken: "test", action: "install" };
        if (request.command === "install") throw Error("Connection to the administrator helper ended (0x12345678)");
        if (request.command === "history") return { entries: [], lastOperation: null };
        throw Error("Unexpected command");
      } };
  }, { scan: { ...demoScan, updates: demoScan.updates.map(u => ({ ...u, downloaded: true })) }, status: demoStatus });
  await page.goto("/");
  await page.getByRole("checkbox", { name: "Select Windows security update" }).check();
  await page.getByRole("button", { name: "Review installation", exact: true }).click();
  await page.getByRole("button", { name: "Install these updates", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not be confirmed");
  await page.getByText("Technical details", { exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("0x12345678");
  await page.getByRole("button", { name: "Read status and history", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Update history", exact: true })).toBeVisible();
  expect((await page.evaluate(() => (window as any).calls)).filter((c: string) => c === "install")).toHaveLength(1);
});
