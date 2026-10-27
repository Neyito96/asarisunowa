# Phase15 hash(x) additional evidence (2026-10-27 JST)

User supplied report: ONLINE `rowHash(row)` calls `hash(row)`; the hash method is said to use `JSON.stringify`, SHA-256, UTF-8 and web-safe Base64. Exact live function body, the precise byte conversion and any normalization, and source filename have **not** been provided. Current status `METHOD_REPORTED_SOURCE_PENDING`; six independent calculations (COPY EP-06632 to EP-06636 plus EP-06594) remain HOLD, not PASS. The `hashVerified:true` from prior execution is not an independent check. EP-06594 original registration hash remains absent and cannot be retrofilled from current hash.

User's alleged formal directive URL `https://github.com/Neyito96/asarisuniverse/blob/main` did not resolve; repository Neyito96/asarisuniverse returned 404, while Neyito96/asarisu-universe exists. No specific document path or commit for a new directive was supplied, so do not assert this has been read.

Next evidence requested: full ONLINE `function hash(x)` and `rowHash(row)` implementation (and any helpers), with source filename; then perform independent offline hash on all 55 native cell values with Apps Script JSON serialization parity, and compare to V3 proof without writing to either ledger. Continue original production EP-06632 collision protection, no COPY ID transfer, no GAS/Sheets/trigger/properties/public data changes.
