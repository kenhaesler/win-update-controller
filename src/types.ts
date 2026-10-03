export type Category = "Security" | "Recommended" | "Drivers" | "Optional";
export interface UpdatePackage {
  id: string;
  revision: number;
  title: string;
  description: string;
  category: Category;
  kbIds: string[];
  supportUrls: string[];
  date: string;
  size: number;
  downloaded: boolean;
  hidden?: boolean;
  autoInstallEligible?: boolean;
  driver?: { hardwareId: string | null; model: string | null; provider: string | null; manufacturer: string | null; class: string | null; versionDate: string | null } | null;
  excluded?: boolean;
  restart: string;
  exclusive: boolean;
  eulaAccepted: boolean;
  bundles: string[];
}
export interface DriverRule { id: string; hardwareId: string; label: string; createdAt: string; }
export interface Operation {
  id: string;
  action: string;
  state: string;
  startedAt: string;
  finishedAt: string | null;
  results: { id: string; title: string; result: string; code?: string | null; revision?: number | null; observedState?: string | null }[];
  restartRequired: boolean;
  message: string | null;
}
export interface SystemStatus {
  edition: string;
  build: string;
  version: string;
  manualConfigured: boolean;
  agentDisabled: boolean | null;
  supported: boolean;
  conflicts: string[];
  restartPending: boolean;
  canRestore: boolean;
  checkedAt: string;
  lastOperation: Operation | null;
  verification: string;
}
export interface ScanResult {
  updates: UpdatePackage[];
  checkedAt: string;
}
export interface UpdateReview {
  updates: UpdatePackage[];
  licenses: { title: string; text: string }[];
  reviewToken: string;
  action: "download" | "install";
}
export interface HistoryEntry {
  title: string;
  date: string;
  result: string;
  code: string;
  action: string;
  client: string;
}
export interface HistoryResult {
  entries: HistoryEntry[];
  lastOperation: Operation | null;
  operations?: Operation[];
}
export type Tab = "Updates" | "History" | "Settings";
