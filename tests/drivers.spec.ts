import { test, expect } from "@playwright/test";
import { demoScan, demoStatus } from "../src/demo";
test("device exclusions require review and block replacement driver identities until removal", async ({ page }) => {
  const duplicateKeys: string[] = [];
  page.on("console", message => { if (message.text().includes("same key")) duplicateKeys.push(message.text()); });
  await page.addInitScript(({ scan, status }) => {
    const state = window as any; state.isTauri = true; state.calls = [];
    state.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
    localStorage.setItem("update-controller.scan.v1", JSON.stringify(scan));
    let rules: any[] = [];
    state.__TAURI_INTERNALS__ = { transformCallback: () => 1, unregisterCallback: () => {}, invoke: async (cmd: string, args: any) => {
      if (cmd !== "windows_request") return 1;
      const req = args.request; state.calls.push(req.command);
      if (req.command === "status") return status;
      if (req.command === "appRelease") return { version: "0.1.3" };
      if (req.command === "driverRules") return rules;
      if (req.command === "excludeDriver") {
        if (req.hardwareId !== scan.updates[2].driver!.hardwareId) throw Error("Wrong reviewed hardware ID");
        rules = [{ id: "11111111-1111-1111-1111-111111111111", hardwareId: req.hardwareId, label: "Display driver", createdAt: new Date().toISOString() }]; return rules;
      }
      if (req.command === "removeDriverRule") { rules = []; return rules; }
      if (req.command === "scan") return { ...scan, updates: scan.updates.map((u: any) => u.category === "Drivers" ? { ...u, id: "b0000000-0000-0000-0000-000000000003", revision: 2, excluded: rules.length > 0 } : u) };
      throw Error("Unexpected mutation: " + req.command);
    } };
  }, { scan: demoScan, status: demoStatus });
  await page.goto("/");
  await page.getByRole("button", { name: "Read about Display driver" }).click();
  await expect(page.getByRole("heading", { name: "Display driver", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Exclude future drivers for this ID", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Multiple devices may share it");
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => (window as any).calls.includes("excludeDriver"))).toBe(false);
  await page.getByRole("button", { name: "Exclude future drivers for this ID", exact: true }).click();
  await page.getByRole("button", { name: "Save device exclusion", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Device exclusion saved");
  await expect(page.getByRole("checkbox", { name: "Select Display driver" })).toHaveCount(0);
  await page.getByRole("button", { name: "Excluded", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Select Display driver" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Select visible (0)", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Select downloaded (0)", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Remove exclusion for Display driver", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Device exclusion removed");
  await page.getByRole("button", { name: "Updates", exact: true }).click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Select Display driver" })).toBeEnabled();
  expect(await page.evaluate(() => (window as any).calls.some((c: string) => ["download", "install", "hide"].includes(c)))).toBe(false);
  expect(duplicateKeys).toEqual([]);
});
