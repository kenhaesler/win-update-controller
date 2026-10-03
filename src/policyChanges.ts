import type { SystemStatus } from "./types";
export function policyChange(previous: SystemStatus, current: SystemStatus): string | null {
  if (previous.manualConfigured !== current.manualConfigured)
    return current.manualConfigured ? "Manual mode was enabled outside the controller. Review Settings." : "Manual mode changed outside the controller. Windows may manage automatic updates again. Review Settings.";
  if (JSON.stringify([...previous.conflicts].sort()) !== JSON.stringify([...current.conflicts].sort()))
    return current.conflicts.length ? "Windows update policy conflicts changed. Review management details in Settings." : "Windows update policy conflicts cleared. Review Settings before changing manual mode.";
  if (previous.agentDisabled !== current.agentDisabled)
    return "The Automatic Update Agent status changed. Review Settings for the current state.";
  return null;
}
export function loadPolicyAlerts(): boolean {
  try { return localStorage.getItem("update-controller.policy-alerts") !== "false"; } catch { return true; }
}
