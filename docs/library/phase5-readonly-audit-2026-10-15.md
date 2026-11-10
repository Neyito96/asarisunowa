# Phase 5 READ_ONLY audit — 2026-10-15

## Purpose
Restore the existing Asarisu-no-Ta submission-to-Spotify playlist workflow while preserving current RSS auto-updates (新聞をめくろう / ポリレビ / ノーミライ), and establish a safe episode library for future multi-platform 朝リスの宇宙. This is an audit record, not an instruction to deploy or rewrite production.

## Scope and method
- Google Sheet test library `1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4`, `エピソード台帳`, A2:AY6592.
- 6,591 records scanned in seven READ_ONLY batches on 2026-10-15.
- No spreadsheet writes, live Spotify API calls, URL HTTP checks, audio playback, or production modifications.
- Values present do not imply verified correctness.

## Coverage
| Field | Present | Missing |
|---|---:|---:|
| Spotify episode URL (L) | 6425 | 166 |
| Pocket Casts URL (AP) | 6411 | 180 |
| LISTEN URL (K) | 0 | 6591 |
| Pody URL (AQ) | 0 | 6591 |
| Apple URL (M) | 0 | 6591 |
| Audio URL (O) | 1035 | 5556 |
| Description raw (V) | 5707 | 884 |
| Description cleaned (W) | 5707 | 884 |
| Cast/staff (X) | 5952 | 639 |
| Cast evidence (AY) | 5921 | 670 |

- All nonblank Spotify URLs passed a basic `https://open.spotify.com/episode/<22-character-ID>` shape test; no HTTP or Spotify identity verification performed.
- 31 records have cast/staff populated but no cast-evidence entry.
- 1,504 records have identical nonempty raw and cleaned description strings. This is a *review candidate*, not proof of bad cleaning.
- 166 records have dates beginning with 2020. Simple form/announcement keyword scanning of first 600 characters of cleaned text found 0 hits; does not resolve user's observation about early ニュースの現場から boilerplate. Review actual early descriptions and cleaning pipeline separately.

## Cross-series Spotify URL duplicates
- 261 repeated Spotify URL occurrences (each second-or-later URL occurrence); all 261 detected across different `番組名` classifications.
- Example: EP-01221 (`スポンジ`, 相撲 #193) and EP-01444 (`ニュースの現場から`, #193) share the same Spotify URL, date, and core title. Similar pairs EP-01220/EP-01445 and EP-01219/EP-01455.
- **Do not delete or merge automatically**. May represent one canonical episode belonging to multiple editorial series. Design separate episode identity and series membership with preserved original IDs and references.

## Classification/title issues
- EP-00308 onwards: original `SDGs` source tab items are currently labeled `こどもそうだんしつ`. EP-00308 title `SDGsのこと、シンプルに話そう ... #0`. Preserve historical show attribution separately from present grouping.
- EP-00592: `ニュースの学校`, title `ワシントン条約`, 2025-12-09, while source 1007 held row 283 says `レーダー照射`. EP-00590 separately has `レーダー照射` on 2025-12-10. Keep HOLD pending official RSS GUID/title evidence.
- All-show count: ニュースの現場から 2641; MEDIA TALK 1750; こどもそうだんしつ 1123; スポンジ 173; ニュースの学校 486; ドーナツ 60; 報談 218; アルキキ 100; AJW 25; 朝ポキTV 15.

## Editing safety design (proposed; not implemented)
1. EP-xxxxx remains immutable internal primary key, independent of sheet row or title.
2. Store external IDs/GUID, canonical episode identity, series membership, platform links separately; link cross-series duplicates without destructive merging.
3. Raw RSS/official description immutable; cleaned text versioned and editable.
4. Track provenance, verification status, timestamps and manual override per field.
5. Sync jobs are append/upsert by stable ID with idempotency and explicit HOLD for conflicts; never overwrite human edits or exclusion.
6. Run a dry-run diff and regression tests before any live write or playlist update.
7. Maintain existing new-episode acquisition and production automations until separately tested.

## Remaining work
- Verify Spotify URL <-> correct episode by official GUID, URL and date, beyond format check.
- Quantify title discrepancies and cast name normalization with structured evidence.
- Audit 2020 descriptions by reviewing actual text and cleaning rules; don't equate raw==cleaned with a failure.
- Check links and audio playback separately and sparingly with provenance.
- Review read-only playlist flow and identify the Spotify endpoint returning 403; library read substitution cannot solve Spotify write-API authorization failures.
- Prototype safe series-membership schema and ingestion dry-run. No production cutover approved.
