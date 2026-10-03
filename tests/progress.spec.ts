import { test, expect } from "@playwright/test";
import { demoScan, demoStatus } from "../src/demo";
test("Windows progress reports package estimates and clears only after the final result", async ({ page }) => {
  await page.addInitScript(({ scan, status }) => {
    const state = window as any; state.isTauri = true;
    const callbacks: Record<number, any> = {}; const listeners: Record<string, any> = {}; let next = 0;
    state.emitProgress = (payload: any) => listeners["operation-progress"]?.({ event: "operation-progress", id: 1, payload });
    state.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
    localStorage.setItem("update-controller.scan.v1", JSON.stringify(scan));
    state.__TAURI_INTERNALS__ = {
      transformCallback: (fn: any) => { callbacks[++next] = fn; return next; }, unregisterCallback: () => {},
      invoke: async (cmd: string, args: any) => {
        if (cmd === "plugin:event|listen") { listeners[args.event] = callbacks[args.handler]; return next; }
        if (cmd !== "windows_request") return 1;
        if (args.request.command === "status") return status;
        if (args.request.command === "appRelease") return { version: "0.1.3" };
        if (args.request.command === "review") return { updates: scan.updates.slice(0, 1), licenses: [], reviewToken: "test", action: "install" };
        if (args.request.command === "install") return new Promise(resolve => state.finishOperation = () => resolve({ id: "11111111-1111-1111-1111-111111111111", action: "install", state: "completed", startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), results: [{ id: scan.updates[0].id, title: scan.updates[0].title, result: "Succeeded" }], restartRequired: false, message: "Operation finished" }));
        if (args.request.command === "history") return { entries: [], lastOperation: null };
        throw Error("Unexpected command");
      },
    };
  }, { scan: { ...demoScan, updates: demoScan.updates.map(u => ({ ...u, downloaded: true })) }, status: demoStatus });
  await page.goto("/");
  await page.getByRole("checkbox", { name: "Select Windows security update" }).check();
  await page.getByRole("button", { name: "Review installation", exact: true }).click();
  await page.getByRole("button", { name: "Install these updates", exact: true }).click();
  await page.waitForFunction(() => typeof (window as any).finishOperation === "function");
  const report = { operationId: "11111111-1111-1111-1111-111111111111", action: "install", percent: 25, currentPercent: 50, index: 1, count: 1, title: "Windows security update", bytesDownloaded: null, totalBytes: null, elapsedSeconds: 65 };
  await page.evaluate(report => (window as any).emitProgress(report), report);
  await expect(page.getByRole("progressbar", { name: "Overall update progress" })).toHaveAttribute("value", "25");
  await expect(page.getByText(/Installing package 1 of 1: Windows security update/)).toBeVisible();
  await expect(page.getByText(/1m 5s elapsed/)).toBeVisible();
  await page.evaluate(report => (window as any).emitProgress({ ...report, percent: 500 }), report);
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "25");
  await page.setViewportSize({ width: 700, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/progress-compact.png" });
  await page.evaluate(() => (window as any).finishOperation());
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Operation finished");
});
