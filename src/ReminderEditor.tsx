import { useState } from "react";
import type { UpdatePackage } from "./types";
import { localDay, validDay, type ReviewReminder } from "./reminders";
export default function ReminderEditor({ update, reminder, save }: {
  update: UpdatePackage; reminder?: ReviewReminder; save: (reminder: ReviewReminder | null) => void;
}) {
  const [date, setDate] = useState(reminder?.reviewDate ?? localDay());
  const [reason, setReason] = useState(reminder?.reason ?? "");
  return <section className="detail-section reminder-editor">
    <h3>Remind me to review</h3>
    <p className="muted">Choose when to reconsider this package. Reminders appear when the controller is open; they never authorize installation or change Windows policy.</p>
    <label>Review date<input type="date" aria-label="Review date" value={date} onChange={e => setDate(e.target.value)} /></label>
    <label>Reason (optional)<input aria-label="Reminder reason" maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="For example, check driver reports next weekend" /></label>
    <div className="reminder-actions">
      <button className="button outline" disabled={!validDay(date)} onClick={() => save({ id: update.id, revision: update.revision, title: update.title, reviewDate: date, reason: reason.trim(), notified: false })}>{reminder ? "Update reminder" : "Save reminder"}</button>
      {reminder && <button className="text-link" onClick={() => save(null)}>Remove reminder</button>}
    </div>
  </section>;
}
