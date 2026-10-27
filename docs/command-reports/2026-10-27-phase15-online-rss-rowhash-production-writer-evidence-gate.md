# Phase15 Online GAS source evidence gate — 2026-10-27

Directive 51af8bea54ba575fc240a7f6e68475c63bff24c1 read in full. READ_ONLY investigation; GitHub audit branch only.

## Confirmed
- Online COPY V19 wrapper and V18 ingestion engine were supplied by the user in prior turns. V19 calls V18. V18 calls `LibraryOfficialEngine.rss(feed)` and `LibraryOfficialEngine.rowHash(row)`, but definitions of these two functions were not supplied.
- Exact directive Git tree was fetched recursively and code search on GitHub default index for `LibraryOfficialEngine` and `rowHash(` returned no matching source. GitHub absence does not prove online GAS absence.
- Production GAS screen previously showed zero triggers for the inspected project. Production writer entrypoint and actual `SpreadsheetApp.openById` target are NOT_VERIFIED; shadow functions are not automatically writers.
- RSS eight URLs remain source pending after earlier access failures, not confirmed empty. Independent native hashes for COPY EP-06632..06636 plus EP-06594 remain blocked by missing exact rowHash definition.

## Read-only user collection steps
1. Open COPY GAS project in Apps Script editor, search `LibraryOfficialEngine`, then `rss(feed)` or `rss:`. Capture exact source file name, declaration and whole function body, plus any helper calls and URL/fetch/parser/retry/cache settings. Do not execute or save.
2. Search `rowHash(row)` or `rowHash:`. Capture whole function, including serialization, type conversions, encoding, digest and output format; redact secrets only.
3. Open production GAS project and search `appendRow`, `setValues`, `insertRowsAfter`, `SpreadsheetApp.openById`, `phase14Production`, `ingest`, `newEpisode` within appropriate source files. Record candidate function names and target spreadsheet IDs; distinguish READ_ONLY/shadow from a real writer. Do not change any data.

## Gates
`rss` = ONLINE_SOURCE_PENDING; `rowHash` = BLOCKED_ROW_HASH_DEFINITION; production writer = NOT_VERIFIED. Official RSS date-complete missing count = SOURCE_PENDING. Keep original production EP-06632 immutable; never transfer COPY EP numbers. Separate approvals required for episode registration, GAS/trigger work, and publishing. No writes to Sheets, GAS, properties, triggers, main or published data.
