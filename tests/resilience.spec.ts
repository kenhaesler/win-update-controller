import { openToolbarMenu } from "./toolbar.helpers";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demoScan, demoStatus } from "../src/demo";

test("compact keyboard navigation and policy dialog restore focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto("/");
  const read = page.getByRole("button", { name: "Read about Display driver" });
  await read.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "All updates", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(read).toBeFocused();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const restore = page.getByRole("button", {
    name: "Restore previous policy",
    exact: true,
  });
  await restore.click();
  await page.keyboard.press("Escape");
  await expect(restore).toBeFocused();
});

test("native failures keep status truthful and history retryable", async ({
  page,
}) => {
  await page.addInitScript(
    ({ status, scan }) => {
      const state = window as unknown as {
        isTauri: boolean;
        __TAURI_INTERNALS__: object;
        __TAURI_EVENT_PLUGIN_INTERNALS__: object;
        commands: string[];
      };
      state.isTauri = true;
      state.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
      state.commands = [];
      localStorage.setItem("update-controller.scan.v1", JSON.stringify(scan));
      state.__TAURI_INTERNALS__ = {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: async (
          cmd: string,
          args: { request?: { command: string } },
        ) => {
          if (cmd !== "windows_request") return 1;
          const action = args.request!.command;
          state.commands.push(action);
          if (action === "status") return status;
          if (action === "history")
            throw new Error("Windows history is temporarily unavailable.");
          throw new Error("Unexpected operation: " + action);
        },
      };
    },
    { status: { ...demoStatus, agentDisabled: false }, scan: demoScan },
  );
  await page.goto("/");
  await expect(
    page.getByText("Manual mode configured", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Updates wait for your approval.")).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Read about Windows security update" })
    .click();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Couldn’t read update history" }),
  ).toBeVisible();
  await expect(page.getByText("Reading history…", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  const commands = await page.evaluate(
    () => (window as unknown as { commands: string[] }).commands,
  );
  expect(commands).not.toContain("download");
  expect(commands).not.toContain("install");
  expect(commands).not.toContain("enableManual");
});

test("dark and light primary surfaces meet automated accessibility checks", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Manual control active")).toBeVisible();
  for (const theme of ["dark", "light"]) {
    if (theme === "light") {
      await page.getByRole("button", { name: "Switch to light theme" }).click();
      await expect(page.locator(".nav-item.active")).toHaveCSS(
        "color",
        "rgb(7, 94, 159)",
      );
    }
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations,
      JSON.stringify(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ),
    ).toEqual([]);
  }
});

test("native hide partial failures preserve failed packages and cache successes", async ({
  page,
}) => {
  await page.addInitScript(
    ({ status, scan }) => {
      const state = window as unknown as {
        isTauri: boolean;
        __TAURI_INTERNALS__: object;
        __TAURI_EVENT_PLUGIN_INTERNALS__: object;
      };
      state.isTauri = true;
      state.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
      if (!localStorage.getItem("update-controller.scan.v1"))
        localStorage.setItem("update-controller.scan.v1", JSON.stringify(scan));
      state.__TAURI_INTERNALS__ = {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: async (
          cmd: string,
          args: {
            request?: {
              command: string;
              updates: { id: string; revision: number }[];
            };
          },
        ) => {
          if (cmd !== "windows_request") return 1;
          if (args.request?.command === "status") return status;
          if (args.request?.command === "hide")
            return {
              results: args.request.updates.map((u, i) => ({
                ...u,
                success: i === 0,
                error: i === 0 ? null : "Windows refused this update.",
              })),
            };
          throw new Error("Unexpected operation");
        },
      };
    },
    { status: demoStatus, scan: demoScan },
  );
  await page.goto("/");
  await page
    .getByRole("checkbox", { name: "Select Windows security update" })
    .check();
  await page.getByRole("checkbox", { name: "Select Display driver" }).check();
  await page.getByRole("button", { name: "Hide selected" }).click();
  await expect(page.getByRole("status")).toContainText("1 update hidden");
  await expect(page.getByRole("alert")).toContainText(
    "Display driver: Windows refused",
  );
  await expect(
    page.getByRole("checkbox", { name: "Select Display driver" }),
  ).not.toBeChecked();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Select Windows security update" }),
  ).toHaveCount(0);
  await openToolbarMenu(page, "More update filters");
  await page.getByRole("button", { name: "Hidden", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Select Windows security update" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/hidden-updates.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 700, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
