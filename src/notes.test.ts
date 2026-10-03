import { expect, it } from "vitest";
import { releaseHealthUrl, validNotes } from "./notes";
it("rejects incomplete or unofficial cached notes", () => {
  const n = { source: "https://support.microsoft.com/help/1234", retrievedAt: "2026-10-04", title: "KB1234", sections: [{ heading: "Known issues", text: "Issue" }], unavailableReason: null };
  expect(validNotes(n)).toBe(true);
  for (const value of [{ ...n, source: "https://microsoft.com.evil.test" }, { ...n, sections: [{}] }, { ...n, retrievedAt: "invalid" }, null]) expect(validNotes(value)).toBe(false);
});
it("links to the installed release without interpolating arbitrary paths", () => {
  expect(releaseHealthUrl("25H2")).toContain("status-windows-11-25h2");
  expect(releaseHealthUrl("../../other")).toBe("https://learn.microsoft.com/en-us/windows/release-health/");
});
