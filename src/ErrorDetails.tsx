import { explainError, type Recovery } from "./errors";
export default function ErrorDetails({ error, context, busy, recover }: {
  error: string; context?: string; busy?: boolean; recover?: (action: Recovery) => void;
}) {
  const info = explainError(error, context);
  const labels: Record<Recovery, string> = {
    settings: "Review Settings", status: "Refresh control status", history: "Read status and history", scan: "Check and review updates",
  };
  return <div className="error-details">
    <strong>{info.summary}</strong><p>{info.guidance}</p>
    {recover && <button className="text-link" disabled={busy} onClick={() => recover(info.recovery)}>{labels[info.recovery]}</button>}
    <details><summary>Technical details</summary><pre>{error}</pre></details>
  </div>;
}
