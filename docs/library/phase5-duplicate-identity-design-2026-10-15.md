# Phase 5 — duplicate identity / multi-series design (READ_ONLY, 2026-10-15)

## Evidence
Read-only scan of 6,591 `エピソード台帳` records in test Sheet `1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4`. Among Spotify URL repetitions, 261 repeated occurrences were found, all across different show classifications. For all 261 pairs both `元ページURL` and `公式個別URL` are nonblank and match exactly. 196 have identical date *strings*; 65 differ in string formatting at least in sampled cases. Do not infer that all 65 are equal timestamps until normalized comparison.

| Series pair | Pairs |
|---|---:|
| スポンジ ↔ ニュースの現場から | 127 |
| 報談 ↔ ニュースの現場から | 121 |
| こどもそうだんしつ ↔ スポンジ | 8 |
| MEDIA TALK ↔ スポンジ | 5 |
| **Total** | **261** |

Example EP-01221 (`スポンジ`) and EP-01444 (`ニュースの現場から`) share Spotify URL, official page and original page. Preserve both legacy IDs.

## Proposed schema (not implemented)
- `episode_core`: canonicalEpisodeId (new immutable identifier), official GUID/source namespace, canonical original/official URLs, published timestamp, raw title and raw description, provenance and verification state.
- `episode_alias`: old immutable EP-xxxxx -> canonicalEpisodeId; source-specific identifiers and platform URLs. Never renumber or delete historical IDs.
- `episode_series_membership`: canonicalEpisodeId + seriesId + attribution kind (original show / editorial series / legacy grouping) + evidence. Multi-membership allowed.
- `episode_curated`: human-curated title, cast, cleaned description, field-level lock, editor and timestamp, version and change reason.
- `episode_platform_link`: canonicalEpisodeId + provider + episode URL + provider ID + last verification status/time. Distinguish platform link from actual audio URL.
- `episode_review_queue`: unresolved conflicts, original values, reason, human decision, evidence and status.

## Matching policy
1. Exact provider episode ID or exact official GUID scoped by feed -> high-confidence candidate, but detect conflicts.
2. Same Spotify episode URL **and** same official episode page and source page -> high-confidence identity; keep multi-series memberships and legacy aliases.
3. Title/date-only matches -> HOLD for manual review.
4. Cross-platform equivalence without shared IDs -> HOLD until official source corroboration.
5. No automatic merges, deletions, reassignment of legacy IDs, or overwriting human edits.

## Safe migration plan
1. Produce a READ_ONLY canonical grouping preview (counts, all aliases, all memberships, conflicts).
2. Review anomalous groups, especially EP-00592 title conflict and historic SDGs vs こどもそうだんしつ grouping.
3. Implement test-only, idempotent migration, snapshot/rollback, invariant checks (all 6,591 EP IDs resolvable; 261 cross-series links preserved; zero human exclusions overwritten).
4. Only after approved tests, integrate library read path into submission matching; preserve existing RSS update and Spotify write operations unchanged until independently validated.

## Known limitations
No Spotify/official URL HTTP requests, no audio playback, no official RSS verification, no production writes. Matching URLs are strong library-internal evidence, not external proof of link health or content.
