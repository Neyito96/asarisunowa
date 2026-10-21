# Phase 5 — canonical grouping dry-run preview (2026-10-15)

## READ_ONLY execution
Read all 6,591 records of `エピソード台帳` (A2:AY6592) from Google Sheet `1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4`. No sheet writes, no Spotify API calls, no actual merges.

## Preview result
- Existing rows: **6,591**.
- Unique legacy EP IDs: **6,591**, no repeated or malformed EP IDs.
- Nonblank Spotify episode URL rows: **6,425**; blank: **166**.
- Hypothetical canonical episode groups, by Spotify episode ID when present and legacy EP ID otherwise: **6,330**.
- Exactly **261** two-member groups; no groups of 3 or more in this pass.
- All 6,591 legacy records remain addressable as aliases or separate candidates; no deletions.

## Differences within the 261 duplicate groups
| Field | Groups with >1 distinct nonblank trimmed value |
|---|---:|
| Title | 123 |
| Cleaned description | 137 |
| Cast/staff | 2 |
| Original page URL | 0 |
| Official episode URL | 0 |
| Audio URL | 0 |

These comparisons are exact string comparisons after outer trimming, not semantic conflict counts. Cast differences observed in two sample groups appear to be linebreak/whitespace variations. Cleaned descriptions can represent genuinely different editorial summaries and **must not be overwritten**. Title differences can reflect series prefixes or editorial framing.

Examples:
- EP-00946 and EP-03367: same Spotify ID, distinct cleaned descriptions describing the 報談 announcement and Tokyo assembly election; retain both.
- EP-01004 and EP-02909: title punctuation difference.
- EP-01082 and EP-03727: series labeling difference in titles.

## Proposed migration invariants
1. Every legacy EP ID maps to exactly one canonical candidate; preserve all 6,591 rows and legacy IDs.
2. Every canonical candidate has 1+ series memberships; all 261 double-memberships preserved.
3. Retain each row's title, raw description, cleaned description, cast and provenance as series/source-specific variants, even if strings differ.
4. Spotify episode ID is a provisional grouping key; missing-Spotify records remain separate until corroborated by official GUID/source page.
5. Any collision in provider IDs, incompatible source URLs or manual exclusion -> HOLD, not auto-merge.
6. Production playlist automation and current RSS incremental updates remain unchanged.
7. No data mutation without a reviewed dry-run, snapshots, tests, and explicit approval.

## Next READ_ONLY steps
- Normalize date formats and compare timestamps across the 261 groups.
- Review the 137 cleaned-description differences by type: legitimate series editorial versions vs cleaning defects.
- Check the 166 Spotify-missing records against official GUID/source URL and existing canonical groups.
- Inspect 2020-era descriptions and cast evidence for targeted QA.
