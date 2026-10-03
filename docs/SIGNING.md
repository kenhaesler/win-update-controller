# Signed Windows builds

The public 0.1.3 installer remains unsigned. This pipeline does not provision certificates or publish a release. A release operator must provide a publicly trusted code-signing certificate backed by its supported private-key provider in CurrentUser/My, Windows SDK SignTool on PATH, and 7-Zip. Hardware tokens may prompt for their PIN. Private keys and passwords never enter the repository or command arguments.

Run from Windows PowerShell:

```powershell
./scripts/build-signed.ps1 -CertificateThumbprint '<40-character certificate thumbprint>' -TimestampUrl '<your provider RFC3161 URL>'
```

The script fails before building if signing prerequisites are missing. It signs the self-contained helper before bundling, uses Tauri's certificate configuration for the app and installer, verifies the installer and extracted app/helper signatures and timestamps, and compares the embedded helper hash. Verification evidence stays under ignored `.artifacts/`. An unsigned development build remains available through `npm run desktop:build`; use this script for a signed release candidate. Retain the generated signature evidence with release validation. Do not publish a candidate if this script fails. Signing does not promise immediate SmartScreen reputation.

Cloud signing providers that require a custom SignTool plugin or another tool need a provider-specific integration before this pipeline can be used; do not export their keys to make this script work. No certificate or signing service was available during development, so successful real signing and installed signature validation remain pending.

Configuration references: [Tauri Windows signing](https://v2.tauri.app/distribute/sign/windows/) and [Microsoft SignTool](https://learn.microsoft.com/windows/win32/seccrypto/signtool).
