import { invoke } from "@tauri-apps/api/core";
import { officialLink } from "./api";
import type { UpdatePackage } from "./types";
export interface Notes {
  source: string; retrievedAt: string; title: string;
  sections: { heading: string; text: string }[]; unavailableReason: string | null;
}
export const notesKey = (u: UpdatePackage) => `update-controller.notes.${u.id}.${u.revision}`;
export function validNotes(value: unknown): value is Notes {
  const n = value as Notes | null;
  return !!n && typeof n.source === "string" && officialLink(n.source) &&
    typeof n.retrievedAt === "string" && Number.isFinite(Date.parse(n.retrievedAt)) && typeof n.title === "string" &&
    (n.unavailableReason === null || typeof n.unavailableReason === "string") && Array.isArray(n.sections) &&
    n.sections.every(s => s && typeof s.heading === "string" && typeof s.text === "string");
}
export function readNotes(u: UpdatePackage): Notes | null {
  try { const n = JSON.parse(localStorage.getItem(notesKey(u)) ?? "null"); return validNotes(n) ? n : null; }
  catch { return null; }
}
export async function fetchNotes(u: UpdatePackage): Promise<Notes> {
  const url = u.supportUrls.find(officialLink);
  if (!url) throw Error("No official Microsoft source was supplied for this package.");
  const result = await invoke<Notes>("windows_request", { request: { command: "notes", url, kbIds: u.kbIds } });
  if (!validNotes(result)) throw Error("The source reader returned incomplete notes. Open the official Microsoft page.");
  try { localStorage.setItem(notesKey(u), JSON.stringify(result)); } catch { /* Display live notes without cache. */ }
  return result;
}
export function releaseHealthUrl(version: string | undefined): string {
  return version && /^\d{2}H[12]$/.test(version) ? `https://learn.microsoft.com/en-us/windows/release-health/status-windows-11-${version.toLowerCase()}` :
    "https://learn.microsoft.com/en-us/windows/release-health/";
}
