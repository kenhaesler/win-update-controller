import { describe, expect, it } from "vitest";
import { officialLink, selectedAction, policyLabel } from "./api";
import { demoScan, demoStatus } from "./demo";
describe("deliberate actions", () => {
  it("keeps download and installation separate", () => {
    expect(selectedAction(demoScan.updates)).toBe("download");
    expect(
      selectedAction(demoScan.updates.map((u) => ({ ...u, downloaded: true }))),
    ).toBe("install");
    expect(
      selectedAction([
        { ...demoScan.updates[0], downloaded: true },
        demoScan.updates[1],
      ]),
    ).toBe("download");
  });
  it("does not describe policy readback as certified protection", () => {
    expect(policyLabel(demoStatus)).toBe("Manual mode configured");
    expect(policyLabel(null)).toBe("Control status unavailable");
    expect(policyLabel({ ...demoStatus, conflicts: ["Managed"] })).toBe(
      "Policy conflict detected",
    );
  });
});
describe("external link boundary", () => {
  it.each([
    "https://support.microsoft.com/help/123",
    "https://learn.microsoft.com/windows",
  ])("allows official source %s", (url) =>
    expect(officialLink(url)).toBe(true),
  );
  it.each([
    "https://microsoft.com.evil.test",
    "http://support.microsoft.com",
    "javascript:alert(1)",
    "https://evil.test@microsoft.com",
    "file:///C:/Windows/system32/cmd.exe",
  ])("rejects %s", (url) => expect(officialLink(url)).toBe(false));
});
