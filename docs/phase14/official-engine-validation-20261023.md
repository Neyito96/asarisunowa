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


## 2026-10-23 follow-up: Issue #255 execution plan (not yet a runtime result)

The next work is split into two independently testable tracks. **No live trigger should be installed as a substitute for either.**

### Track A — diagnose the ten V3 state hashes (read-only)

1. Retrieve the exact *online* V3 hash implementation and the original `identity[2]` creation code, not a reimplementation inferred from this PR.
2. On EP-00141–EP-00150, capture the original V3 state, current native `CellData` A:AY and V3 creation evidence without changing any cell or proof.
3. Compare byte-for-byte serialized hash inputs, including column count/order, spreadsheet date serial versus JST timestamp, empty strings versus null, numeric versus string cells, Unicode, JSON serialization, and base64url padding. Record the first differing index for each row.
4. Distinguish serialization differences from real edits made after the baseline. If baseline provenance cannot be proven, mark the row **HOLD**, not `VERIFIED`. Never replace the saved hash or bypass `STATE_HASH_CONFLICT`.
5. Re-run the ten-copy test with the exact V3-compatible algorithm only after evidence proves compatibility; verify zero nonempty overwrites and zero replay changes.

**Code review lead:** `LibraryOfficialEngine.rowHash` currently canonicalizes column D through `utc()`, and numeric AF/AH/AI indices (31/33/34) through `utc()`, then uses `Utilities.base64EncodeWebSafe(SHA256(JSON.stringify(a)))`. The original V3 implementation must be compared directly. This is a hypothesis to investigate, **not a proven root cause**.

### Track B — online copy GAS test (does not require production approval)

1. Inspect the current Apps Script project source, properties, OAuth scopes, triggers and recent executions in read-only mode. The GitHub `.gs` files alone are not proof of deployment.
2. Install the two isolated `.gs` files in a **separate copy GAS project** pointing only to copy workbook `1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY`. Do not change the production project.
3. Run `inspectLibraryOfficialReadOnly()` and record the actual project ID, target spreadsheet ID and triggers. Verify the script has the correct Sheets API scopes and no competing writer.
4. Exercise RSS and official JSON fetches and the blank-only planner on copy rows; test formula/chip/validation protections and failure paths. Do not set `engineValidation='P14_RUNTIME_VERIFIED'` merely to bypass a gate.
5. Test a copy write/replay only after a valid V3 hash is independently established for that copy. Verify row and state readback; keep the original evidence immutable.
6. Test a **copy-only** time trigger after the manual execution succeeds. Remove it afterward and record run logs and actual effects. Production remains disabled.

### Acceptance and handoff

Report independently: (a) each of ten hash diagnoses, with exact serialized input and root cause or HOLD; (b) real GAS execution logs and copy test; (c) production 1-record smoke eligibility. Keep PR #254 draft until gates are passed. Historical records remain blank-only; all existing nonempty values, EP-ID/GUID, exclusion/decision, allocation and V3 proof are protected.

## Issue #255: online V3 comparison and copy GAS attempt (2026-10-23)

Online source was inspected in the original GAS editor, without editing or executing its writer functions:

- `libV3Context_`: `getDataRange().getValues()` (entire native row).
- `libV3Hash_(v)`: `libV2CpHash_(JSON.stringify(v))`.
- `libV2CpHash_(s)`: SHA-256 followed by `Utilities.base64EncodeWebSafe`.
- Baseline identity stores `libV3Hash_(r)` without trimming or date conversion.

The Phase 14 implementation differed in three concrete ways: always 51 columns, REST numeric serial dates instead of native GAS cell values, and unconditional date/type/blank normalization. Fixed `rowHash` to hash exactly the supplied native full-width row. The writer now obtains that row through SpreadsheetApp before checking the proof. It no longer replaces `state.identity[2]`; a separate versioned receipt records only verified subsequent blank-fill transitions, bound to the original immutable baseline. A mismatched initial baseline still stops writes.

Dates in native arrays JSON-serialize as ISO strings; a Sheets REST serial number does not. Empty strings, nulls, booleans and numbers also remain distinct. Both implementations use web-safe Base64 with padding; changing Base64 or removing padding was not a demonstrated cause. No baseline values were changed and no rebaseline was run.

**These code-level defects are confirmed, but they do not yet explain every saved hash for EP-00141–EP-00150.** Local variants did not reproduce the saved proofs. The native runtime diagnostic must determine actual types/widths and whether historical cell changes are involved. Do not interpret passing local tests as proof that those 10 stored hashes now match.

### Online observations

