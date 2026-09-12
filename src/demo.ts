import type { ScanResult, SystemStatus, HistoryResult } from "./types";
export const demoStatus: SystemStatus = {
  edition: "Professional",
  build: "26200",
  version: "25H2",
  manualConfigured: true,
  agentDisabled: true,
  supported: true,
  conflicts: [],
  restartPending: false,
  canRestore: true,
  checkedAt: new Date().toISOString(),
  lastOperation: null,
  verification:
    "Illustrative state. Preview mode cannot read or change your PC.",
};
export const demoScan: ScanResult = {
  checkedAt: new Date().toISOString(),
  updates: [
    {
      id: "a0000000-0000-0000-0000-000000000001",
      revision: 1,
      title: "Windows security update",
      description:
        "Addresses security vulnerabilities.\n\nFixes reliability issues.\n\nIncludes earlier cumulative fixes.",
      category: "Security",
      kbIds: [],
      supportUrls: [
        "https://learn.microsoft.com/windows/deployment/update/release-cycle",
      ],
      date: "2026-09-08T12:00:00Z",
      size: 876_000_000,
      downloaded: false,
      restart: "May be required",
      exclusive: false,
      eulaAccepted: true,
      bundles: [],
    },
    {
      id: "a0000000-0000-0000-0000-000000000002",
      revision: 1,
      title: ".NET reliability update",
      description:
        "An example .NET package for apps that use the Windows .NET runtime. The live description will identify the applicable runtime and describe the fixes supplied by Microsoft.",
      category: "Recommended",
      kbIds: [],
      supportUrls: ["https://learn.microsoft.com/dotnet/framework/"],
      date: "2026-09-08T12:00:00Z",
      size: 67_000_000,
      downloaded: false,
      restart: "May be required",
      exclusive: false,
      eulaAccepted: true,
      bundles: [],
    },
    {
      id: "a0000000-0000-0000-0000-000000000003",
      revision: 1,
      title: "Display driver",
      description:
        "An example display-driver package. Driver descriptions are supplied by the publisher and can be limited. Read the available notes before choosing to replace your current driver.",
      category: "Drivers",
      kbIds: [],
      supportUrls: [],
      date: "2026-09-04T12:00:00Z",
      size: 324_000_000,
      downloaded: false,
      restart: "May be required",
      exclusive: false,
      eulaAccepted: true,
      bundles: [],
    },
  ],
};
export const demoHistory: HistoryResult = { entries: [], lastOperation: null };
