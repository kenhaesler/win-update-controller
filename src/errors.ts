export type Recovery = "settings" | "status" | "history" | "scan";
export function explainError(raw: string, context = ""): { summary: string; guidance: string; recovery: Recovery } {
  const message = raw.replace(/^Error:\s*/, "");
  if (/0x800704c7|approval.*cancel|elevation.*cancel|operation was canceled/i.test(message))
    return { summary: "Administrator approval was cancelled.", guidance: "The request will not be retried automatically. Review the current status before starting it again.", recovery: "status" };
  if (/restart|reboot/i.test(message))
    return { summary: "Windows needs attention before installation can continue.", guidance: "Review the pending-restart status. When you choose to restart, return and check for updates again.", recovery: "settings" };
  if (/policy|domain|organization|managed|registry|conflict/i.test(message))
    return { summary: "The update policy could not be changed.", guidance: "Review the policy and management details in Settings. Existing values are preserved when a conflict is detected.", recovery: "settings" };
  if (/installing|downloading|defender/i.test(context) || /history before retry|uncertain|connection.*ended/i.test(message))
    return { summary: "The update operation could not be confirmed.", guidance: "Read status and history before retrying. Some packages may already have completed; any retry needs a fresh check and review.", recovery: "history" };
  if (/no longer available|details changed|review.*again|selected update/i.test(message))
    return { summary: "The selected update information changed.", guidance: "Check for updates and review a new selection before continuing.", recovery: "scan" };
  return { summary: message.replace(/\s*\(0x[\da-f]+\)\s*$/i, ""),
    guidance: "Read the current control status. Technical details below can help diagnose the problem.", recovery: "status" };
}
