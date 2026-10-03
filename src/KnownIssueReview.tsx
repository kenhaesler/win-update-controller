import { useEffect, useRef, useState } from "react";
import { dateLabel, officialLink, openOfficial, preview } from "./api";
import { fetchNotes, readNotes, releaseHealthUrl } from "./notes";
import type { UpdatePackage } from "./types";
export default function KnownIssueReview({ updates, version }: { updates: UpdatePackage[]; version?: string }) {
  const [error, setError] = useState<string | null>(null);
  return <section className="known-issue-review">
    <h3>Known issues before installation</h3>
    <p className="muted">Missing or older notes leave compatibility unknown. These sources do not confirm whether a known issue affects this PC.</p>
    <button className="text-link" onClick={() => void openOfficial(releaseHealthUrl(version)).catch(e => setError(String(e)))}>
      Review Windows {version || "release"} health at Microsoft
    </button>
    {error && <p className="inline-warning" role="status">{error}</p>}
    {updates.map(u => <PackageIssues key={`${u.id}.${u.revision}`} update={u} />)}
  </section>;
}
function PackageIssues({ update }: { update: UpdatePackage }) {
  const [notes, setNotes] = useState(() => readNotes(update));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  useEffect(() => () => { sequence.current++; }, []);
  const issues = notes?.sections.filter(s => /known issues/i.test(s.heading)) ?? [];
  const days = notes ? Math.max(0, Math.floor((Date.now() - Date.parse(notes.retrievedAt)) / 86_400_000)) : 0;
  async function load() {
    const id = ++sequence.current; setBusy(true); setError(null);
    try { const next = await fetchNotes(update); if (id === sequence.current) setNotes(next); }
    catch (e) { if (id === sequence.current) setError(String(e)); }
    finally { if (id === sequence.current) setBusy(false); }
  }
  return <div className="package-issues">
    <strong>{update.title}</strong>
    {notes && <p className="muted">Cached source checked {dateLabel(notes.retrievedAt)} · {days} days ago</p>}
    {days >= 7 && <p className="inline-warning">These notes are at least a week old. Refresh them or check Microsoft before deciding.</p>}
    {issues.length ? issues.map((s, i) => <details key={i} open><summary>{s.heading}</summary><p>{s.text}</p></details>) :
      <p className="muted">{notes?.unavailableReason ?? (notes ? "No known-issue section was found. Compatibility remains unknown." : "Known issues have not been checked for this package.")}</p>}
    {!preview && update.supportUrls.some(officialLink) && <button className="text-link" disabled={busy} onClick={() => void load()}>
      {busy ? "Reading package issues…" : notes ? "Refresh package issues" : "Load package issues"}
    </button>}
    {notes && <button className="text-link" onClick={() => void openOfficial(notes.source).catch(e => setError(String(e)))}>Open source at Microsoft</button>}
    {error && <p className="inline-warning" role="status">{error}</p>}
  </div>;
}
