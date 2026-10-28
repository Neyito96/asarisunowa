# Phase15 production direct semantic backfill — 2026-10-28
Directive fb2751a6c319b480f3a024c4fe61b3285a4c93e8.
Spreadsheet 1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4, エピソード台帳 sheetId 806280644.
Source for this first batch: existing V description in the production ledger; no fresh official RSS/JSON download. Verified EP-ID + GUID and nonempty V / empty W just before each batch write. Kept topic description and recording date; removed related articles, subscriptions, event signup, cast list, promotional links; retained real LF.
Actual production writes: W2 EP-00001, W3 EP-00002, W4 EP-00003, W22 EP-00021, W23 EP-00022, W24 EP-00023. 6 populated W cells. 0 existing value overwrites. Re-read W2:W4 and W22:W24 after writes, values match expected. No COPY-only tag-strip results transferred.
Rows explicitly inspected: 2-4 and 20-27; 6 new cells. Rows 5-21 and 25-27 existing/noncandidates are not rewritten. Next logical scan position 25 (not stored in GAS Properties). New source fetch, 100/500 batch, automated GAS, time triggers not performed. Keep existing values untouched.
