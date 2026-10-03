import { useEffect, useRef, useState } from "react";
import type { UpdatePackage } from "./types";
export default function DriverExclusion({ update, busy, exclude }: { update: UpdatePackage; busy: boolean; exclude: () => void }) {
  const [review, setReview] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (review) dialog.current?.showModal();
    else if (dialog.current?.open) { dialog.current.close(); button.current?.focus(); }
  }, [review]);
  const driver = update.driver;
  return <section className="detail-section driver-exclusion">
    <h3>Device driver exclusion</h3>
    {driver && <dl><dt>Device model</dt><dd>{driver.model || "Unavailable"}</dd><dt>Provider</dt><dd>{driver.provider || "Unavailable"}</dd><dt>Hardware or compatible ID</dt><dd>{driver.hardwareId || "Unavailable"}</dd></dl>}
    <p className="muted">Exclusions apply to controller downloads and installations for every device matching this exact ID, including replacement packages. Windows hidden state and independent installers have separate controls.</p>
    {update.excluded ? <p className="inline-warning">Excluded from controller servicing. Remove the matching rule in Settings to review this driver again. If its identity is unavailable, active rules block it until the identity can be checked.</p> :
      <button ref={button} className="button outline" disabled={busy || !driver?.hardwareId} onClick={() => setReview(true)}>Exclude future drivers for this ID</button>}
    {!driver?.hardwareId && <p className="muted">Windows did not supply a usable hardware identity. You can hide the individual package instead.</p>}
    <dialog ref={dialog} className="review-dialog" aria-labelledby="driver-review-title" onCancel={() => setReview(false)}>
      <h2 id="driver-review-title">Exclude matching device drivers?</h2>
      <p>{update.title}</p><p className="driver-id">{driver?.hardwareId}</p>
      <p>This excludes all future controller packages matching this hardware or compatible ID. Multiple devices may share it. It does not uninstall a driver, hide Windows packages or undo a pending installation. You can remove the rule in Settings.</p>
      <div className="dialog-actions"><button className="button outline" onClick={() => setReview(false)}>Cancel</button><button className="button primary" disabled={busy} onClick={() => { setReview(false); exclude(); }}>Save device exclusion</button></div>
    </dialog>
  </section>;
}
