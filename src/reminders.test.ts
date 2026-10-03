import { afterEach, expect, it, vi } from "vitest";
import { dueReminders, loadReminders, localDay, validDay } from "./reminders";
afterEach(() => vi.unstubAllGlobals());
it("validates calendar dates and uses the local calendar day", () => {
  expect(validDay("2026-02-30")).toBe(false);
  expect(validDay("2028-02-29")).toBe(true);
  expect(localDay(new Date(2026, 9, 4, 23, 59))).toBe("2026-10-04");
});
it("retains overdue reminders and rejects corrupt storage", () => {
  const r = { id: "id", revision: 1, title: "Package", reviewDate: "2026-10-03", reason: "Wait", notified: false };
  expect(dueReminders([r, { ...r, reviewDate: "2026-10-05" }], "2026-10-04")).toEqual([r]);
  vi.stubGlobal("localStorage", { getItem: () => JSON.stringify([r, { ...r, reviewDate: "invalid" }]) });
  expect(loadReminders()).toEqual([r]);
});
