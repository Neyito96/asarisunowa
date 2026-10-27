# Phase15 LAB safe ingestion prototype — 2026-10-27
This is **offline-only CommonJS synthetic test code**. No production or COPY GAS, Sheets, ScriptProperties, triggers, main or published data was modified. No GAS API/URL/credential is imported.

## Proven source reuse and gaps
- Online COPY V19 wrapper calls V18 once. User-supplied V18 established: 8 authorized feeds including old SDGs, exclude AJW/アルキキ/YouTube, `LibraryOfficialEngine.rss(feed)` return all XML items, filter 7 days, max 10 successful additions, read ledger/history/V3, reservation→ledger append→V3 hash→history completion. V18 waits to start 180s deadline until after network and full-sheet reads.
- Online `rss(feed)`, `rowHash(row)`, `v3RowHash(row)`, `hash(x)` functions known from formal command transcripts. COPY five native rowHash match 5/5 independently proven.
- GitHub recursive tree at commit a451640264ab025579ff3f18706db7ef2e93eb3a has **no exact stored V18/V19/LibraryOfficialEngine full runtime source file**. Full `E.material`, parser helpers, source-list conversion, online writer and actual target routing remain unavailable as standalone code. This LAB does not pretend runtime equivalence.

## Files
- `engine.js`: injectable state store, explicit authority and other-writer-excluded gates, global budget guard, synthetic reservation→ledger→V3→completion state transitions, checkpoint, URL/audio/GUID conflicts, reserve/recover of same ID, and SOURCE_PENDING on RSS error. No real file or Sheets writes.
- `test.js`: synthetic offline tests: `node lab/phase15-safe-ingest/test.js`. Does not call Apps Script or network.

## Test evidence
Offline reference LAB implementation executed with local Node v22.16.0: **16 cases, 16 PASS, 0 FAIL**. The committed test suite includes the corresponding cases. GitHub Actions CI was NOT run; runtime parity of committed repo checkout not yet independently established.

1. Unapproved authority fails closed
2. Protected production EP-06632 collision fails
3. Synthetic ID allocated after EP-06632, not COPY ID reuse
4–7. Crash after RESERVED, LEDGER, V3 and COMPLETED, then restart with identical history/ledger/V3
8. HTTP failure -> SOURCE_PENDING
9. Four items in a program are considered
10. Eleven items across feeds are considered
11. Older-than-seven-day backlog is not silently dropped
12. Rerun idempotency
13. Concurrent execution of same instance rejected
14. Second writer not excluded fails
15. Time budget guard before first insertion
16. Hard crash leaves RESERVED recoverable

## Important limitations
The `locked` flag is **in-process only**, not a distributed cross-project GAS lock. A single-writer proof remains essential. The state store is memory-only and must be backed by durable storage and transactional/reconcilable checkpoints before production. The synthetic `proof` is a stand-in and NOT the native 55-cell SHA256 evidence calculation. Timeout checks are best-effort: blocking fetch/write operations cannot be interrupted. No actual RSS fetch, Sheet openById, ledger append, reservation history or V3 writes occur. The seven-day cutoff is intentionally not applied in LAB so aged backlog tests can pass; production ingestion policy requires approval. Old SDGs eighth feed remains policy pending. This module is non-deployable without separate GAS adapter review and authorization.

## Safety verdict
LAB prototype only. Production writer not proven, other writer exclusion not proven, RSS full daily coverage SOURCE_PENDING, production EP-06632 remains untouched. **Production recovery NO-GO**. COPY EP IDs are not eligible for transfer.

## 2026-10-27 adversarial hardening (司令塔 9e7008a)
No production writes. Before hardening, the adversarial 7-case harness returned **7 FAIL / 7 (RED, exit code 1)**. After source fix, the same harness returned **7 PASS / 7 (GREEN, exit code 0)**. Updated baseline regression suite returned **16 PASS / 16, exit code 0** in local Node v22.16.0. These results were obtained using the offline source and synthetic data, not GitHub Actions or Apps Script.

Run both:
```sh
node lab/phase15-safe-ingest/test.js
node lab/phase15-safe-ingest/adversarial.test.js
```
Changes: validating duplicate IDs/GUIDs and wrong V3 proofs; COMPLETED never silently succeeds with missing ledger or V3; legacy ledger without history requires proof before skip; history URL differences STOP; index checkpoint is no longer trusted (full observed feed items reexamined by GUID on every run). All conflicts fail closed; no checkpoint advancement on a conflicting item. All feed errors remain SOURCE_PENDING. Proved scenario: RSS reordered to put previously unseen episode before old index gets ingested.

**Residual risks:** LAB memory-only state is not a durable transaction or global lock. Separate instances may clone identical snapshots and allocate the same ID; do not run them as writers. Actor authority and writerExcluded are caller-supplied synthetic booleans, NOT verified production facts. The checkpoint is informational, not a demonstrated persistence layer. Synthetic proof cannot validate real native 55-cell SHA256. Legacy ledger without V3 proof is conservatively STOP (manual reconciliation needed). A full official feed must be supplied; incomplete RSS coverage is not ruled out. Blocking I/O and cross-project locks remain unaddressed. Production remains **NO-GO**.
