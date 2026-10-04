# Test the combined app

Branch: `codex/test-all-features`. Version: **0.1.4-test.1**. All 14 feature PR heads are merged through the verified integration branch, including its conflict resolutions.

The test build is named **Update Controller Test**, uses a separate app identifier and WebView settings/cache/reminders, and installs into its own Program Files directory. Your installed stable app can remain available. Test settings start with automatic Windows scans and Defender installation off. Closing the idle app exits it; an active operation stays in the tray.

The app still reads and acts on this PC's real Windows Update state. Policy, Windows-hidden packages, device exclusions and the protected activity journal are shared machine state. Manual downloads, installation and policy/rule changes use the real helper and request UAC. Test-app uninstall retains that shared state. Use a disposable VM for mutation, crash and reboot acceptance testing.

## Start

A verified extracted copy can run directly from the repository-local test package folder; it includes the helper and its runtime. The agent launches this copy for the initial test. To install for ongoing use, run `Update Controller Test_0.1.4-test.1_x64-setup.exe`, then open **Update Controller Test** from Start. The unsigned installer requires administrator approval. Native Windows notifications are best tested with the installed copy.

For another source checkout:

```powershell
git switch codex/test-all-features
npm ci
npm run desktop:build
```

## Suggested checks

1. Open Settings: verify real policy/restart status; try System, light and dark appearance. Move/resize, close and reopen the test app.
2. Check for updates with Defender automation off. Try search, Downloaded filter, sorting, Select visible and Select downloaded. Reading a package should not select it.
3. Open Microsoft notes, set a dated review reminder with a reason, close and reopen. Verify reminder persistence.
4. Open History, search operations and export diagnostics. Inspect unresolved package state; checking a retry selection should not download/install anything.
5. Inspect a driver and its hardware-ID exclusion explanation. Save/remove a rule only when deliberately testing its real machine effect.
6. On a disposable VM, download/install a reviewed package and inspect progress, tray completion, known issues, restart reporting and per-package history. Follow [VM-VALIDATION.md](VM-VALIDATION.md) for servicing/recovery acceptance.

Feedback should include the test version, steps, expected/actual behavior and relevant expanded error text. Exported diagnostics contain update titles and status/history; inspect the file before sharing it.

The candidate has passing automated checks and package-integrity validation. Live signing and full VM acceptance remain pending; see [VALIDATION.md](VALIDATION.md).
