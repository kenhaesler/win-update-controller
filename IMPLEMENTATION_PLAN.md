# Windows Update Controller — implementation plan

## Product outcome

The owner can read what available Windows update packages change and deliberately choose when to install them. Checking for updates or opening release notes never starts installation. The primary outcome is preventing unapproved background installations from turning an ordinary restart into an update session.

This is a proposed implementation plan, not a claim that these controls have already been verified. No Windows settings are changed during planning.

Delivery update: the user accepted delivery without a disposable Windows VM, with actual installation/reboot tests documented as outstanding. Current implementation and evidence are recorded in README.md and docs/VALIDATION.md. Original acceptance targets below remain future validation targets where evidence is missing.

## Scope and limits

- Initial target: personal, unmanaged Windows 11 Pro 25H2 on x64. Expand compatibility only after testing.
- Use supported Windows Update policies and the Windows Update Agent API. Establish policy effectiveness on the exact build before claiming manual control.
- Detect pre-existing pending restarts and external policy management. Do not promise that manual mode cancels an update already staged for reboot.
- Do not patch the Start menu, delete servicing state, disable servicing components, or repeatedly fight organization policies.
- Selection is at the package level; cumulative updates cannot be separated into individual fixes. Handle prerequisites and exclusive-install packages explicitly.
- Microsoft Store, third-party updaters, and independent firmware tools are outside the initial scope. Report this boundary in settings.
- Defender intelligence behavior is a compatibility investigation: identify its separate update paths and preserve protection where possible without claiming that manual mode governs every update mechanism.

## Selected stack — Tauri + React

The user selected Tauri + React. Use Tauri 2 with React, TypeScript, Tailwind, and Motion for a highly customized desktop frontend. Use accessible UI primitives with a bespoke visual system, rather than a stock component theme. Windows WebView2 renders the interface; native focus and text rendering will differ from WinUI controls. Preserve native resize, keyboard, and window-management behavior.

Implementation decision: Rust owns the Tauri boundary and a dedicated .NET helper owns Windows COM and policy inspection. The helper brokers a separately elevated instance for privileged operations. The main UI runs without administrator rights. Use narrow, authenticated local IPC commands; do not expose arbitrary shell execution or registry writes to the frontend. Elevate for policy changes and update operations only where required. No permanent service unless the feasibility work demonstrates a concrete need.

The frontend track is settled. Pin supported stable dependency versions at implementation time.

## Frontend direction — proposal

Modern, precise, quiet desktop utility. A graphite dark theme and a separately tuned light theme, crisp typography, restrained translucent window material, thin separators, and one cool accent for selection and primary actions. Reserve amber for pending restart or degraded control, and red for failures. Never use color alone to communicate status.

The visual identity comes from the update reading experience: a clear master-detail layout with an editorial detail pane and a small, always-visible control-status strip. No decorative charts, oversized dashboard metrics, or marketing-style hero section.

```text
Window title                                      Window controls
Manual control active · Checked 10 minutes ago       Check updates
-----------------------------------------------------------------
Updates   History   Settings
-----------------------------------------------------------------
Available packages          | Selected update
Search / category filter    | Title, KB, publication date
                            | What changes
[ ] Security update         | Why it matters
[ ] .NET update             | Known issues · source checked date
[ ] Driver update           | Restart: possible / required / unknown
                            | Official release notes
-----------------------------------------------------------------
2 packages selected                       Download selected
```

- Selection and viewing details are separate interactions; viewing a package never selects it for installation.
- Download and install are separate commands. Installation review names the selected packages, additional dependencies, license requirements, and restart implications.
- Progress shows scan, download, installation, and pending restart as distinct stages. Never invent progress percentages or offer cancellation after the engine no longer supports it.
- Closing the window cannot silently abandon an active installation; reopen and recover authoritative operation state.
- Compact widths switch from split view to list/detail navigation. Test 100%, 150%, and 200% scaling, keyboard-only use, Narrator, high contrast, and reduced motion.
- Use short state transitions, approximately 120–180 ms, with no perpetual decorative animation.
- Cover first run, no updates, offline, missing release notes, scan failure, UAC denial, policy conflict, partial installation failure, unsupported Windows build, and restart already pending.

## Implementation phases

### 1. Prove Windows control

Build a diagnostic prototype that reads edition/build, relevant local and effective policies, management indicators, and pending restart signals. Test disabling automatic installation with supported policies while preserving explicit API-driven scanning and installation. Check policy persistence after reboot and with the UI closed.

Use disposable Windows VMs for installs and reboots. Establish baseline and enabled-mode evidence on the target build. Record limitations and conflicts; if reliable control cannot be demonstrated, show unsupported or degraded status rather than a successful toggle.

Deliverable: compatibility report and working backend proof. This gates real-system control work.

### 2. Build the interactive frontend

