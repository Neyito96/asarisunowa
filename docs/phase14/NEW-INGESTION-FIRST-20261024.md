# Phase 14 — new releases first, backfill second (2026-10-24)

## Confirmed priority
User explicitly requires that **newly published episodes are registered automatically**, not only historical metadata scanning. Engine A (official RSS -> Omny JSON -> GUID/UUID check -> dedup/history/decision check -> EP-ID reservation -> ledger/history/state atomic registration -> readback) is first priority. Engine B blank-only enrichment runs separately and must not delay A.

## Code review findings (GitHub branch feat/phase14-official-gas)
1. scheduledLibraryOfficialNew() exists, guarded by engineValidation, enabled, allowNew, otherWritersPaused, V3 and baseline checks. It is NOT enabled, and COPY v0.7 scan success does not establish production readiness.
2. runBackfill() currently iterates ctx.rows without exact-show exclusion of アルキキ, AJW, 朝ポキTV. Add allowlist/exclusion before any network fetch or write.
3. runBackfill() catches row failures into holds but persists offset=next+1, meaning failed rows can be bypassed until later sweep. Require durable retry queue or a checkpoint that does not treat HOLD as completed. Protect against repeated single-row blockage.
4. The v0.7 COPY scan cursor is NOT the engine B completion checkpoint; keep independent.
5. inspectLibraryOfficialLastSevenDaysReadOnly() is available as a candidate read-only new-release inventory, but inspect its feed source ordering and identity logic before relying on it. It must not be mistaken for registration.
6. Existing LibraryOfficialNative.newScan() remains REGISTRATION_BLOCKED_NONATOMIC. Do not use it to register.
7. New registration must not auto-mark episodes as publicly eligible; publication and library/star-universe synchronization are separate gates.

## Immediate validation sequence
A. READ_ONLY inventory of recent official RSS episodes vs COPY ledger and allocation history, exact allowed shows only. Record missing/held and any feed coverage gaps.
B. Inspect actual COPY GAS source/config/triggers and verify live RSS + Omny JSON fetch; do not infer deployment from GitHub.
C. Fix excluded-show guard and HOLD retry semantics in the branch, test in COPY with replay/idempotence.
D. Test one new registration atomically on COPY only after explicit target/config/identity verification and approval; ensure no production writes.
E. Test COPY-only timer, inspect execution history, then remove; only later request production authorization.

## Existing COPY scan evidence
2026-10-24 13:49 and 13:51 JST: 400 rows scanned, 260 included, 140 excluded; persisted nextRow=402; 0 episode writes, 0 trigger changes. Full COPY audit 6593 rows, 6453 included, 140 excluded. Production state unchanged.
