import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  ScanResult,
  SystemStatus,
  HistoryResult,
  UpdatePackage,
  UpdateReview,
  Operation,
  DriverRule,
} from "./types";
import { demoScan, demoStatus, demoHistory } from "./demo";
import { version } from "../package.json";

export const preview = !isTauri();
let sampleScan: ScanResult = structuredClone(demoScan);
let sampleStatus: SystemStatus = structuredClone(demoStatus);
let sampleHistory: HistoryResult = structuredClone(demoHistory);
let sampleRules: DriverRule[] = [];
try { const value = JSON.parse(localStorage.getItem("update-controller.preview-driver-rules") ?? "[]"); if (Array.isArray(value)) sampleRules = value.filter(r => typeof r.id === "string" && typeof r.hardwareId === "string"); } catch { /* Preview preferences are optional. */ }
const previewExcluded = (u: UpdatePackage) => sampleRules.some(r => r.hardwareId.toUpperCase() === u.driver?.hardwareId?.toUpperCase());
const refs = (items: UpdatePackage[]) =>
  items.map(({ id, revision }) => ({ id, revision }));
const request = <T>(data: object) =>
  invoke<T>("windows_request", { request: data });
const delay = () => new Promise<void>((resolve) => setTimeout(resolve, 550));
export const api = {
  notifyReviewDue: async (count: number): Promise<void> => {
    if (!preview) await invoke("notify_review_due", { count });
  },
  notifyPolicyChange: async (message: string): Promise<void> => {
    if (!preview) await invoke("notify_policy_change", { message });
  },
  driverRules: async (): Promise<DriverRule[]> => preview ? structuredClone(sampleRules) : request({ command: "driverRules" }),
  excludeDriver: async (u: UpdatePackage): Promise<DriverRule[]> => {
    if (!preview) return request({ command: "excludeDriver", updates: refs([u]), hardwareId: u.driver?.hardwareId });
    if (!u.driver?.hardwareId) throw Error("Driver hardware identity unavailable.");
    const next = previewExcluded(u) ? sampleRules : [...sampleRules, { id: crypto.randomUUID(), hardwareId: u.driver.hardwareId, label: u.title, createdAt: new Date().toISOString() }];
    localStorage.setItem("update-controller.preview-driver-rules", JSON.stringify(next)); sampleRules = next;
    return structuredClone(next);
  },
  removeDriverRule: async (id: string): Promise<DriverRule[]> => {
    if (!preview) return request({ command: "removeDriverRule", ruleId: id });
    const next = sampleRules.filter(r => r.id !== id);
    localStorage.setItem("update-controller.preview-driver-rules", JSON.stringify(next)); sampleRules = next;
    return structuredClone(next);
  },
  reconcile: async (id: string): Promise<Operation> => {
    if (!preview) return request({ command: "reconcile", operationId: id });
    const op = sampleHistory.operations?.find(o => o.id === id) ?? sampleHistory.lastOperation;
    if (!op) throw Error("This operation is no longer available.");
    return { ...op, results: op.results.map(r => ({ ...r, observedState: sampleScan.updates.some(u => u.id === r.id) ? "Currently available" : "Not in current metadata; inspect Windows history" })) };
  },
  appRelease: async (): Promise<{ version: string }> =>
    preview ? { version } : request({ command: "appRelease" }),
  autoDefender: async (items: UpdatePackage[]): Promise<Operation> => {
    if (!preview)
      return request({ command: "autoDefender", updates: refs(items) });
    await delay();
    if (items.some((u) => !u.autoInstallEligible || u.hidden))
      throw new Error(
        "Only eligible Defender updates can be installed automatically.",
      );
    sampleScan.updates = sampleScan.updates.filter(
      (u) => !items.some((item) => item.id === u.id),
    );
    const op: Operation = {
      id: crypto.randomUUID(),
      action: "install",
      state: "completed",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      results: items.map((u) => ({
        id: u.id,
        title: u.title,
        result: "Succeeded",
      })),
      restartRequired: false,
      message: "Preview only: Defender updates installed.",
    };
    sampleStatus.lastOperation = op;
    sampleHistory.lastOperation = op;
    sampleHistory.operations = [op, ...(sampleHistory.operations ?? [])];
    sampleHistory.entries.unshift(
      ...items.map((u) => ({
        title: u.title,
        date: op.finishedAt!,
        result: "Succeeded",
        code: "0x00000000",
        action: "Installation",
        client: "Preview only",
      })),
    );
    return op;
  },
  setHidden: async (
    items: UpdatePackage[],
    hidden: boolean,
  ): Promise<{
    results: {
      id: string;
      revision: number;
      success: boolean;
      error: string | null;
    }[];
  }> => {
    if (!preview)
      return request({
        command: hidden ? "hide" : "unhide",
        updates: refs(items),
      });
    await delay();
    const ids = new Set(items.map((u) => u.id));
    sampleScan.updates = sampleScan.updates.map((u) =>
      ids.has(u.id) ? { ...u, hidden } : u,
    );
    return {
      results: items.map((u) => ({
        id: u.id,
        revision: u.revision,
        success: true,
        error: null,
      })),
    };
  },
  status: async (): Promise<SystemStatus> =>
    preview ? structuredClone(sampleStatus) : request({ command: "status" }),
  scan: async (): Promise<ScanResult> => {
    if (!preview) return request({ command: "scan" });
    await delay();
    sampleScan.checkedAt = new Date().toISOString();
    sampleScan.updates = sampleScan.updates.map(u => ({ ...u, excluded: previewExcluded(u) }));
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
    if (items.some(previewExcluded)) throw Error("A selected driver matches a device exclusion.");
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
    if (review.updates.some(previewExcluded)) throw Error("A selected driver matches a device exclusion.");
    const op: Operation = {
      id: crypto.randomUUID(),
      action: review.action,
      state: "completed",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      results: review.updates.map((u) => ({
        id: u.id,
        revision: u.revision,
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
    sampleHistory.operations = [op, ...(sampleHistory.operations ?? [])];
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
export async function openControllerRelease() {
  if (preview)
    window.open(
      "https://github.com/kenhaesler/win-update-controller/releases/latest",
      "_blank",
      "noopener,noreferrer",
    );
  else await invoke("open_controller_release");
}
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
