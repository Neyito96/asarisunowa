# Phase 15｜EP-06632 native types and independent hash PASS (current snapshot)
2026-10-27 JST | READ_ONLY | official order bfdf7829200b655299d3dd9bdbe6739dab36124f

## Verified source
Google Sheets native CellData via get_spreadsheet_cells, COPY spreadsheet 1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY, エピソード台帳!A6633:BC6633, fields userEnteredValue/effectiveValue/formattedValue/userEnteredFormat.numberFormat/effectiveFormat.numberFormat. Spreadsheet timezone Asia/Tokyo, locale ja_JP.

- 55 effective values: 25 stringValue, 2 numberValue, 28 blank; no boolean or formula.
- D (column 4): numberValue 46322.166666666664, DATE_TIME format yyyy/m/d h:mm, formatted 2026/10/27 4:00. Apps Script getValues reads Date corresponding to 2026-10-26T19:00:00.000Z; JSON.stringify(Date) supplies UTC ISO value.
- P (column 16): numberValue 2088 (not string).
- All other 25 nonempty values are stringValue; 28 blanks reconstructed to empty string, 55-array order retained. No arbitrary brute-force search.

## Independent computation
Using user-provided online code source: rowHash(row) -> hash(row) -> JSON.stringify(row) -> UTF-8 SHA-256 -> Utilities.base64EncodeWebSafe. Independently implemented UTF8/SHA256/base64url and checked standard SHA256('abc') base64url vector = ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0=. Reconstructed 55-array (with D Date ISO, P number, blanks empty strings). Serialized JSON length 5642.
- computed: LBArvuq6_Tn46Yh7tAromR_efyicCLVoqMrkvPvRKgw=
- stored V3 identity[2]: LBArvuq6_Tn46Yh7tAromR_efyicCLVoqMrkvPvRKgw=
- match TRUE. Status: **CURRENT_NATIVE_HASH_MATCH_CONFIRMED** for EP-06632 only.

## Limitations
This authenticates the **presently read 55-cell contents vs stored proof** and validates input type reconstruction for this entry. It does NOT independently establish no intervening edits nor an immutable 05:11 historical snapshot. Do not conflate with proof of registration history. Remaining EP-06633..06636 and EP-06594 were NOT recalculated in this gate per order; prior HOLD unchanged. EP-06594 10/24 snapshot remains historical.

## Parallel gates
Full 10/27 official RSS diff SOURCE_PENDING; formal production GAS writer NOT_VERIFIED. Production EP-06632 identity protected, COPY EP ID must not be transferred. No changes to sheets/GAS/triggers/Properties/main/public; GitHub audit commit only.
