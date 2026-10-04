# Feature PRs and integration

Each requested feature has its own branch and pull request. PRs with shared prerequisites target that prerequisite branch to keep their diffs focused. Merge prerequisites before dependents and retarget dependents to main afterward. No GitHub PR has been merged by this implementation task.

| PR | Branch | Base | Change |
| --- | --- | --- | --- |
| [#1](https://github.com/kenhaesler/win-update-controller/pull/1) | codex/release-notes-request-isolation | main | Isolate late release-note requests |
| [#2](https://github.com/kenhaesler/win-update-controller/pull/2) | codex/storage-robustness | main | Validate cache and tolerate unavailable storage |
| [#3](https://github.com/kenhaesler/win-update-controller/pull/3) | codex/scoped-selection-tools | main | Select visible or downloaded packages |
| [#4](https://github.com/kenhaesler/win-update-controller/pull/4) | codex/system-theme-window-state | codex/storage-robustness | System appearance and remembered geometry |
| [#5](https://github.com/kenhaesler/win-update-controller/pull/5) | codex/actionable-errors | main | Recovery actions and technical error details |
| [#6](https://github.com/kenhaesler/win-update-controller/pull/6) | codex/update-freshness | codex/scoped-selection-tools | Cached age, new packages, sorting and Downloaded filter |
| [#7](https://github.com/kenhaesler/win-update-controller/pull/7) | codex/policy-change-notifications | main | Monitor external update-control changes |
| [#8](https://github.com/kenhaesler/win-update-controller/pull/8) | codex/review-reminders | codex/policy-change-notifications | Date/reason review reminders |
| [#9](https://github.com/kenhaesler/win-update-controller/pull/9) | codex/installation-known-issues | codex/release-notes-request-isolation | Known issues and release health in install review |
| [#10](https://github.com/kenhaesler/win-update-controller/pull/10) | codex/persistent-activity-recovery | main | Persistent journal, exact-revision recovery, search/export |
| [#11](https://github.com/kenhaesler/win-update-controller/pull/11) | codex/device-driver-exclusions | codex/persistent-activity-recovery | Hardware-ID rules enforced by the controller |
| [#12](https://github.com/kenhaesler/win-update-controller/pull/12) | codex/operation-progress | codex/policy-change-notifications | Stream servicing progress and tray completion |
| [#13](https://github.com/kenhaesler/win-update-controller/pull/13) | codex/signed-release-pipeline | main | Verified Authenticode release build tooling |
| [#14](https://github.com/kenhaesler/win-update-controller/pull/14) | codex/disposable-vm-validation | main | Guarded servicing acceptance harness and evidence capture |

The `codex/feature-integration` branch combines these heads, preserves their separate commits, resolves shared App/API/helper/Rust conflicts, and adds cross-feature checks. It is the tested combined candidate, with no release publication. Its additional fixes skip excluded drivers in bulk/recovery selections and validate cached driver metadata. Review the individual PRs for feature scope; use the integration candidate to assess the full product together.

Live signing still needs a trusted certificate/private-key provider. Live servicing, reboot recovery, driver COM metadata, HKLM persistence, installed notifications, installer lifecycle and multi-monitor/DPI acceptance still need a disposable VM. Neither prerequisite was provided during implementation. See [SIGNING.md](SIGNING.md) and [VM-VALIDATION.md](VM-VALIDATION.md).