- Original GAS: current trigger list contains 0 entries.
- Execution history includes earlier `ALIB_AUTO_tick` time-driven executions on October 21. Therefore “0 current triggers” does not mean no historical automation.
- Observed Morning READ_ONLY log, UI timestamp `2026/10/22 22:41:44`: config `{}`, state `{}`, baseline offset 6591 / complete true, triggers `[]`, writes 0. This is a dated log, not a fresh configuration read.
- New standalone project created: `朝リスの田_Phase14_COPY_20261023`.
- Copy GAS editor: https://script.google.com/home/projects/1roni6h_C9vKxtP_2I6jGgXKE2KJ1yRRhE3ZD1JsZ6XXRnT5RcndqyfJo/edit
- A READ_ONLY diagnostic was saved in its default code file. It reads the 10 specified copy and original rows, computes native full/first-51 hashes, reports matching widths/types/date ISO values and saved hashes. It has no sheet setters or trigger creators.
- Execution was attempted. It stopped at initial OAuth authorization / “Google hasn't verified this app”. No execution-success log was produced. User action is required for granting new app access.
- The complete parser/engine modules have **not yet been installed in the copy GAS**; only the diagnostic is present. The checked-in `inspectLibraryOfficialCopyHashesReadOnly()` carries the same diagnosis for subsequent installation.

### Actual results in this follow-up

- Local tests: 46 passed (21 engine + 25 regression); parser regeneration succeeded.
- Copy GAS successful executions: 0 (authorization pending).
- Copy ledger new fills: 0 episodes / 0 cells; nonempty overwrites: 0.
- Runtime replay: not executed; local replay test passes.
- RSS/JSON fetch from GAS: not executed.
- Copy timer creation/execution: not executed; no test triggers to remove.
- Production writes / saved-proof changes: 0.
- PR remains Draft; main unchanged.

Previous copy-sheet connector verification of 70 cells must not be counted as GAS execution evidence. Those existing nonempty cells must not be cleared to manufacture a new test.

Resume after authorization: run native diagnostic, resolve all initial hash conflicts (or hold those rows), then install the complete modules and validate READ_ONLY RSS/JSON acquisition. Only after a verified copy manual fill and zero-change replay may copy time-driven tests start. Delete all test triggers after observation. Production is not ready for activation.

## Runtime result after user authorization — supersedes earlier hash hypothesis

Native GAS execution **completed** at 14:59:24; bounded per-row logging completed at 15:01:24 (editor-displayed times, October 23). A further run compared explicit UTF-8 and US-ASCII. Evidence: `native-hash-runtime-20261023.json`.

**Root cause is now reproduced, not inferred:**

1. The original V3 two-argument `Utilities.computeDigest(SHA_256, string)` produced exactly the explicit **US_ASCII** result in this runtime. Phase 14 supplied **UTF_8**. All ten production rows match the saved baseline under the legacy call and US_ASCII; none matches UTF_8.
2. The baseline covers **51 columns (A:AY)**. Today's ledger is 55 columns after AZ:BC extension. All ten production rows match at width 51; not width 55. The preceding follow-up's claim that simply switching to the current full width fixed compatibility was incomplete and is corrected here.
3. D and AF are actual GAS Date cells. Their native JSON ISO values are now measured. REST serial dates must not be hashed as if they were these native arrays.
4. The copy's prior 70-cell blank fill changed J/V/W/AZ:BC without a matching receipt, so its current hashes legitimately differ. All ten copy rows remain held; no saved baseline was changed and no filled value was cleared.
5. Base64 is web-safe with padding in both implementations; it was not the mismatch source.

Example EP-00141: saved/legacy-51/ASCII-51 = `RTU8ld2NFcT89eD0UWkyu_tuyFalP7lPF_yt8avHo4Q=`; UTF8-51 = `4ejnzNQwHaJXC-FTOWgKkpuZ4ANzuWj_BePvSP6qGiY=`. Native D = `2026-10-10T02:00:23.000Z`; AF = `2026-10-10T02:19:00.410Z`.

Correction: separate `v3RowHash` for legacy proof compatibility from UTF-8 full-width `rowHash` for new receipts. The original identity remains immutable. Receipts use V3's required eight-element packed-field array; an object field would break its existing state reader. Once a receipt exists, its full UTF-8 proof must match; the writer must not fall back to the weaker legacy ASCII proof. Legacy ASCII cannot distinguish every equal-length Japanese edit, so it must never be described as a strong Unicode integrity check. Blank-only and identity checks remain mandatory.

### Copy GAS placement and next boundary

Both complete modules were pasted into the standalone copy GAS and read back byte-for-byte against local code. Default enabled/config flags remain unset. A copy-only network probe `inspectLibraryOfficialCopyNetworkReadOnly()` was added: current official RSS parsing, latest item's RSS/JSON consistency, ten exact historical JSON identities, blank-only planning and a report, with no cell/property/trigger writes.

Attempting the formal inspector after adding UrlFetch-backed code produced an additional Google authorization prompt. The initial native hash diagnostic had no external-request dependency. User approval of the initial diagnostic is confirmed by its successful execution; the new authorization must be completed separately by the user before continuing.

Results in this continuation: native hash diagnosis succeeded; production 10/10 legacy matches; copy 0/10 matches as expected after prior edits; local tests 48 passed. Copy fill 0 cells, nonempty overwrite 0, production writes 0. Network probe, write/replay and timer tests remain unexecuted. No triggers installed. Do not clear previous copy values to manufacture a successful write test: preserve those tabs and use a newly copied baseline-matching test surface within the authorized copy environment, or keep the affected rows held. No production eligibility yet.
