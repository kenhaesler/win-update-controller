import type { UpdatePackage } from "./types";
export type SortOrder = "default" | "newest" | "size" | "restart";
export const identity = (u: UpdatePackage) => `${u.id}.${u.revision}`;
export function discovered(updates: UpdatePackage[], previous: UpdatePackage[]): Set<string> {
  const seen = new Set(previous.map(identity));
  return new Set(updates.filter(u => !seen.has(identity(u))).map(identity));
}
export function sortUpdates(updates: UpdatePackage[], sort: SortOrder): UpdatePackage[] {
  const rank: Record<string, number> = { Required: 0, "May be required": 1, "Not expected": 2 };
  const byTitle = (a: UpdatePackage, b: UpdatePackage) => a.title.localeCompare(b.title);
  return [...updates].sort((a, b) => sort === "newest" ? Date.parse(b.date) - Date.parse(a.date) || byTitle(a, b) :
    sort === "size" ? a.size - b.size || byTitle(a, b) :
    sort === "restart" ? rank[a.restart] - rank[b.restart] || byTitle(a, b) : 0);
}
export function scanAge(checkedAt: string, now: number): string {
  const age = Math.max(0, now - Date.parse(checkedAt));
  if (!Number.isFinite(age)) return "check time unavailable";
  if (age < 60_000) return "less than a minute ago";
  if (age < 3_600_000) return `${Math.floor(age / 60_000)} min ago`;
  if (age < 86_400_000) return `${Math.floor(age / 3_600_000)} hours ago`;
  const days = Math.floor(age / 86_400_000);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
