# Phase 14 native fallback — incomplete, copy-only

## Evidence and boundary

2026-10-23 operator report: UrlFetchApp RSS 19 items, Omny JSON 10 matches,
SpreadsheetApp copy reads succeeded. Sheets REST returned 403 SERVICE_DISABLED;
Cloud project 16490564443 cannot be administered with this account. These are
operator-reported measurements, not a new Work runtime test. Do not repeat REST
403 probes or require Cloud Console changes.

New module: `LibraryOfficialNative.gs`, loaded alongside the existing parser and
engine. Existing REST entry points remain unchanged; **do not install their
triggers**. Use only `scheduledLibraryOfficialNativeNew` and
`scheduledLibraryOfficialNativeBackfill` for this experiment.

## Implemented

- Shared ScriptLock, independent new-fetch and historical workers.
- Historical worker: native reads, exact identity/date/immutable hash verification,
  bounded 50-row default (1–200), 120s default (5–240s), persisted cursor after each
  visited row, continuation after individual errors, repeat sweeps for retries.
- Metrics: scanned, JSON fetched, planned cells, written cells, held, remaining,
  elapsed time; every failure goes to execution log, last 10 to summary property.
- Native blank writes have a pending per-cell journal, readback, independent UTF-8
  receipt. Recovery accepts only the expected before/after row; other edits hold.
- Existing V3 identity hash is never rewritten. Formula, validation, note, merged
  cell and nonempty checks precede writes. AC uses RichText independent links.
- Existing sheets are READ_ONLY. SpreadsheetApp does not expose a proven equivalent
  to REST chipRuns inspection. Writes require newly created values-only fixture
  tabs and exclusive operator access, not merely a claim that the old sheet is safe.
- New worker fetches and verifies official RSS/JSON but returns
  REGISTRATION_BLOCKED_NONATOMIC, added=0. No partial multi-sheet registration and
  no new ID allocation. It is a fetch verifier, **not completed ingestion**.
- Production target is hard rejected. No publication or Spotify actions.

## Operator installation / copy test

Work supplies code; user/normal chat owns installation and supervision.
1. Save current copy source and properties. Verify script is the Phase14_COPY
   project and copy workbook is 1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY.
2. Add only LibraryOfficialNative.gs. Keep existing parser/engine; compare online
   versions before replacement. No Cloud API enablement required.
3. Run prepareLibraryOfficialNativeCopyFixture once. It READ_ONLY-fetches production
   EP-00141..150 and saved states, validates all proofs, then creates NEW copy tabs
   P14_NATIVE_FIXTURE / P14_NATIVE_STATE. Existing copy values (including previous
   70 fills) remain untouched. Failure leaves partial fixture for inspection;
   it refuses reuse/overwrite. It never modifies source baseline.
4. Run scheduledLibraryOfficialNativeBackfill with generated write=false config.
   Inspect proposals and holds. If production rows have changed, hash mismatch
   stops that row; never rewrite proof or clear filled cells to force a pass.
5. Stop other copy writers and manual edits. In LIB_OFFICIAL_NATIVE_CONFIG keep the
   generated sandboxToken and exact sheet names; set write=true. Run worker.
   Read actual copy cells and state back; compare all original nonempty cells,
   identities, baseline hashes, formulas, and link ranges. Record changed columns.
6. Run again: expect writes=0. Pending journals must be empty; do not call it a
   successful replay just because a failed row was held. Require held=0 as well.
7. Only after measured success set copyManualVerified=true. Set batchSize=3 to
   demonstrate continuation, keep write=true, run
   installLibraryOfficialNativeCopyTriggers (new fetch hourly, backfill two-hourly).
   Observe actual time-driven history and successive cursor values. Clock triggers
   have a scheduling window; exact next timestamp is not asserted.
8. Run removeLibraryOfficialNativeCopyTriggers after testing. Verify no matching
   triggers remain. This deletes only the two native test handlers.

For >5000 actual rows use write=false and existing copy ledger/state names, no
sandbox token required. Use a separate copy GAS or clear only the native cursor
property when intentionally changing target (mismatched target fails closed).
No broad native writes to existing sheets are permitted. Production remains off.

## Recovery

Stop native test triggers first. Preserve journal/state/logs. Re-run the worker
for an expected before/after pending transition. An unexpected hash is a hold,
not authorization to restore/overwrite. For abandoning a fixture retain/archive
its tabs; do not delete the source/copy ledger or reset original proof. No automatic
rollback writes are performed. A script lock does not protect against human edits
or different GAS projects: exclusive fixture access is a required test condition.

## Tests / acceptance (Work)

56 local tests passed: 31 engine/native + 25 regression. Added coverage for 6592
rows in 132 resumable calls, failure continuation (66 simulated failures), deadline,
blank protection, production refusal, pending-write recovery, unrelated edit
rejection, successful one-cell fill and replay zero writes. Simulated success is
not GAS or timer evidence.

Current acceptance: independent entry points and resumable design implemented;
real native copy write / replay / time-trigger resume NOT YET VERIFIED. No new
GAS deployment, copy writes or triggers performed by this change. Existing 19/10
fetch success is reused as input evidence, not claimed as native writer success.

Remaining: validate native fixture writes, replay and timer; design/validate
cross-sheet registration protocol or obtain an actually available atomic backend;
prove protection for production smart chips and uncooperative writers. New-fetch
worker caps JSON work at 20 per invocation and has no persistent new queue yet;
therefore do not enable it as unattended ingestion. Do not merge or deploy to
production. PR #254 stays Draft.
