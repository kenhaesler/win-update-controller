import { useState } from "react";
import { api, dateLabel } from "./api";
import type { Operation } from "./types";
export default function ActivityLog({ operations, query, busy, retry }: {
  operations: Operation[]; query: string; busy: boolean; retry: (operation: Operation) => void;
}) {
  const [observed, setObserved] = useState<Record<string, Operation>>({});
  const [reading, setReading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const matches = operations.filter(o => `${o.action} ${o.state} ${o.message ?? ""} ${o.results.map(r => `${r.title} ${r.code ?? ""}`).join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  async function observe(id: string) {
    setReading(id); setError(null);
    try { const next = await api.reconcile(id); setObserved(current => ({ ...current, [id]: next })); }
    catch (e) { setError(String(e)); } finally { setReading(null); }
  }
  return <section className="activity-log" aria-label="Controller activity">
    <h2>Controller activity</h2>
    <p className="muted">Recorded requests remain separate from current package state. An installed package does not prove which updater installed it.</p>
    {error && <p className="inline-warning" role="status">{error}</p>}
    {matches.length === 0 && <p className="muted">No controller operations match this search.</p>}
    {matches.map(record => {
      const op = observed[record.id] ?? record;
      const servicing = op.action === "download" || op.action === "install";
      return <details key={record.id} className="activity-entry" open={op.state !== "completed"}>
        <summary>{op.action} · {op.state} · {dateLabel(op.startedAt)} · {new Date(op.startedAt).toLocaleTimeString()}</summary>
        {op.message && <p>{op.message}</p>}
        {(op.state === "running" || op.state === "uncertain") && <p className="inline-warning">Completion has not been confirmed. Inspect current state and Windows history before retrying.</p>}
        {op.results.map(r => <div className="operation-result" key={r.id}><span>{r.title}<small>{r.observedState}</small></span><span>{r.result} {r.code}</span></div>)}
        {op.restartRequired && <p className="inline-warning">Windows reported a restart requirement.</p>}
        {servicing && <button className="text-link" disabled={busy || !!reading} onClick={() => void observe(op.id)}>{reading === op.id ? "Reading current package state…" : "Inspect current package state"}</button>}
        {servicing && op.results.some(r => r.result !== "Succeeded") && <button className="button outline" disabled={busy || !!reading} onClick={() => retry(op)}>Check unresolved packages</button>}
      </details>;
    })}
  </section>;
}
