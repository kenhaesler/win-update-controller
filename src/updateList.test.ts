import { expect, it } from "vitest";
import { demoScan } from "./demo";
import { discovered, identity, scanAge, sortUpdates } from "./updateList";
it("identifies new identities and changed revisions rather than titles", () => {
  const original = demoScan.updates[0];
  const revised = { ...original, revision: original.revision + 1 };
  expect([...discovered([original, revised], [original])]).toEqual([identity(revised)]);
});
it("sorts packages without mutating scan order and reports cached age", () => {
  expect(sortUpdates(demoScan.updates, "size")[0].title).toBe(".NET reliability update");
  expect(sortUpdates(demoScan.updates, "newest").at(-1)?.title).toBe("Display driver");
  expect(demoScan.updates[0].title).toBe("Windows security update");
  expect(scanAge("2026-10-01T12:00:00Z", Date.parse("2026-10-04T12:00:00Z"))).toBe("3 days ago");
  expect(scanAge("invalid", Date.now())).toBe("check time unavailable");
});
