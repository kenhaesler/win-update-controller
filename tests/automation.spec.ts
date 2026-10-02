import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demoScan, demoStatus } from "../src/demo";

async function nativeMock(
  page: Page,
  options = {
    startupScan: true,
    autoDefender: true,
    pending: false,
    fail: false,
  },
) {
  await page.addInitScript(
    ({ scan, status, options }) => {
      const state = window as unknown as {
        isTauri: boolean;
        __TAURI_INTERNALS__: object;
        __TAURI_EVENT_PLUGIN_INTERNALS__: object;
        calls: { command: string; updates?: { id: string }[] }[];
      };
      state.isTauri = true;
      state.calls = [];
      state.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
      localStorage.setItem(
        "update-controller.preferences.v1",
        JSON.stringify({ controllerUpdates: true, ...options }),
      );
      const defender = {
        ...scan.updates[0],
        id: "b0000000-0000-0000-0000-000000000001",
        title: "Defender intelligence",
        kbIds: ["2267602"],
        restart: "Not expected",
        autoInstallEligible: true,
      };
      let installed = false;
      state.__TAURI_INTERNALS__ = {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: async (
          cmd: string,
          args: { request?: { command: string; updates?: { id: string }[] } },
        ) => {
          if (cmd !== "windows_request") return 1;
          const request = args.request!;
          state.calls.push(request);
          if (request.command === "appRelease") return { version: "v99.0.0" };
          if (request.command === "status")
            return { ...status, restartPending: options.pending };
          if (request.command === "scan")
            return {
              ...scan,
              updates: [
                ...scan.updates,
                ...(!installed
                  ? [
                      defender,
                      {
                        ...defender,
                        id: "b0000000-0000-0000-0000-000000000002",
                        hidden: true,
                      },
                    ]
                  : []),
              ],
            };
          if (request.command === "autoDefender") {
            if (options.fail)
              throw new Error("Administrator approval was cancelled.");
            installed = true;
            return {
              id: "op",
              state: "completed",
              action: "install",
              results: [],
              restartRequired: false,
              message: "Succeeded",
            };
          }
          if (request.command === "history")
            return { entries: [], lastOperation: null };
          throw new Error("Unexpected command " + request.command);
        },
      };
    },
    { scan: demoScan, status: demoStatus, options },
  );
}
const calls = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          calls: { command: string; updates?: { id: string }[] }[];
        }
      ).calls,
  );

test("startup scan installs only eligible visible Defender and suggests a controller release", async ({
  page,
}) => {
  await nativeMock(page);
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText(
    "Defender automation: Succeeded",
  );
  await expect(
    page.getByRole("button", { name: "View release" }),
  ).toBeVisible();
  const requests = await calls(page);
  expect(requests.filter((r) => r.command === "autoDefender")).toEqual([
    {
      command: "autoDefender",
      updates: [{ id: "b0000000-0000-0000-0000-000000000001", revision: 1 }],
    },
  ]);
  expect(requests.filter((r) => r.command === "scan")).toHaveLength(2);
  expect(requests.filter((r) => r.command === "appRelease")).toHaveLength(1);
});
test("disabled startup scanning waits for a manual check", async ({ page }) => {
  await nativeMock(page, {
    startupScan: false,
    autoDefender: false,
    pending: false,
    fail: false,
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "View release" }),
  ).toBeVisible();
  expect((await calls(page)).some((r) => r.command === "scan")).toBe(false);
  await page
    .getByRole("button", { name: "Check for updates", exact: true })
    .first()
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Nothing was downloaded or installed",
  );
});

test("a pending restart prevents Defender automation", async ({ page }) => {
  await nativeMock(page, {
    startupScan: true,
    autoDefender: true,
    pending: true,
    fail: false,
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText(
    "Defender automation skipped",
  );
  expect((await calls(page)).some((r) => r.command === "autoDefender")).toBe(
    false,
  );
});
test("startup scans remain read-only unless installation is enabled", async ({
  page,
}) => {
  await nativeMock(page, {
    startupScan: true,
    autoDefender: false,
    pending: false,
    fail: false,
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText(
    "Nothing was downloaded or installed",
  );
  expect((await calls(page)).some((r) => r.command === "autoDefender")).toBe(
    false,
  );
});
test("cancelled administrator approval is reported without retrying", async ({
  page,
}) => {
  await nativeMock(page, {
    startupScan: true,
    autoDefender: true,
    pending: false,
    fail: true,
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Administrator approval was cancelled",
  );
  await expect(
    page.getByRole("button", { name: "Check for updates", exact: true }),
  ).toBeEnabled();
  expect(
    (await calls(page)).filter((r) => r.command === "autoDefender"),
  ).toHaveLength(1);
});
test("settings persist and remain accessible across themes and compact layout", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Check Windows updates on startup" })
    .check();
  await page
    .getByRole("checkbox", { name: "Automatically install Defender updates" })
    .check();
  await page
    .getByRole("checkbox", {
      name: "Check for controller updates",
      exact: true,
    })
    .uncheck();
  await page.reload();
  await expect(page.getByRole("status")).toContainText(
    "No eligible Defender updates",
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("checkbox", {
      name: "Automatically install Defender updates",
    }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", {
      name: "Check for controller updates",
      exact: true,
    }),
  ).not.toBeChecked();
  for (const theme of ["dark", "light"]) {
    if (theme === "light") {
      await page.getByRole("button", { name: "Light", exact: true }).click();
      await expect(page.locator(".nav-item.active")).toHaveCSS(
        "color",
        "rgb(7, 94, 159)",
      );
    }
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.locator(".settings-page").evaluate((el) => (el.scrollTop = 260));
    await page.screenshot({ path: `test-results/automation-${theme}.png` });
  }
  await page.setViewportSize({ width: 700, height: 800 });
  await page.screenshot({ path: "test-results/automation-compact.png" });
});
