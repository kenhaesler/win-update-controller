import type { ScanResult, UpdatePackage } from "./types";

export function readStored(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function writeStored(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}
export function loadTheme(): "dark" | "light" {
  return readStored("update-controller.theme") === "light" ? "light" : "dark";
}
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === "string");
const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
const validDriver = (value: unknown) => value === undefined || value === null ||
  (typeof value === "object" && ["hardwareId", "model", "provider", "manufacturer", "class", "versionDate"].every(
    key => { const item = (value as Record<string, unknown>)[key]; return item === null || typeof item === "string"; }));
export function validPackage(value: unknown): value is UpdatePackage {
  if (!value || typeof value !== "object") return false;
  const u = value as UpdatePackage;
  return typeof u.id === "string" && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(u.id) &&
    Number.isSafeInteger(u.revision) && u.revision >= 0 &&
    typeof u.title === "string" && typeof u.description === "string" &&
    ["Security", "Recommended", "Drivers", "Optional"].includes(u.category) &&
    strings(u.kbIds) && strings(u.supportUrls) && strings(u.bundles) && date(u.date) &&
    typeof u.size === "number" && Number.isFinite(u.size) && u.size >= 0 &&
    typeof u.downloaded === "boolean" && typeof u.exclusive === "boolean" &&
    typeof u.eulaAccepted === "boolean" &&
    ["Not expected", "Required", "May be required"].includes(u.restart) &&
    (u.hidden === undefined || typeof u.hidden === "boolean") &&
    (u.excluded === undefined || typeof u.excluded === "boolean") && validDriver(u.driver) &&
    (u.autoInstallEligible === undefined || typeof u.autoInstallEligible === "boolean");
}
export function loadScanCache(): ScanResult | null {
  try {
    const data = JSON.parse(readStored("update-controller.scan.v1") ?? "null");
    if (!data || !date(data.checkedAt) || !Array.isArray(data.updates) ||
      data.updates.length > 10_000 || !data.updates.every(validPackage) ||
      new Set(data.updates.map((u: UpdatePackage) => u.id)).size !== data.updates.length) return null;
    return data;
  } catch { return null; }
}
