import { afterEach, expect, it, vi } from "vitest";
import { demoScan } from "./demo";
import { loadScanCache, loadTheme, writeStored } from "./storage";
afterEach(() => vi.unstubAllGlobals());
it("rejects incomplete, invalid and duplicate cached packages before rendering", () => {
  const bad = [null, {}, { ...demoScan, checkedAt: "bad" },
    { ...demoScan, updates: [{ id: "bad", title: "bad", bundles: [], supportUrls: [] }] },
    { ...demoScan, updates: [demoScan.updates[0], demoScan.updates[0]] },
    ...["kbIds", "size", "revision", "restart"].map(key => ({ ...demoScan, updates: [{ ...demoScan.updates[0], [key]: null }] }))];
  for (const value of bad) {
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(value) });
    expect(loadScanCache()).toBeNull();
  }
  vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(demoScan) });
  expect(loadScanCache()).toEqual(demoScan);
});
it("uses a safe theme and keeps rendering when storage is unavailable", () => {
  vi.stubGlobal("localStorage", { getItem: () => "unsupported" });
  expect(loadTheme()).toBe("dark");
  vi.stubGlobal("localStorage", { getItem: () => { throw Error("blocked"); }, setItem: () => { throw Error("full"); } });
  expect(loadTheme()).toBe("dark");
  expect(loadScanCache()).toBeNull();
  expect(writeStored("key", "value")).toBe(false);
});
