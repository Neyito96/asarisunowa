# Phase 14 official RSS / JSON GAS port — staged validation

Status: **draft, not deployed or enabled**. Latest main base: `8df00f6bb6be7bdba4886a594db822893aefb480`.

## Implementation

- `LibraryOfficialParser.gs`: isolated namespace, generated from the existing V3 mechanical cleaner and Phase 11 section parser used by Phase 13. Adds the common `【出演】` heading and terminates staff at promotional headings. No Node/browser-only globals.
- `LibraryOfficialRssEngine.gs`: separate new and historical entry points, script lock, bounded batches/deadline, persistent priority-pass cursor, official UUID/GUID/history/decision reservation checks, blank-only CellData plans, per-cell old/new/source notes, atomic new ledger/history/state batch and readback. Original exclusion/publication columns are never modified by historical fill.
- Current RSS is not a complete historical archive. Historical fallback retrieves the official Omny clip JSON by the existing GUID, then requires the stored title and exact publication date to match. It does not invent an RSS description; V contains the unabridged official JSON description and its note identifies JSON provenance.
- AC preserves existing text; blank AC receives individual rich links. X retains all staff; AT:AX only contain the first five, AY identifies the evidence. Missing optional staff fields do not block ingestion.
- Exact Apple episodeGuid + feedUrl lookup is implemented as optional enrichment. Spotify/LISTEN/Pocket/Pody network discovery is **not yet ported**; no URL is guessed. Existing URLs are retained.
- No main/Pages/Spotify playlist changes. No V3 file replacements or manifest edits.

## READ_ONLY live ledger counts

6,592 registered records, 2026-10-23. Empty cells (not a claim that every empty field is applicable):

| Column | Empty |
|---|---:|
| P | 98 |
| V | 316 |
| W | 810 |
| X | 639 |
| AC | 5,904 |
| AT | 649 |
| AU | 687 |
| AV | 3,557 |
| AW | 5,961 |
| AX | 6,591 |
| AY | 670 |
| AZ / BA / BB / BC | 5,500 each |

## Actual copy test

The whole workbook was copied before any cell edits. Copy ID: `1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY`.

- Target: ledger rows 142–151, EP-00141 through EP-00150, all missing V.
- Current RSS matches: 0; official clip JSON identity matches: 10/10; JSON fetch failures: 0.
- Generated GAS pure plans ran locally; their 70 native Sheets requests were applied to the real copy through the Sheets connector. **This was not a remote GAS execution or end-to-end scheduler test.**
- Successful fills: J=10, V=10, W=10, AZ=10, BA=10, BB=10, BC=10. P/X/AC/AT:AY=0 (preserved or absent from official evidence).
- Actual CellData readback: 70/70 matched. Raw description exact: 10/10. Nonempty overwrites: 0. Recomputed replay writes: 0. No new IDs, no history/decision edits.
- Existing V3 identity row hashes did not match the current rows for all 10. Date serial vs ISO representation was checked, but the discrepancy remains unresolved. The production runner fails closed with `STATE_HASH_CONFLICT`. We did not rewrite baseline proofs to make the test pass.
- Existing values that differed from JSON were retained (including rounded duration, media query parameters, existing article text/source URL). They are reported as preserved conflicts, not overwritten.
- Native formatting/validation were read and retained; no column resizing. Google-rendered visual fit has not been checked.

## Local tests

16 new tests plus 25 existing regressions pass (41 total). Coverage includes unabridged raw, duration, staff overflow, role retention, rich article links, replay, formula/chip/validation protection, GUID/UUID/tomb/history duplicate guards, baseline/cutoff/counter guards, disabled writer and optional Apple failure. These are not a substitute for online GAS runtime verification.

Commands:

```
node scripts/phase14/build-parser.mjs
node --test tests/library-official-gas.test.mjs tests/library-public.test.mjs tests/sdgs-integration.test.mjs tests/library-phase11.test.mjs tests/pages-preparation.test.mjs
node scripts/phase14/verify-copy.mjs before.json after.json evidence.json
```

The verifier consumes private native CellData captures and JSON evidence; production ledger contents are not committed.

## Production gate / remaining work

1. Obtain current online source + live V3 properties and trigger list. The last Mac report says zero triggers in this project; **not freshly confirmed from Work**. Work has Sheets access but no authenticated Apps Script execution/deployment connection. Do not infer baseline/config state from the mere existence of state rows.
2. Resolve the ten legacy row-hash mismatches with the current V3 hash implementation and original baseline evidence. Preserve old proof; do not rebaseline all rows as a shortcut.
3. On the actual GAS runtime, run `inspectLibraryOfficialReadOnly()` after adding the isolated modules to a copy project. This reads properties/triggers only. Confirm the live V3 and other writers are paused and inspect execution history in the editor.
4. Configure `LIB_OFFICIAL_CONFIG` for the copy, with explicit feed allowlist and cutoff. Defaults remain disabled. `engineValidation` must remain unset until runtime review and transaction/failure tests are complete. Validate copy new-record append/retry, historical state transition, Sheets REST OAuth scopes, response shapes, exception retry and time limits. Never set validation flags solely because pure parser tests passed.
5. Only after those gates, preserve fresh production ledger + state + allocation snapshots, run a one-record production smoke batch, verify readback/replay, then record the validation evidence. Roll back only the exact verified cells and state transition if their current values still equal the attempted new values; never replace the full ledger or reuse an allocated ID.
6. Trigger installer checks flags and rejects existing project triggers / enabled V3 writers. Proposed cadence: hourly new ingestion (covers releases after 06:35), every two hours backfill, with a recent successful new poll required before production backfill. **No triggers were installed; no next execution is scheduled.** Script locks do not coordinate independent GAS projects or manual writers.
7. Port remaining platform enrichment separately, retaining exact identity evidence. Keep Pages/publication and playlists outside this rollout.

Production writes in this phase: **0**. New registrations: **0**. All 6,592 existing rows, allocation history, held/excluded decisions, public sites and playlists remain unchanged.
