# Phase15 P0 COPY MorningRunnerV19 source audit / read-only evidence gate
Directive commit: `36de940c0101e78fdb2c172692f82c296ececda3`.
Changes limited to this GitHub audit branch. Production/COPY Sheets, GAS, triggers, properties, public site: **writes=0**.

## Source audit
- Queried GitHub source index for `phase14CopyMorningRunnerV19`; no matches. Fetched recursive Git tree for exact directive commit (878 paths, not truncated); no standalone V19 GAS source identified. **Do not infer exact online function implementation or call graph from filenames/old GitHub snippets.**
- Actual online COPY GAS is `朝リスの田_Phase14_COPY_20261023`; user must open editor and search exact function name. Record file name, entire function body, called helpers, `SpreadsheetApp.openById`/target ID, RSS ingestion/backfill order, `LockService`, `PropertiesService`, cursor, feed iteration, timeout guard, per-item GUID/URL checks and write-ahead ID reservation. User must not execute or save changes.
- Trigger UI proves two time-based triggers pointing at V19, run at 05:11 and 06:15 on 10/27. **Configured trigger schedule / intended role per trigger unknown** until trigger detail is viewed.
- User-provided logs verify 05:11 run `PHASE14_COPY_MORNING_V19` OK and `PHASE14_COPY_INGEST_RECENT_TEN_V18` added5, existing25, held0, productionWrites0, propertyWrites0, triggerChanges0.
- Screenshot of 06:15 run verifies `phase14CopyMorningRunnerV19` ran 360.876 seconds and exceeded runtime; only final timeout error visible, not exact stalled helper, cursor or partial writes.
- Independent LIVE READ_ONLY COPY `エピソード台帳!A6630:J6650` shows last EP-06636 row6637, and `固定ID採番履歴!A67:I100` ends at same EP-06636. No evidence of **additional new episode registration** after 05:11; does not exclude edits to existing columns, partial backfill, a reservation in ScriptProperties or a transient prior write. No 06:15 historical snapshot available to prove zero writes.
- Production existing EP-06632 belongs to 10/14 こどもそうだんしつ. COPY EP-06632 denotes 10/27 MEDIA TALK. NEVER transfer COPY EP numbers to production.

## Risk / hypotheses
VERIFIED: two triggers on one function, timeout on second, COPY 5 episode additions on first; currently no later appended EP shown.
UNVERIFIED: call sequence, whether both triggers use different parameters/schedules, whether 06:15 backfill caused runtime exhaustion, whether LockService and safe cursor exist, exact source revision, writer connection target and any side effects.
LAB-only design: single writer per registry, GUID/URL idempotency and re-check inside lock, write-ahead reservations, input batch/cursor checkpoints, explicit time budget below 6 min (~4-5min only after actual code cost review), page-limited feeds, diagnostic counters at entry/exit/stop, do not change anything until independent approval.

## User-side read-only steps
1. Open COPY Apps Script editor, use Command-F `function phase14CopyMorningRunnerV19`; record file name and function body. If search inside file only, inspect all files with project search. Record only code fragments free of tokens.
2. For every callee inspect lines including ingest/backfill function, LockService, PropertiesService, RSS URL, spreadsheet IDs, timeout/cursor.
3. Open existing 2 triggers by clicking rows; read schedules/owner/events **without saving**.
4. In execution details of 06:15, check Cloud Logging for any earlier debug lines; absence is a visibility limit. No execution/retry.

## Other gates
Seven official RSS feeds + separate SDGs complete day inventory still SOURCE_PENDING; previous 5 COPY candidates were missing from production 6,632, but confirmed all-RSS missing total unresolved. Production writer and other projects/online triggers unverified.
A new production append, B GAS/trigger restoration, C public data update require **separate explicit approvals**. Existing W/COPY ACL and platform 12-cell holds remain independent.
