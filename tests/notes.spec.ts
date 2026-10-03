import { test, expect } from "@playwright/test";
import { demoScan, demoStatus } from "../src/demo";

test("late notes cannot replace the next package's notes or loading state", async ({ page }) => {
  await page.addInitScript(({ scan, status }) => {
    const state = window as any;
    state.isTauri = true;
    state.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
    localStorage.setItem("update-controller.scan.v1", JSON.stringify(scan));
    const pending: Array<() => void> = [];
    state.finishNotes = (index: number) => pending[index]();
    state.__TAURI_INTERNALS__ = {
      transformCallback: () => 1, unregisterCallback: () => {},
      invoke: async (cmd: string, args: any) => {
        if (cmd !== "windows_request") return 1;
        if (args.request.command === "status") return status;
        if (args.request.command === "appRelease") return { version: "0.1.3" };
        if (args.request.command === "notes") {
          const index = pending.length;
          return new Promise(resolve => pending.push(() => resolve({
            source: args.request.url, retrievedAt: new Date().toISOString(),
            title: `Notes ${index}`, sections: [{ heading: "Improvements", text: `Package notes ${index}` }],
            unavailableReason: null,
          })));
        }
        throw new Error("Unexpected command");
      },
    };
  }, { scan: demoScan, status: demoStatus });
  await page.goto("/");
  await page.getByRole("button", { name: "Read about Windows security update" }).click();
  await page.getByRole("button", { name: "Load official notes here" }).click();
  await page.getByRole("button", { name: "Read about .NET reliability update" }).click();
  await expect(page.getByRole("button", { name: "Load official notes here" })).toBeEnabled();
  await page.getByRole("button", { name: "Load official notes here" }).click();
  await page.evaluate(() => (window as any).finishNotes(0));
  await expect(page.getByRole("button", { name: "Reading official notes…" })).toBeDisabled();
  await expect(page.getByText("Package notes 0")).toHaveCount(0);
  await page.evaluate(() => (window as any).finishNotes(1));
  await page.getByText("Improvements", { exact: true }).click();
  await expect(page.getByText("Package notes 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Read about Windows security update" }).click();
  await expect(page.getByText("Package notes 1")).toHaveCount(0);
});
