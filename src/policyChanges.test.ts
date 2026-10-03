import { expect, it } from "vitest";
import { policyChange } from "./policyChanges";
import { demoStatus } from "./demo";
it("ignores timestamps, restart changes and conflict ordering", () => {
  expect(policyChange(demoStatus, { ...demoStatus, checkedAt: "later", restartPending: true })).toBeNull();
  expect(policyChange({ ...demoStatus, conflicts: ["a", "b"] }, { ...demoStatus, conflicts: ["b", "a"] })).toBeNull();
});
it("detects manual-mode, management and agent changes", () => {
  expect(policyChange(demoStatus, { ...demoStatus, manualConfigured: false })).toContain("outside the controller");
  expect(policyChange(demoStatus, { ...demoStatus, conflicts: ["MDM"] })).toContain("conflicts changed");
  expect(policyChange(demoStatus, { ...demoStatus, agentDisabled: false })).toContain("Agent status changed");
});
