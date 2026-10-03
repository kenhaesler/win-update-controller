import { test, expect } from "@playwright/test";
import { demoScan, demoStatus } from "../src/demo";
test("activity history exports records and only reselects unresolved exact revisions", async ({ page }) => {
  await page.addInitScript(({ scan, status }) => {
    const state = window as any; state.isTauri = true; state.calls = [];
    state.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
    const operation = { id: "11111111-1111-1111-1111-111111111111", action: "install", state: "uncertain", startedAt: "2026-10-01T12:00:00Z", finishedAt: null, restartRequired: false, message: "Worker interrupted",
      results: scan.updates.map((u: any, i: number) => ({ id: u.id, revision: u.revision, title: u.title, result: i === 0 ? "Succeeded" : "Pending" })) };
    state.__TAURI_INTERNALS__ = { transformCallback: () => 1, unregisterCallback: () => {},
      invoke: async (cmd: string, args: any) => {
        if (cmd !== "windows_request") return 1;
        const request = args.request; state.calls.push(request.command);
        if (request.command === "status") return status;
        if (request.command === "appRelease") return { version: "0.1.3" };
        if (request.command === "history") return { entries: [], lastOperation: operation, operations: [operation, { ...operation, id: "22222222-2222-2222-2222-222222222222", action: "download", state: "completed", results: [] }] };
        if (request.command === "reconcile") return { ...operation, results: operation.results.map((r: any) => ({ ...r, observedState: "Currently installed" })) };
        if (request.command === "scan") return { ...scan, updates: scan.updates.map((u: any, i: number) => ({ ...u, downloaded: true, revision: i === 2 ? u.revision + 1 : u.revision })) };
        throw Error("Unexpected mutation: " + request.command);
      } };
  }, { scan: demoScan, status: demoStatus });
  await page.goto("/");
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.locator(".activity-entry")).toHaveCount(2);
  await page.getByRole("button", { name: "Inspect current package state", exact: true }).first().click();
  await expect(page.getByText("Currently installed", { exact: true })).toHaveCount(3);
  await expect(page.locator(".activity-entry").first()).toContainText("uncertain");
  await page.getByRole("textbox", { name: "Search history", exact: true }).fill("Worker interrupted");
  await expect(page.locator(".activity-entry")).toHaveCount(2);
  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export diagnostics", exact: true }).click();
  const stream = await (await exported).createReadStream();
  const chunks = []; for await (const chunk of stream!) chunks.push(chunk);
  const diagnostics = JSON.parse(Buffer.concat(chunks).toString());
  expect(diagnostics.history.operations).toHaveLength(2);
  await page.getByRole("button", { name: "Check unresolved packages", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Select .NET reliability update" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Select Windows security update" })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Select Display driver" })).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Review installation", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => (window as any).calls.some((c: string) => c === "install" || c === "download"))).toBe(false);
});
