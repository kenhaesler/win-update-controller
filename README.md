# Update Controller

A Windows desktop app for understanding available updates and deliberately choosing when to download and install them. Built with Tauri 2, React, TypeScript, and a .NET Windows Update Agent helper.

![Implemented frontend in preview mode](docs/frontend-implemented.png)

## License and use at your own risk

Licensed under the [MIT License](LICENSE). The software is provided **as is, without warranty**. To the extent permitted by applicable law, the authors and copyright holders disclaim liability for claims, damages, or other liability arising from its use.

This app changes Windows Update policy and can download and install system updates. Use it at your own risk: changes can cause instability, data loss, or reduced security if updates are deferred. Keep backups and review the [validation limitations](docs/VALIDATION.md) before use. There is no guarantee that the app will prevent every automatic update or restart. Third-party components retain their own licenses.

## Test build

This branch is the combined 0.1.4-test.1 candidate. See [TESTING.md](docs/TESTING.md) for the separate test app, installation, and suggested checks.

## Run

Download the installer and checksum from the [latest GitHub release](https://github.com/kenhaesler/win-update-controller/releases/latest). Rebuilding produces `src-tauri/target/release/bundle/nsis/Update Controller Test_0.1.4-test.1_x64-setup.exe`. Install it and open **Update Controller** from Start. Installation goes to Program Files and requires administrator access. The UI itself runs unelevated. This development release is unsigned.

1. Open **Settings** and inspect the current policy and pending-restart status.
2. Choose **Enable manual mode** to back up the current policy and configure manual updating.
3. **Check for updates** retrieves metadata. With Defender automation off (the default), nothing is downloaded or installed.
4. Open a package to read its description, restart requirement, and official Microsoft notes.
5. Select checkboxes and **Download selected**. Review packages and any license terms.
6. Select downloaded packages and choose **Review installation**. Installation is a separate deliberate action. The app never initiates a restart.

To exclude unwanted packages such as monitor or USB drivers, select their checkboxes and choose **Hide selected**. Windows stores the hidden state across app and PC restarts. Use the **Hidden** filter and **Restore selected** to make them available again. Hide/restore requests administrator access and reports failures for each package; mandatory updates cannot be hidden. This applies to specific update identities, not every future driver for that device: a replacement published as a new update may appear. It cannot undo an installation already in progress or staged for restart. Hidden packages are excluded from the app's download and installation requests even if an older cached list still shows them.

### Optional automation

- **Check for controller updates** is enabled by default. On startup, a bounded GitHub release check compares the latest stable release with the installed version and suggests opening the release page. It does not download or run an installer. Settings also offers a manual check and reports network failures.
- **Check Windows updates on startup** is off by default. Enable it to scan once whenever you open the controller.
- **Automatically install Defender updates** is off by default. After each successful Windows update check, it downloads and installs eligible Microsoft Defender intelligence (KB2267602) and platform (KB4052623) packages. Enable startup checks too for automation on launch. There is no background service or periodic scan while the app is closed. UAC approval can still be required.

Defender eligibility is checked again in the administrator helper before download and installation. Only software packages and bundled components with allowlisted KB identifiers, accepted licenses, no user-input requirement, no exclusive installation requirement, and Windows' `irbNeverReboots` metadata qualify. Unknown metadata and hidden packages are excluded. Pending restarts block automation. Partial downloads and cancelled elevation do not trigger installation or automatic retries. The controller never initiates a restart; any unexpected restart requirement reported by Windows is surfaced. See Microsoft's [Defender update identifiers](https://learn.microsoft.com/en-us/defender-endpoint/microsoft-defender-antivirus-updates) and [restart metadata](https://learn.microsoft.com/en-us/windows/win32/api/wuapi/ne-wuapi-installationrebootbehavior).

Preferences are saved per Windows user in WebView local storage. Turning an option off affects future checks; an operation already submitted to Windows is allowed to finish.

The hide/restore UI and protocol are covered by automated tests; live Windows hide/restore and reboot persistence have not been exercised on this PC.

Closing the window during an operation keeps it running in the tray. Results are recorded before returning to the UI. If a process fails, inspect History and perform a fresh check before retrying; an unfinished journal is shown as uncertain, not successful.

## Implemented

- Graphite and light themes matching the approved mockup; master-detail and compact navigation, keyboard focus, reduced motion.
- Real Windows Update Agent scans: identity/revision, descriptions, download state, classifications, bundled components, and restart requirements.
- Read-only status and the latest 100 Windows history entries.
- Microsoft release-note extraction, KB-title matching, safe plain-text rendering, dated local cache, and explicit missing-data states.
- Separate reviewed downloads and installations, exact identity/revision revalidation, changed-review rejection, license review, exclusive-install checks, and per-package outcomes.
- Backed-up `NoAutoUpdate` changes, conflict detection, readback, crash-recoverable restoration, and preservation of externally changed values.
- Authenticated broker/worker IPC and serialized privileged operations. No generic shell or registry commands exposed to the frontend.
- Tray access and an NSIS uninstall choice to restore previous policy or retain manual mode. Upgrades and silent uninstalls retain policy.

## Validation boundaries

See [VALIDATION.md](docs/VALIDATION.md). The user accepted delivery without a disposable Windows VM.

**Actual policy application, UAC worker execution, installation, reboot behavior, and installer upgrade/uninstall behavior have not been exercised on a disposable system.** Development tests did not download or install updates or change this PC's Windows Update policy. The app reports policy configuration and agent state; it does not claim certified prevention of future forced updates.

Manual mode cannot undo an update already staged for restart. Cumulative fixes are indivisible packages. Managed PCs and policy conflicts are blocked from enabling manual mode. Store apps, third-party updaters, independent firmware tools, and separate Defender intelligence paths are outside this policy's complete control. Windows can change policy behavior between builds.

## Develop

Prerequisites: Windows x64, Node.js, Rust with MSVC build tools, .NET 8 SDK or newer capable of targeting .NET 8, and WebView2. The installer bundles the helper runtime; end users do not need the .NET SDK.

```powershell
npm ci
npm run desktop:dev
```

`npm run dev` starts a labelled browser preview with sample packages and simulated actions. It cannot modify Windows. Native runs use the real helper and never silently substitute sample data when it fails.

```powershell
npm run desktop:build
npm test
npm run test:e2e
dotnet run --project native/UpdateController.Tests
```

Install Chromium for browser tests once with `npx playwright install chromium`.

## Structure and data

- `src/`: React interface, typed adapter, preview fixtures, source reader, semantic theme tokens.
- `src-tauri/`: desktop shell, constrained routing, link validation, tray and installer.
- `native/UpdateController.Helper/`: COM, policy transaction engine, elevation, source extraction.
- `native/UpdateController.Tests/`: isolated tests with a fake policy store; no Windows mutations.
- `tests/`: browser workflow, resilience, keyboard, and accessibility checks.

Caches and theme preferences live in local WebView storage. Policy backup and last privileged operation live under `HKLM\SOFTWARE\UpdateController`, with normal administrator-write registry permissions. The only automatic-update value written is `HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU\NoAutoUpdate`.

Use Restore previous policy in Settings or choose restoration during interactive uninstall. Restoration refuses to overwrite externally changed values. Policy and recovery records are retained when uninstalling to preserve recovery evidence. No telemetry, cloud account, or API key is required.
