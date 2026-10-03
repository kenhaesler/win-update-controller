export interface ProgressSnapshot {
  operationId: string; action: "download" | "install"; percent: number | null; currentPercent: number | null;
  index: number | null; count: number; title: string | null; bytesDownloaded: number | null; totalBytes: number | null; elapsedSeconds: number;
}
export function validProgress(value: unknown): value is ProgressSnapshot {
  const p = value as ProgressSnapshot | null;
  const percentage = (v: unknown) => v === null || typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 100;
  const bytes = (v: unknown) => v === null || typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
  return !!p && typeof p.operationId === "string" && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(p.operationId) &&
    ["download", "install"].includes(p.action) && percentage(p.percent) && percentage(p.currentPercent) &&
    Number.isInteger(p.count) && p.count > 0 && p.count <= 100 &&
    (p.index === null || Number.isInteger(p.index) && p.index >= 1 && p.index <= p.count) &&
    (p.title === null || typeof p.title === "string") && bytes(p.bytesDownloaded) && bytes(p.totalBytes) &&
    typeof p.elapsedSeconds === "number" && Number.isFinite(p.elapsedSeconds) && p.elapsedSeconds >= 0;
}
