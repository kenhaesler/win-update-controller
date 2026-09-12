# Update Controller
<!-- impeccable:product-schema 1 -->

## Platform
Windows desktop application, using a web frontend in Tauri.

## Stack
User selected Tauri + React. TypeScript, Vite, CSS/Tailwind, Motion. A narrowly scoped .NET helper provides Windows COM operations and elevation, while Rust owns the desktop boundary.

## Users and purpose
A personal Windows PC owner who wants quick ordinary reboots without unapproved background installations, and wants to understand update changes before choosing packages to install.

## Confirmed workflow
Check and read without downloading or installing. Explicitly select, download, review, and install. Never automatically reboot. Explain package changes and link official notes. Manual-mode policy changes must be reversible. Existing pending restarts must be reported honestly.

## Visual commitment
The user approved the generated graphite Windows desktop mockup and asked to build the app like it. Preserve its master-detail layout, top control status, compact navigation, subtle glass title bar, blue accent, and bottom action bar. Dark and light themes.

## Evidence and boundaries
IMPLEMENTATION_PLAN.md defines the intended scope and test gates. Initial target is unmanaged Windows 11 Pro x64. Actual policy behavior must be tested, not inferred from a registry value. No pre-existing app or tests. No signing certificate or disposable VM has been provided.
