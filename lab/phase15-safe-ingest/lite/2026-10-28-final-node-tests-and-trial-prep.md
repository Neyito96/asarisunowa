# Phase15 Lite final Node tests / separate READ_ONLY GAS trial preparation
2026-10-28 JST | directive commit 60a2b15f60c450c8393fc070a301cc7a564ff7ff

## Executed Node.js tests
Source was read through GitHub connector from branch `lab/phase15-safe-ingest-engine-20261027` and reconstructed verbatim into a temporary local directory, because network git clone was unavailable. Runtime Node v22.16.0.

| Command (relative to lite directory) | result | exit |
|---|---|---|
| `node adapter.mock.test.js` | **8 PASS, 0 FAIL** | **0** |
| `node lite.test.js` | **13 PASS, 0 FAIL** | **0** |

Cases: official seven URL allowlisting, A/H source and G ledger-GUID schema read, missing/wrong schema STOP prior to fetch, HTTP 503 SOURCE_PENDING, redirect 302 SOURCE_PENDING, HTML SOURCE_PENDING, missing GUID SOURCE_PENDING, no forbidden writer/trigger API observed in mocked call spy; core existing/new, duplicates, unconfigured/invalid source, old SDGs exclusion, source duplication, ledger duplicates, ordering and zero-write counters. Mock tests do NOT model every real GAS API or prove OAuth behavior. No live RSS request performed; source remains SOURCE_PENDING. Complete terminal test outputs were inspected during this run.

## Separate GAS read-only trial (PLAN ONLY; no installation)
**Trial must be in a newly created, isolated, standalone Apps Script project, not 朝ポキ｜本番ロボGAS nor COPY GAS.** Proposed project title: `Phase15_Lite_READ_ONLY_TRIAL`. No triggers. Separate future decision from production restoration.

Approval-gated sequence for the司令塔 to guide one click at a time:
1. After separate explicit user approval, open `script.google.com/home/projects/create` and create a standalone project. Do not act yet.
2. Add a `.gs` file for `LiteCore.js` source and one for `LiteGas.gs`. In Apps Script, library top-level `const` declarations may coexist with other files, but Node's CommonJS export is guarded by `typeof module` so it must remain nonexecuting in GAS. Confirm that parser and source file order work without duplicate identifiers.
3. Inspect manifest/oauthScopes **before** first execution. Read-only Spreadsheet access and RSS external_request are intended, but `SpreadsheetApp.openById` may cause broader OAuth scope than a read-only Sheets REST API; if access asks for edit permissions or unexpected scopes, **STOP and ask司令塔**, do not simply consent. An optional later LAB revision could use Sheets REST read-only connector after security review. Do not change scope settings speculatively.
4. Only after distinct one-time run approval, select `phase15LiteReadOnly` and run exactly once, no trigger. Read and return aggregate per-show fetched/existing/unregistered/duplicates/errors, SOURCE_PENDING, execution duration, and credential-redacted screenshots/log.
5. Leave trial independent; no production/COPY GAS modification, no EP ID allocation, no writes, no triggers, no public data changes.

## Important readiness limitations
- **TESTS_PASS / TRIAL_PREPARED / INSTALLATION_NOT_AUTHORIZED / RUN_NOT_AUTHORIZED**.
- Existing adapter performs `SpreadsheetApp.openById` READ_ONLY programmatically but GAS OAuth can be broader. Authorization/scopes require review.
- It fetches/fully parses all feed items, possible 6-minute limit; time budget and partial statistics not proved.
- All RSS/Google Sheets service calls in current test were mocked; XML namespace forms, authentic RSS availability, and production GUID list equivalence remain live pending.
- Production EP-06632 identity protected. COPY ID transfer forbidden. Production writer still NOT_VERIFIED.
