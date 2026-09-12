import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  ScanResult,
  SystemStatus,
  HistoryResult,
  UpdatePackage,
  UpdateReview,
  Operation,
} from "./types";
import { demoScan, demoStatus, demoHistory } from "./demo";

export const preview = !isTauri();
let sampleScan: ScanResult = structuredClone(demoScan);
let sampleStatus: SystemStatus = structuredClone(demoStatus);
let sampleHistory: HistoryResult = structuredClone(demoHistory);
const refs = (items: UpdatePackage[]) =>
  items.map(({ id, revision }) => ({ id, revision }));
const request = <T>(data: object) =>
  invoke<T>("windows_request", { request: data });
const delay = () => new Promise<void>((resolve) => setTimeout(resolve, 550));
export const api = {
  status: async (): Promise<SystemStatus> =>
    preview ? structuredClone(sampleStatus) : request({ command: "status" }),
  scan: async (): Promise<ScanResult> => {
    if (!preview) return request({ command: "scan" });
    await delay();
    sampleScan.checkedAt = new Date().toISOString();
    return structuredClone(sampleScan);
  },
  history: async (): Promise<HistoryResult> =>
    preview ? structuredClone(sampleHistory) : request({ command: "history" }),
  policy: async (enable: boolean): Promise<SystemStatus> => {
    if (!preview)
      return request({ command: enable ? "enableManual" : "restorePolicy" });
    await delay();
    sampleStatus.manualConfigured = enable;
    sampleStatus.agentDisabled = enable;
    sampleStatus.canRestore = enable;
    return structuredClone(sampleStatus);
  },
  review: async (
    items: UpdatePackage[],
    action: "download" | "install",
  ): Promise<UpdateReview> => {
    if (!preview)
      return request({ command: "review", updates: refs(items), action });
    await delay();
    return {
      updates: items,
      licenses: [],
      action,
      reviewToken: "preview-only",
    };
  },
  execute: async (
    review: UpdateReview,
    acceptLicenses: boolean,
  ): Promise<Operation> => {
    if (!preview)
      return request({
        command: review.action,
        updates: refs(review.updates),
        reviewToken: review.reviewToken,
        acceptLicenses,
      });
    await delay();
    const op: Operation = {
      id: crypto.randomUUID(),
      action: review.action,
      state: "completed",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      results: review.updates.map((u) => ({
        id: u.id,
        title: u.title,
        result: "Succeeded",
      })),
      restartRequired: review.action === "install",
      message: "Preview completed. Your PC was not changed.",
    };
    const selected = new Set(review.updates.map((u) => u.id));
    sampleScan.updates =
      review.action === "download"
        ? sampleScan.updates.map((u) =>
            selected.has(u.id) ? { ...u, downloaded: true } : u,
          )
        : sampleScan.updates.filter((u) => !selected.has(u.id));
    sampleStatus.lastOperation = op;
    sampleStatus.restartPending ||= op.restartRequired;
    sampleHistory.lastOperation = op;
    if (review.action === "install")
      sampleHistory.entries.unshift(
        ...review.updates.map((u) => ({
          title: u.title,
          date: new Date().toISOString(),
          result: "Succeeded",
          code: "0x00000000",
          action: "Installation",
          client: "Preview only",
        })),
      );
    return op;
  },
};
export function officialLink(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      (u.hostname === "microsoft.com" ||
        u.hostname.endsWith(".microsoft.com")) &&
      !u.username &&
      !u.password
    );
  } catch {
    return false;
  }
}
export async function openOfficial(url: string) {
  if (!officialLink(url))
    throw new Error("Only official Microsoft HTTPS links can be opened here.");
  if (preview) window.open(url, "_blank", "noopener,noreferrer");
  else await invoke("open_official_url", { url });
}
export function formatSize(bytes: number) {
  if (!bytes) return "Size unavailable";
  return bytes >= 1e9
    ? `${(bytes / 1e9).toFixed(1)} GB`
    : `${Math.max(1, Math.round(bytes / 1e6))} MB`;
}
export function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}
export function selectedAction(items: UpdatePackage[]): "download" | "install" {
  return items.length > 0 && items.every((u) => u.downloaded)
    ? "install"
    : "download";
}
export function policyLabel(status: SystemStatus | null): string {
  if (!status) return "Control status unavailable";
  if (status.conflicts.length) return "Policy conflict detected";
  if (!status.supported) return "Manual mode unavailable";
  if (status.manualConfigured) return "Manual mode configured";
  return "Windows manages updates";
}
