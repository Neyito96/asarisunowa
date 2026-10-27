# Phase15 EP-06632 55-column type fidelity audit — READ_ONLY
2026-10-27 JST. Directive commit 2b45ff6ec7aa949935589cd6609cc6fcfff44fcd read in full.

## Identified code path
Provided V18 ONLINE code: `const actual=ledger.getRange(lRow,1,1,55).getValues()[0]`; `const proof=E.rowHash(actual)`; state identity and registrationEvidence store the proof. A second `rowHash(ledger.getRange(lRow,1,1,55).getValues()[0])` occurs after V3 write for readback. Thus the 55 native cells are hashed during/after new record append, rather than merely a source JSON object. Exact hash function in directive earlier: JSON.stringify(row), UTF-8 SHA-256 web-safe Base64.

## EP-06632 observed COPY current sheet connector A6633:BC6633
- Connector returned 55 positions. 27 non-empty values, 28 blank/null, all 27 displayed as strings.
- D4: `2026/10/27 4:00` connector string. This is not proof of Apps Script Date type. Possible JS Date serializations depend on actual storage and time zone; no assumed conversion approved.
- P16: `2088` connector string; Apps Script native `getValues()` might be numeric or text. The connector does not guarantee native typing.
- A ID EP-06632, G GUID 45dbe89c-d322-4c18-864b-b4ea006173e3. Live value matches V3 GUID. Other 25 nonempty columns are string-valued in the connector.
- Nulls appear in connector for empty cells; native Apps Script `getValues()` normally returns empty string for empty cells. Previous offline reconstruction used null→empty string and 55 item array and resulted in `RDb6rBxf1MHi6DBoHIkZZC066ztULk9ldF4aK8W7Jzw=`.
- V3 stored registration proof `LBArvuq6_Tn46Yh7tAromR_efyicCLVoqMrkvPvRKgw=`. Comparison of connector-normalized reconstruction does NOT match. This is a provisional candidate comparison only. No corruption claim.

## Input fidelity blockers and next evidence
- Current Google Drive get_spreadsheet_range returns plain values, no explicit FORMATTED_VALUE / UNFORMATTED_VALUE or DateTimeRenderOption exposed here. Cannot recover numeric/date cell semantics purely from returned strings.
- Production/COPY write path V18 uses `E.material` to populate array; native types of material.values[P] and any other numeric values require source confirmation. In particular RSS duration 2088 may be string or number; do not assume.
- Registration proof is a hash of 55-cell getValues readback at the 05:11 COPY execution time, not necessarily current sheet snapshot. Cannot prove the complete byte-for-byte original payload is still identical.
- Stage-gate EP-06632: `HOLD_INPUT_RECONSTRUCTION`. Native typed 55-cell payload remains unproven; do not extend to EP-06633..06636/EP-06594. EP-06594 review hash is a historical 10/24 snapshot and original registration hash was absent.
- Source for production writer still NOT_VERIFIED; official RSS complete 10/27 difference SOURCE_PENDING. Original production EP-06632 must not be overwritten; COPY IDs cannot transfer to production. Non-GitHub writes 0.

## Focused next read-only verification
A typed value-rendering pathway (Sheets API UNFORMATTED_VALUE with SERIAL_NUMBER datetime, or exact native value types from preserved pre-existing execution traces) could distinguish D, P and blank typing without GAS execution. Correlate proof-time and current content via available history. No arbitrary brute-force matching.
