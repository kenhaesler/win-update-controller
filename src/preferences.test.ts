import { describe, expect, it, vi, afterEach } from "vitest";
import { loadPreferences, newerVersion } from "./preferences";

afterEach(() => vi.unstubAllGlobals());
describe("automation preferences", () => {
  it("keeps installation opt-in with corrupt or unavailable storage", () => {
    for (const getItem of [
      () => "bad JSON",
      () => "null",
      () => {
        throw new Error("blocked");
      },
    ]) {
      vi.stubGlobal("localStorage", { getItem });
      expect(loadPreferences()).toEqual({
        controllerUpdates: true,
        startupScan: false,
        autoDefender: false,
      });
    }
  });
  it("accepts only boolean stored preferences", () => {
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify({
          controllerUpdates: false,
          startupScan: true,
          autoDefender: "true",
        }),
    });
    expect(loadPreferences()).toEqual({
      controllerUpdates: false,
      startupScan: true,
      autoDefender: false,
    });
  });
});
describe("release comparison", () => {
  it("compares numeric version components", () => {
    expect(newerVersion("v0.1.10", "0.1.2")).toBe(true);
    expect(newerVersion("1.0.0", "0.9.9")).toBe(true);
    expect(newerVersion("0.1.2+build", "0.1.2")).toBe(false);
    expect(newerVersion("0.1.1", "0.1.2")).toBe(false);
  });
  it("rejects malformed and prerelease tags instead of suggesting them", () => {
    for (const tag of ["latest", "1.0.0-beta", "v1.0", "1.0.0/evil"])
      expect(() => newerVersion(tag, "0.1.2")).toThrow();
  });
  it("accepts an installed test build while comparing only stable releases", () => {
    expect(newerVersion("0.1.3", "0.1.4-test.1")).toBe(false);
    expect(newerVersion("0.1.4", "0.1.4-test.1")).toBe(true);
    expect(newerVersion("0.1.5", "0.1.4-test.1")).toBe(true);
    expect(() => newerVersion("0.1.4", "0.1.4-test.01")).toThrow();
  });
});
