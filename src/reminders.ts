export interface ReviewReminder {
  id: string; revision: number; title: string; reviewDate: string; reason: string; notified: boolean;
}
export const reminderKey = "update-controller.review-reminders.v1";
export const reminderIdentity = (u: { id: string; revision: number }) => `${u.id}.${u.revision}`;
export function localDay(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function validDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function loadReminders(): ReviewReminder[] {
  try {
    const data = JSON.parse(localStorage.getItem(reminderKey) ?? "[]");
    if (!Array.isArray(data)) return [];
    return data.filter((r: ReviewReminder) => r && typeof r.id === "string" && Number.isSafeInteger(r.revision) && r.revision >= 0 &&
      typeof r.title === "string" && typeof r.reason === "string" && r.reason.length <= 500 &&
      typeof r.reviewDate === "string" && validDay(r.reviewDate) && typeof r.notified === "boolean").slice(0, 1000);
  } catch { return []; }
}
export function dueReminders(reminders: ReviewReminder[], today: string): ReviewReminder[] {
  return reminders.filter(r => r.reviewDate <= today).sort((a, b) => a.reviewDate.localeCompare(b.reviewDate));
}
