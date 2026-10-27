# Phase15 COPY new four native rowHash checks — 2026-10-27 JST
Directive de75a410269a774055cb5f0af9346110e63a80c2 read fully. READ_ONLY native Sheets CellData + V3 proof comparison; Sheets/GAS/triggers/Properties/public writes: ZERO. Non-main GitHub audit branch only.

## Source and calculation
COPY spreadsheet 1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY, エピソード台帳 rows 6634 through 6637, A:BC 55-column effectiveValue plus effectiveFormat.numberFormat, and corresponding 図書館V3・項目状態 row. Typed reconstruction: datetime numeric serial with DATE_TIME format converted using Asia/Tokyo to UTC ISO (Apps Script Date JSON); non-date numeric stays number, string stays string, empty stays "". Hash = JSON.stringify(55-array) -> UTF-8 SHA-256 -> web-safe Base64. Independent SHA256('abc') vector verified.

| ID | strings | numeric | datetime | blanks | computed native hash | stored V3 identity hash | match |
|---|---:|---:|---:|---:|---|---|---|
| EP-06633 | 20 | 0 | 1 | 34 | xaP4oe8wKwa-D_t0Ys7AahuPDnMlKJKed0cG9rF-Gn0= | xaP4oe8wKwa-D_t0Ys7AahuPDnMlKJKed0cG9rF-Gn0= | TRUE |
| EP-06634 | 23 | 1 | 1 | 30 | KOPwhfZSMxtJuptOMJY2-S54kTIJ6eNlOwxxPrh-S2Y= | KOPwhfZSMxtJuptOMJY2-S54kTIJ6eNlOwxxPrh-S2Y= | TRUE |
| EP-06635 | 26 | 1 | 1 | 27 | Q90nKZhKpQrvcHWFEAcd65YoiEAYsbHRwKkqgschFFI= | Q90nKZhKpQrvcHWFEAcd65YoiEAYsbHRwKkqgschFFI= | TRUE |
| EP-06636 | 25 | 1 | 1 | 28 | vMGHdqa74PJP2hqBstTHtZOEgZ0xjeC-lPwcybWq6bo= | vMGHdqa74PJP2hqBstTHtZOEgZ0xjeC-lPwcybWq6bo= | TRUE |

All 4 = CURRENT_NATIVE_HASH_MATCH_CONFIRMED for current snapshot. Combined with earlier EP-06632 independent check: five out of five COPY new records' current ledger hash equals V3 stored proof. This does not verify historical immutability or production correctness.

EP-06594 separate historical gate: 2026-10-24 reviewed currentRowHash, no proven same-time typed 55-cell historical snapshot in present evidence. Status HISTORICAL_SNAPSHOT_UNAVAILABLE; original registration hash remains missing and must not be backfilled.

Official 2026-10-27 all-RSS vs production difference SOURCE_PENDING, production writer NOT_VERIFIED. Production EP-06632 (こどもそうだんしつ) protected; COPY EP-06632 is MEDIA TALK with different GUID and must never be transplanted unchanged. No GAS execution or data mutations.
