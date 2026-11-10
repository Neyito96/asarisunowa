# V2 fast automation — 45-minute acceptance runbook

Source: `scripts/google-apps-script/LibraryV2FastAutomation.js` commit `e9b5321`.
This repository does **not** automatically deploy to the Google Apps Script project.

## Required one-time GAS deployment
1. Open the existing `朝リスの田_Phase2_隔離検証` Apps Script project.
2. Add `LibraryV2FastAutomation.js` from the GitHub branch, alongside the already deployed V2 writer.
3. Run `previewLibraryV2FastAutomation()`. It must report no V1 triggers. Check GAS Executions for any running V1/V2 invocation; stop old V2 hourly trigger if present.
4. Only after the checks, run `installLibraryV2FastAutomation()` once. It installs one five-minute time trigger and enables the property gate.
5. Wait for scheduled runs and inspect `自動補完・実行履歴` A:J and Apps Script Executions. Confirm V2_SUCCESS timestamps advance, written cell counts are positive, and no EP IDs/filled cells change.
6. `previewLibraryV2FastAutomation()` should show enabled and one trigger. After two consecutive exceptions, the controller removes its own trigger; when there are no matching blanks, it stops itself.
7. Emergency stop: `stopLibraryV2FastAutomation()` disables the property gate and removes only its own trigger.

## Scope and honest limits
- Each run processes up to 80 **existing GUID-verified episodes**. The 4,010 GUID-blank strict-match candidates remain on hold until independent Spotify/RSS identity verification.
- The existing writer fetches all feeds each run, uses script lock, checks V1 trigger conflicts, and writes only empty N/O/P/V cells.
- Existing writer does not independently verify every write after flush; this is a known improvement required for full auditability.
- No GAS execution, trigger installation, or spreadsheet write has been performed by the GitHub commit alone.
- Google time-driven triggers are approximate: every five minutes is not a guarantee of an exact wall-clock start.
- This is an operational procedure, not evidence that unattended processing has started.