Finalize the visual direction within the selected Tauri + React track. Implement the main split view, readable update details, installation review, history, settings, and tray entry. Use realistic, clearly labelled fixtures through a typed backend adapter so the complete flow can be reviewed before connecting privileged operations.

Create reusable status, package row, detail section, operation progress, and action components with all interaction states. Verify light/dark, compact/large window sizes, scaling, focus behavior, and reduced motion. One batched visual review and one confirmation pass.

Deliverable: polished interactive prototype; fixture mode cannot modify Windows.

### 3. Implement reversible manual mode

Snapshot the existence, types, and values of only the settings the app will change. Apply a narrowly scoped policy transaction, verify the result, and persist an audit record. Recover interrupted transactions and restore only app-owned changes, preserving unrelated or subsequently externally modified settings.

Status must distinguish enabled, disabled, verification pending, policy conflict, unsupported, and unknown. Recheck at startup and after relevant changes; notify on meaningful loss of control rather than silently overwriting another administrator's settings. The policy must remain effective without the tray app running.

Deliverable: verified manual-mode toggle and tested restore path.

### 4. Explain available updates

Read package metadata through Windows Update Agent: identity/revision, KB references where present, title, description, classification, download status, and installation behavior. Use official support and release-health pages for additional details where available.

Structure details as what changes, relevance, known issues, and restart implications. Cache metadata and source text with retrieval timestamps. Tie notes to the correct KB and Windows version. Label missing information as unavailable and cached information with its date; missing known-issue data is not evidence that no issues exist.

Baseline descriptions and official links must work without an AI account. Rich plain-language summaries are source-backed; any optional AI summarization is separately scoped and never invents fixes, severity, or compatibility. Sanitize fetched content and open external links in the browser, outside the privileged application surface.

Deliverable: live update list with traceable explanations and useful offline fallback.

### 5. Connect deliberate download and installation

Implement an explicit operation state machine, one active operation at a time. Revalidate selected package identities immediately before execution. Handle supersedence, dependencies, license terms, unavailable packages, exclusive installs, cancellation limits, partial success, and per-package error codes.

Persist operation IDs and outcomes; reconcile with Windows after app/helper crashes or reboot. An uncertain response must not cause a blind retry of an installation. Show restart requirements from actual results. Never initiate a restart automatically; an explicit restart command requires a clear user action.

Deliverable: end-to-end scan, read, select, download, install, and history workflow.

### 6. Verify and package

Test the policy transaction and restore logic, package-selection enforcement, IPC authorization, operation recovery, and explanation fallbacks. Run VM integration scenarios for fresh systems, existing pending updates, management conflicts, offline operation, UAC denial, partial failure, app closed, and post-reboot state.

Verify the actual Windows power menu after background activity in a clean manual-mode VM. Record the tested build and observation period; do not extrapolate a permanent guarantee from one run.

Package the UI and version-matched helper in a Windows installer. Verify installation, upgrade, and uninstall behavior. Provide a clear choice to restore defaults or retain manual policy on uninstall, and do not accidentally revert changes owned by another tool. Configure signing when a certificate is available; signing credentials are an external release dependency.

Deliverable: installable build, test evidence, and documented compatibility limits.

## Release acceptance criteria

1. Opening the app, reading details, and checking for updates cannot call download or install operations.
2. With verified manual mode enabled on a clean supported test machine, background activity does not install Windows packages or create an update-driven pending restart during the documented test period, including with the app closed.
3. Only explicitly approved packages and disclosed prerequisites are installed; newly discovered changes require renewed review.
4. Existing pending restarts and control failures remain visible; the app never claims that a reboot is guaranteed update-free.
5. Every available package has an understandable description or an honest unavailable state, with official links where provided and provenance for enriched notes.
6. Policy restoration preserves prior state and handles external changes without overwriting them blindly.
7. The app never automatically reboots and accurately reports completed, failed, partial, and uncertain outcomes.
8. Keyboard, screen-reader, theme, scaling, and compact-layout checks pass on the shipped frontend.

## Technical references

- [Microsoft: policy configurations by device type](https://learn.microsoft.com/en-us/windows/deployment/update/configure-policies-different-device-types)
- [Microsoft: legacy policy limitations](https://learn.microsoft.com/en-us/windows/deployment/update/avoid-legacy-policy-configurations)
- [Microsoft: Windows Update Agent API](https://learn.microsoft.com/en-us/windows/win32/wua_sdk/using-the-windows-update-agent-api)
- [Microsoft: update properties](https://learn.microsoft.com/en-us/windows/win32/wua_sdk/iupdate-properties)
- [Microsoft: cumulative update and servicing stack behavior](https://learn.microsoft.com/en-us/windows/deployment/update/servicing-stack-updates)
- [Tauri: capability boundaries](https://v2.tauri.app/learn/security/capabilities-for-windows-and-platforms/)
