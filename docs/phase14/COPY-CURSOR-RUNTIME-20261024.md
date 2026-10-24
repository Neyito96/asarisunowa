# Phase 14 COPY GAS v0.7 runtime handoff — 2026-10-24

## Verified user-supplied online GAS logs
- 13:48:25 JST status: cursor=2, lastRow=6594, batchSize=200, zero writes.
- 13:49:28 JST run: startRow=2, endRow=201, nextRow=202, scanned=200, included=140, excluded=60 (アルキキ37, AJW23), propertyWrites=1, auditLogWrites=1, episodeWrites=0, triggerChanges=0.
- 13:51:03 JST run: startRow=202, endRow=401, nextRow=402, scanned=200, included=120, excluded=80 (アルキキ63, AJW2, 朝ポキTV15), propertyWrites=1, auditLogWrites=1, episodeWrites=0, triggerChanges=0.
- Combined: 400 scanned, 260 included, 140 excluded; all three excluded shows accounted for in first 400. Cursor currently 402 *as of last supplied run*; not independently re-read.
- Prior complete COPY audit: 6593 records; included 6453, excluded 140 (アルキキ100, AJW25, 朝ポキTV15); included GUID missing 5257, GUID present 1196; existing Spotify 6426, Pocket Casts 6411.
- Exclusion applies to Phase14 new ingestion and backfill, not deletion from existing ledger.

## Scope and distinctions
- COPY workbook: 1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY.
- COPY GAS script property PHASE14_V07_COPY_CURSOR and audit tab Phase14_V07_巡回監査 may be written by the tested function.
- This v0.7 is a scan/log cursor, NOT a proven backfill-completion cursor. Never advance a backfill checkpoint for rows merely inspected; hold failed/uncertain rows.
- No production spreadsheet, public library, playlist, main branch, or GAS trigger changed in this run.
- The v0.7 runtime tests do not establish scheduled execution, RSS fetching, exact URL identity, backfill writing, atomic registration, or production readiness.

## Existing implementation reuse
- scripts/google-apps-script/LibraryOfficialRssEngine.gs includes scheduledLibraryOfficialNew() and scheduledLibraryOfficialBackfill(), but requires configuration, source verification, original V3 hash compatibility, runtime gates, and failure/retry validation.
- docs/phase14/INTEGRATION-20261023-registration-path.md documents that LibraryOfficialNative.newScan() remains blocked (REGISTRATION_BLOCKED_NONATOMIC).
- Do not replace the production V3 project or bypass STATE_HASH_CONFLICT.
- Distinguish READ_ONLY scan cursor, COPY scan cursor, and future backfill write checkpoint.
- Future work: read exact existing engine implementation, verify show allowlist/exclusions and copy-only target configuration, test identity proof and replay with copy only, then consider COPY-only timed trigger after explicit review.
