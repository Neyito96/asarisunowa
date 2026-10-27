# Phase15 RSS新着収蔵仕様照合 / 2026-10-27 JST
**Directive:** f5263850211b9f4f4bf15b95ddf46dd8d854a5e1. READ_ONLY, non-GitHub writes 0.

## 確認された仕様分岐
- GitHub main at 4eafc62433df17de8857f03431dae845070eb4bf, docs/command-center/2026-10-27-command-center-handoff.md states `FAST_RSS_SHADOW_V2` checks **7 official feeds latest 3 each, READ_ONLY**. This is evidence of one shadow inspection mode, not definitive authority that production ingestion must cap each show at 3.
- User-supplied ONLINE code V19 invokes V18 `phase14CopyIngestRecentTenV18()` once. V18 reads all RSS items for all allowed rows in 取得元一覧; it filters to previous 7 days, sorts ascending pubDate/GUID, and breaks after **10 successful additions** or deadline (which starts only after RSS/full-sheet read). It does NOT slice each show to 3, nor cap 3 per feed. `feedCount=8` from 05:11 log, added5, existing25, outOfWindow6483. Maximum 10 is per invocation global **newly added rows**, NOT RSS fetch count or per-show inspection count. No persistent per-feed cursor in supplied V18.
- Live COPY 取得元一覧 A1:H100 identified exact **8** rows passing V18 URL/label filter: row2 ニュースの現場から Omny, row3 MEDIA TALK Omny, row4 こどもそうだんしつ Omny, row5 スポンジ Omny, row6 ニュースの学校 Megaphone TASC5851398719, row7 ドーナツ Omny, row8 報談 Megaphone TASC9421488254, **row11 旧SDGsアーカイブ Omny**. Excluded by V18 labels: アルキキ、AJW、朝ポキTV. Legacy SDGs not excluded and is eighth feed; target canonical policy for legacy SDGs requires separate approval. Distinct target show count 7 plus old SDGs archive 1. SDGs currently not simply an eighth new show.
- Each RSS item count is not capped by the visible V18 `for(item of E.rss(feed))` loop. Actual fetch/page depth is determined by `LibraryOfficialEngine.rss` and host feed responses, **online callee source NOT_VERIFIED**. Historical 取得元一覧 C column held `20` for the seven sources from earlier checking, but not a proven current RSS fetch cap. Cross-confirm with E.rss source before claiming exactly 20.
- Distinguish SHADOW inspection's 7×3 from production COPY registration's 8 RSS sources / rolling 7-day / 10 successful new adds. **SPEC_DRIFT_REVIEW** until owner approves whether 7×3 was only shadow preflight or canonical business rule. Do not silently switch production to 3-per-feed.

## Deterministic LAB scenarios (conceptual logic model, no GAS execution)
1. One show produces four new episodes inside 7-day window, 7 other feeds no new -> V18 would add 4 (subject to E.rss returning all, duplicate checks, time); a strict newest3-only strategy drops the fourth unless a recovery cursor/window exists.
2. 14 distinct new episodes within window across feeds -> first run adds at most10; next run sorts all and can add remaining4 if RSS still serves them, within age window, and completed entries are in history. A seven-day outage means expired items are never eligible even after recovery.
3. Time budget reached before any loop append -> 0 additions although source items exist; no permanent checkpoint. A slow feed or large legacy SDGs feed can exhaust runtime before deadline begins.
4. One show produces 4, other six produce 0 -> 7×3 inspection misses one within current scan; use 3 as priority preview, not sole harvest completeness guarantee.

## Observability / coverage proposal
Feed-level log fields: `feed_id,show,items_seen,latest3_checked,eligible_7d,already_registered,source_new,added,held,excluded,remaining,elapsed_ms,complete_page/cursor,fetch_status`. Separate fetch, inspect, register, and completeness metrics. No feed error as zero episodes; emit SOURCE_PENDING. Global monotonic time-budget before RSS; guarded stop/checkpoint before every I/O, resumable backfill of expired window, single authoritative writer and GUID/URL idempotency. Existing triggers unchanged.

## Hash audit
- COPY EP-06594 is `ニュースの学校 PHPの脆弱性`, V3 identity status PENDING_REVIEW and identity hash field empty. Existing V3 reviewedRegistrationEvidence includes `originalRegistrationHashMissing:true` and a separate `currentRowHash` from 2026-10-24; these are **different evidence levels**. Do not fill original proof or claim the 06:15 timeout caused this older omission.
- EP-06632 to EP-06636 have native registration log hashVerified=true, V3 identity proof nonempty and matching GUID across ledger/history/V3. Fresh rehash requires exact implementation of `LibraryOfficialEngine.rowHash`, canonical 55-cell values + Apps Script JSON serialization. **Native independent recomputation NOT_DONE**; no fabrication of hashes.
- Previous COPY ledgers 6636 and V3 6636 matched ID/GUID, history72 all completed, RESERVED0; does not prove every hash matched.

## Outstanding
All official RSS sources plus SDGs day-specific XML GUID/pubDate/URLs independently fetched: NOT_DONE, so 10/27 overall missing total SOURCE_PENDING; 5 COPY matches absent from 6632 production verified earlier. Production writer target and other triggers NOT_VERIFIED. EP-06632 production GUID protected; COPY ID never transplanted. New production registration, GAS/trigger revision and library/universe publication separate approval gates. Writes to Sheets/GAS/public=0.
