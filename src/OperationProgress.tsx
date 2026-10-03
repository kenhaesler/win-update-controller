import { useEffect, useState } from "react";
import { formatSize } from "./api";
import type { ProgressSnapshot } from "./progress";
export default function OperationProgress({ report, receivedAt }: { report: ProgressSnapshot; receivedAt: number }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const elapsed = Math.floor(report.elapsedSeconds + Math.max(0, now - receivedAt) / 1000);
  const stale = now - receivedAt >= 15_000;
  return <div className="operation-progress">
    <div>{report.action === "install" ? "Installing" : "Downloading"}{report.index !== null && ` package ${report.index} of ${report.count}`}{report.title && `: ${report.title}`}</div>
    <progress aria-label="Overall update progress" max={100} value={report.percent ?? undefined} />
    <div className="muted" aria-live="off">{report.percent === null ? "Windows has not reported a percentage" : `${report.percent}% overall`}
      {report.currentPercent !== null && ` · ${report.currentPercent}% of current package`}
      {report.bytesDownloaded !== null && ` · ${report.bytesDownloaded === 0 ? "0 bytes" : formatSize(report.bytesDownloaded)} downloaded`}
      {report.totalBytes !== null && report.totalBytes > 0 && ` of about ${formatSize(report.totalBytes)}`}
      {` · ${Math.floor(elapsed / 60)}m ${elapsed % 60}s elapsed`}</div>
    {stale && <p className="muted">Waiting for a new Windows progress report. Completion has not been confirmed.</p>}
  </div>;
}
