# 2026-10-17 GAS isolated project read-only follow-up (09:51–10:00 JST)

Source: user-provided execution logs from GAS project `朝リスの田_Phase2_隔離検証`, and direct read of connected Google Sheet `エピソード台帳` (6591 data rows). This is an observation log, **not** authorization to change production GAS or ledger.

## Environment and safeguards
- User reported isolated project has zero installed triggers, and created a backup before replacing `LibraryV2CheckpointEngine.gs` with GitHub commit `922f16e` version. Added `LibraryV2FeedDiagnostic.gs` from same commit.
- User confirmed helper `libV2CpOfficialItem_` exists in isolated GAS.
- Prior `previewLibraryV2UnifiedFast` at 09:52: `enabled:false`, `triggers:0`, `rows:6591`, `failures:1`, `writes:0`; checkpoint pointed at AJW feed offset 0. Failure count is historical state, not necessarily failure of this invocation.
- No user-reported write execution, property change, trigger install, production GAS deployment, or PR merge.

## Live read-only GAS observations
| Time JST | Function | Feed | RSS items | Matching | Unmatched | Holds / metadata | Eligible | Writes |
|---|---|---|---:|---|---:|---|---:|---:|
| 09:56 | `previewLibraryV2Checkpoint` | AJW | 25 inspected | not detailed | not detailed | holds 13 | 0 cells | 0 |
| 09:58 | `diagnoseLibraryV2Feed0` | ニュースの学校 | 488 | 485 GUID | 3 | 0 ambiguous; unsupported cast 485, Spotify 8 | 0 cells | READ_ONLY |
| 09:59 | `diagnoseLibraryV2Feed2` | AJW | 25 | 12 GUID | 13 | 0 ambiguous/conflicts; unsupported cast 12, Spotify 12 | 0 cells | READ_ONLY |
| 10:00 | `diagnoseLibraryV2Feed3` | 旧SDGsアーカイブ | 1092 | 8 GUID, 4 clip, 1080 official item | 0 | 8 ambiguous, 1084 show mismatch, 5 title mismatch (overlap possible) | 0 cells | READ_ONLY |

Details:
- AJW unmatched examples include Oct 12–17 2026 `The Latest NEWS`. Treat as **unmatched to existing ledger**, not confirmed safe new inserts. New episode registration is out of scope.
- ニュースの学校 unmatched examples: 2026-10-14 `簗和生氏の「予算カット」発言`, 10-15 `ニュートリノ`, 10-16 `ビール大手のカルテル容疑`.
- `matchedComplete` is a legacy alias for `matchedNoSupportedFill`, not a claim of full metadata completeness.
- 09:56 checkpoint `nextOffset:25`, `completeFeed:true`, `elapsedMs:9227`; diagnostics elapsed ~20.0s / 5.5s / 37.1s respectively. GAS cold-feed timings are material for 6-minute limit.
- Previous offline audit had AJW 24 RSS items and 12 unmatched; live RSS now 25 and 13 unmatched. **Do not compare snapshots as though immutable.**

## Direct Google Sheets spot-check (read only)
Read `エピソード台帳!A6570:L6579` in spreadsheet `1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4`.
- `EP-06577`: ledger show `こどもそうだんしつ`, title `【番組から大事なお知らせ】「こどもそうだんしつ」にリニューアルします`, date 2026-06-19, official itemid `92b59b17-c0bd-4344-a151-b46d00274fb8`.
- `EP-06578`: same ledger show, title `「こどもそうだんしつ」1分のトレーラー`, date 2026-07-06, official itemid `9c6ac3de-e2ee-4eaa-9972-b47b008eac21`.
- `EP-06569` through `EP-06576` (May–June 2026) also show `こどもそうだんしつ` in ledger despite preceding the documented renewal notice.
- This strongly suggests legacy SDGs episodes were relabeled in the ledger while RSS retains the old feed identity; it does **not** establish approval to globally alias the shows, rewrite labels, or bypass metadata checks.

## Decisions / open work
- User proposed excluding AJW and アルキキ from the **current preservation/fill plan**, while keeping existing 25 and 100 rows respectively. This is a planning decision; **no feed configuration was modified**. 朝ポキTV (15 rows) remains separate. Current working scope: seven principal shows, 6451 existing rows.
- Next: inspect representative RSS-to-ledger pairs across the June/July rename boundary, verify identity via exact official itemid, normalized title, and JST date; separately analyze 8 ambiguous candidates and 5 title mismatches. Consider a narrow **reviewed feed-to-ledger alias** only for verified identities, never broad unchecked replacement.
- Verify `旧SDGsアーカイブ` identity mapping and whether old feed is intended to remain active before altering feed list.
- Continue READ_ONLY. No pilot writes, properties, triggers, merge, or production deployment without explicit approval.
