# Validation and release status

12 September 2026 · Windows 11 Pro 25H2 · build 26200.9445 · x64.

## 0.1.1 administrator handshake fix

The user reported `Administrator helper authentication failed. (0x80131500)` when enabling manual mode in 0.1.0. .NET 8's `PipeOptions.CurrentUserOnly` compares token Owner SIDs: elevation can change Owner to Administrators although the account User SID is unchanged. The worker can therefore close the pipe before sending its nonce.

The transport now gives only the account User SID access through an explicit protected pipe ACL, sets that SID as owner, and verifies the owner against the worker's User SID. Child PID, broker executable, and nonce verification remain enabled. Different-account elevation remains unsupported.

Validation: 40 backend assertions passed, including actual pipe owner/ACL and communication checks. The published helper's `--check-elevation` diagnostic successfully completed the production UAC handshake from an unelevated process and returned real read-only Windows status (`ok: true`). Manual mode remained off; no policy mutation, update installation, or reboot was performed. This diagnostic is CLI-only and always requests status.

Root-cause reference: [dotnet/runtime issue 123903](https://github.com/dotnet/runtime/issues/123903). The original acceptance gaps below still apply to actual policy and servicing effects; successful elevation is now verified.

## Executed evidence

| Area | Evidence | Limit |
|---|---|---|
| Frontend | Production build succeeds; 9 unit tests pass | Pure action and link logic |
| Desktop packaging | Release executable and NSIS x64 installer generated | Installer execution untested |
| Backend | 37 assertions pass for protocol, fake-store transactions, crash recovery, external-change preservation, and source extraction | No HKLM mutation |
| Browser | 7 workflow/resilience tests pass | Preview and controlled native-adapter fixture |
| Accessibility | Axe WCAG A/AA dark/light primary-screen checks pass; compact/dialog focus tests pass | No manual Narrator certification |
| Visual review | Independent reviewer compared approved image and five rendered views; all listed fixes scored resolved | Does not certify Windows effects |
| Real status | Edition/build, policy, agent, conflicts and pending restart read successfully | Automatic updates enabled; no pending restart observed |
| Real scan | Three packages with metadata and bundles returned | No download/install |
| Real review | Exact Defender identity/revision resolved with review token | No license acceptance or mutation |
| Real history | 100 Windows entries returned | No new installation |
| Source extraction | Historical KB5065426 page returned Highlights, Improvements and Known issues with matching title and source date | Not a recommendation to install that package |
| Native boundary | Packaged WebView invoked status/history and rejected an unknown command | No elevation requested |
| Final package integrity | Installer extracted with 7-Zip; embedded helper SHA-256 matched the built helper. Extracted native app successfully repeated status/history and command-rejection checks | Extraction/read-only execution does not test installation or uninstallation |

Read-only evidence files `local-*.json` and `native-smoke.json` remain local and are excluded from Git. Screenshots are under `.impeccable/review/`. The native smoke script only populates local display cache with an actual scan result; it never calls mutation commands.

## Accepted outstanding tests

The user selected **No VM available — deliver with that test gap documented**. No running or inventoried Windows VM was available. No host reboot or actual installation was attempted.

Use a disposable Windows 11 Pro VM before treating the build as fully validated:

1. Enable manual mode through UAC; verify prior-value backup and agent behavior with the app closed, background checks, and reboot.
2. Observe the actual Windows power menu on a clean VM. Document an observation period with no unapproved installation or new update-pending restart.
3. Begin with a pending restart and verify honest reporting without clearing servicing state.
4. Deliberately download/install packages; exercise bundles, exclusive installs, licenses, partial failure, UI closure, worker crashes, reopening, and post-reboot reconciliation.
5. Reject UAC and test pipe/process/nonce checks under elevation and concurrent app instances.
6. Restore absent/existing DWORDs exactly; preserve external changes; interrupt transactions and recover.
7. Install, upgrade, uninstall the NSIS package. Check Program Files permissions, helper versions, restoration/retention choices, silent retention, and active-operation behavior.
8. Exercise managed-policy conflicts, unsupported systems, Defender paths, Narrator, 150%/200% Windows DPI, and offline cache behavior.

## Classification

Unsigned local development build with an implemented native backend, passing isolated/read-only checks, and an explicitly accepted system-mutation validation gap. Do not advertise unconditional prevention of update-and-restart behavior. Status separates policy configuration from runtime effects.
