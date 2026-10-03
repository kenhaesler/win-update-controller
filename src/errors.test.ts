import { expect, it } from "vitest";
import { explainError } from "./errors";
it("routes interrupted servicing to read-only reconciliation rather than another install", () => {
  expect(explainError("Connection ended", "Installing selected updates…").recovery).toBe("history");
  expect(explainError("Failure 0x123", "Downloading selected updates…").recovery).toBe("history");
});
it("offers recovery for approval, policy conflicts, restarts and changed identities", () => {
  expect(explainError("Operation was canceled (0x800704C7)").recovery).toBe("status");
  expect(explainError("A managed policy conflicts").recovery).toBe("settings");
  expect(explainError("Windows needs a restart").recovery).toBe("settings");
  expect(explainError("The update details changed. Review again").recovery).toBe("scan");
  expect(explainError("Network failed (0x12345678)").summary).toBe("Network failed");
});
