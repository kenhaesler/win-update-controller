import { expect, it } from "vitest";
import { validProgress } from "./progress";
it("accepts indeterminate Windows progress and rejects invalid event fields", () => {
  const p = { operationId: "11111111-1111-1111-1111-111111111111", action: "download", percent: null, currentPercent: null, index: null, count: 2, title: null, bytesDownloaded: null, totalBytes: null, elapsedSeconds: 1 };
  expect(validProgress(p)).toBe(true);
  expect(validProgress({ ...p, percent: 25, currentPercent: 50, index: 1, bytesDownloaded: 1234, totalBytes: 4321 })).toBe(true);
  for (const bad of [{ ...p, percent: 101 }, { ...p, index: 3 }, { ...p, count: 0 }, { ...p, operationId: "bad" }, { ...p, elapsedSeconds: Infinity }, { ...p, bytesDownloaded: -1 }]) expect(validProgress(bad)).toBe(false);
});
