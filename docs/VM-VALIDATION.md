# Disposable Windows servicing validation

Use a Windows 11 Pro x64 VM with a clean snapshot and no personal data. This harness has not been run against live servicing. It never creates a VM, reboots, kills a servicing worker, or executes an installer. Its default Capture phase is read-only. Keep evidence before restoring the VM snapshot.

Inside the VM, build/install the candidate. Run `scripts/vm-servicing.ps1 -Helper '<absolute helper path>'` to capture status, scan, history, helper hash, and machine identity. To permit a mutation, create a VM-local JSON marker with `machineGuid` from that capture, `purpose` set to `update-controller-disposable-servicing`, and `snapshot` naming the clean VM snapshot. The script requires a matching marker, a virtual machine hardware description, and the explicit `-ConfirmDisposableVm` switch. These are operator mistake guards, not a security boundary. Never create that marker on a personal workstation.

```powershell
./scripts/vm-servicing.ps1 -Helper '<helper path>' -Phase EnableManual -DisposableVmMarker '<marker path>' -ConfirmDisposableVm
./scripts/vm-servicing.ps1 -Helper '<helper path>' -Phase Download -UpdatesFile '<reviewed refs JSON>' -DisposableVmMarker '<marker path>' -ConfirmDisposableVm
```

The updates file is a JSON array of `{ "id": "<update GUID>", "revision": 123 }`, taken from the saved scan and reviewed by the operator. Install is a separate explicit `-Phase Install` invocation. Unaccepted licenses stop the run after saving the exact review; read them before deciding to pass `-AcceptLicenses`. UAC remains interactive. No package is selected automatically. A failed/uncertain result stops the script; inspect History before any retry. Evidence is flushed incrementally under ignored `.artifacts/vm-<GUID>/` including progress frames and final outcome, so interrupted runs keep their available evidence.

Run and record these acceptance scenarios, with a fresh snapshot where appropriate:

| Scenario | Required observations |
| --- | --- |
| Enable/restore policy | Exact original registry values restored; external changes preserved; state after closing/reopening and a manual reboot |
| Download/install | One package then a bundle; progress, bytes, elapsed time, tray delivery, per-package result, pending restart |
| Recovery | Cancel UAC; close UI during servicing; deliberate VM-only worker interruption; reopen and reconcile exact revisions without assuming success |
| Exclusions/reminders | Match a replacement driver for the same hardware ID, reject a cached selection, remove rule; due-date reminder persists without selecting packages |
| Conflicts/cache | Managed-policy changes, offline start, new revision, stale release notes, outdated cached review |
| Installer | Install, upgrade, uninstall; signatures; protected helper location; retained/restored policy choices |
| Desktop | Multi-monitor geometry and 150/200% DPI, System appearance, keyboard/Narrator, installed toast delivery |

Use Capture again after an operator-controlled reboot to preserve status/history. Compare results to the earlier operation ID and revision; installed state alone does not prove an interrupted operation succeeded. Add actual evidence and gaps to `docs/VALIDATION.md`; do not certify a release using simulated tests alone.
