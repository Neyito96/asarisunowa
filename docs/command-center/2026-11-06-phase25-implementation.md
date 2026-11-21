# Phase25 — COPY pipeline implementation and rollout boundary

## Result
Implemented an isolated GAS-compatible pipeline and COPY adapter; existing form,
production handlers, triggers, OAuth configuration, sheets and Spotify were not modified.
This is **not a completed production rollout**. Live COPY E2E is still blocked by
GAS project access. Module tests use injected local I/O, not live Spotify.

## Evidence inspected (2026-11-06 JST)
- PR #270 open/draft, head before this work `e3c2c54da580d16de959a3ff35a06de5870fd64b`; not merged.
- Ledger metadata: 6,678 grid rows including header. Last six EP IDs: 06672–06677.
  Only EP-06672 has L populated among these six. Headers A–X confirmed live.
- Request sheet H:I: 16 status-bearing rows: 確認待ち 5, 重複申請 1,
  増分自動更新 7, 取消 1, 復帰申請中 1, 人間削除 1.
  No maker names, invitation URLs, tokens or full request rows exported.
- Existing form submits registration and auto-update independently. Receipt requestId
  is cached for 600 seconds; durable duplicate detection is playlist based.
- Existing shared daily/hourly handlers are present in GitHub. Online project URL
  redirected to the Google Apps Script information page in the available browser.
  Actual triggers, properties, OAuth grants and online/source drift remain UNVERIFIED.
- Existing sync-playlists workflow runs at minute 17/47 and updates app/data.ts from
  the public sheet, then dispatches Pages. Latest inspected PR build succeeded:
  https://github.com/Neyito96/asarisunowa/actions/runs/42209265878
  This is not evidence of a new request having been published.

## Files and behavior
- `P25LibraryPipeline.js`: accepts existing url/updateType/keywords contract; one
  ledger read shared across rules, deduplicated playlist work, exact identity conflict
  detection, human review bound to rule revision + EP/GUID/Spotify/content, separate
  receipt/Spotify/publication states, durable pre-POST intent and readback recovery,
  manual removal tombstones, shared 429 cooldown, bounded batches and round-robin cursor.
- `P25CopyAdapter.js`: isolated project/sheet guards; existing nine-column COPY
  request sheet, append-only chunked state journal (committed versions only), paginated
  Spotify reads bracketed by snapshot checks, explicit COPY playlist allowlist, official
  RSS GUID comparison, and deployed HTML anchor readback. No automatic token refresh;
  COPY access token comes from COPY Script Properties, never a log or file.
- `tests/gas-phase25-pipeline.test.mjs` and PR-only workflow: no network or credentials.

Full rescans deliberately detect retroactive imports, title edits and URL backfills.
They are one scan per run, not one per playlist; per-row persistent fingerprints are
not yet an incremental optimization. Speaker/staff ambiguity is REVIEW_REQUIRED.
All candidates require exact review; a broad keyword does not authorize future writes.
Sources incomplete/unconfigured => SOURCE_UNKNOWN, absent GUID => SOURCE_MISSING.
Neither is inferred from Spotify zero differences. Source checks only cover configured
feed windows, not entire historical archives.

## COPY setup / execution
Use a new standalone COPY GAS project (not the Spotify production project) with these
2 new files. Prepare separate COPY request and state spreadsheets. Do not copy secrets
or install triggers. State tab `P25_STATE` row 1 is `key | version | part | json`.
Request tab `自動更新申請` uses the existing nine-column schema. Use newly created test
Spotify playlists exclusively, with test registration in an isolated preview when available.

Call `P25_RUN_COPY(config)` with:
- environment: COPY; copyScriptId: actual COPY project ID
- stateSheetId and requestSheetId: COPY IDs (both production IDs are rejected)
- ledgerSheetId: read-only ledger or a fixture copy
- copyPlaylistIds: explicit test-only allowlist
- write: false initially; maxAdditions: 1; legacyWriterDisabled: false initially
- officialFeedUrls: verified official URLs from existing source registry
- previewUrl: deployed preview path under the existing Pages origin, if available

Inspect `P25_INSPECT_COPY(config, playlistId)`. Review every plan candidate against
its episode identity/content and exclusions. Pass only approved candidate objects,
adding `revision: state.rule.revision`, to `P25_APPROVE_COPY`. This writes COPY state only.
Enable COPY write only with test target access confirmed and legacyWriterDisabled true.
Run twice: first adds approved missing IDs; second must POST zero. An uncertain POST
stays on HOLD until an operator reconciles it; absence alone never authorizes retry.

Existing registration -> publication sheet -> scheduled GitHub sync -> Pages remains
an independent route. The new pipeline only observes that route; it never publishes
or changes production registration. HTML readback requires an actual target anchor,
not HTTP200/build success/JSON text; it does not test visual layout or playback.
No new status endpoint or production dispatcher is connected yet.

## Verification
Run `node --test tests/gas-*.test.mjs`.
Coverage includes series/speaker/theme lifecycle, duplicates/conflicts, delayed URL,
changed evidence, manual deletion, uncertain/partial POST recovery, 401/403/404/429,
source unknown/missing, bounded batches, COPY destination isolation and publication.
Local mock verification does not establish live COPY or production acceptance.

## Remaining gates, exact production change plan
1. Read online Spotify GAS sources, manifest/scopes, property *names* and trigger
   inventory; compare with this branch. No changes until drift is resolved.
2. Provision/run isolated COPY with real test playlists and preview registration;
   verify identity/playability, actual website card and duplicate rerun. Import legacy
   manual deletions/exclusions before enabling any production candidate.
3. Add production dispatcher integration to existing daily/hourly handlers; it must
   bypass ALL legacy bootstrap/fixed/theme writers for migrated playlists under the
   same lock. This change is intentionally not yet present and needs review/tests.
4. Present a one-playlist, at-most-one-episode manifest with concrete EP/GUID/Spotify
   ID. Actual production target and write count are currently UNDETERMINED, not zero
   candidates. Request administrator approval only after this manifest is available.
5. Intended production rollout: 0 new triggers; replace dispatcher routing on existing
   common handlers after online inventory. Separate approvals for GAS deploy, state
   destination writes, Spotify add, and Pages publication. No merge/deploy in this task.
6. Rollback: disable new dispatcher for migrated targets; preserve journal/tombstones
   and reconcile pending writes before re-enabling legacy writers. Revert code to the
   recorded deployed version. Never automatically remove Spotify items or restore
   human deletions as rollback. Production episode removals require a separate decision.

Current production changes: GAS 0, sheet writes 0, Spotify additions 0, trigger changes 0,
Pages deployments 0. GitHub development-branch commit/PR updates are separate.
