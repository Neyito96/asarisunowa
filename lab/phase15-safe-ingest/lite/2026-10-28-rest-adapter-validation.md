# Phase15 Lite 最新3件 REST readonly adapter gate — 2026-10-28

Directive `d3e46ef13ef1ea5adaa957dbc76341fc0b601133` fully checked.

## LAB code delivered
- `LiteLatestThreeGas.gs` replaced obsolete `SpreadsheetApp.openById` adapter with Google Sheets REST v4 `GET /spreadsheets/{id}/values/{range}` using `ScriptApp.getOAuthToken()` and UrlFetchApp GET only. The two read ranges are `'取得元一覧'!A1:H` and `'エピソード台帳'!A1:J`.
- Validates actual expected headers A/H and A/G/I/J; 403 or schema difference stops without broader authorization. No EP-ID allocation, edits, triggers, Properties or write endpoints.
- Retains `LiteLatestThree.js` for RSS pubDate sorting and up to three per show (21 maximum).
- `latest-three-rest.mock.test.js` added to check REST authorization token, two GETs, header checks, 403 fail-closed and no writing APIs.
- Current online `Phase15_Lite_READ_ONLY_TRIAL` LiteGas.gs is already Sheets REST readonly based on user/司令塔 report, but **its current source was not fetched and compared byte-for-byte**; new LAB adapter uses existing LAB `phase15LiteFetchWithDeps` parser (not proven equivalent to online). **Do not copy obsolete SpreadsheetApp LiteGas.gs to online trial.**

## Test evidence and qualification
GitHub source versions were retrieved from LAB branch and evaluated in isolated JS execution environment with Node compatible semantics; explicit testing of four groups:
- `latest-three.test.js`: **9/9 PASS**.
- `lite.test.js`: **13/13 PASS**.
- `adapter.mock.test.js`: **8/8 PASS**.
- `latest-three-rest.mock.test.js`: **6/6 PASS**.
Total **36/36 PASS in isolated JavaScript execution**.

Important qualification: execution used a lightweight require/fs/vm injection harness, not actual `node <testfile>` CLI. A direct download attempt to `raw.githubusercontent.com` from container failed with curl exit 6 (DNS resolution). Therefore **Node CLI exact checkout tests NOT_VERIFIED**, and the counts above must not be relabeled as CLI execution. The previous baseline 21 tests were confirmed in prior turn as well. No actual RSS/Sheets API call in these mock runs.

## Standalone READ_ONLY GAS trial update proposal — NOT EXECUTED
Trial project: `Phase15_Lite_READ_ONLY_TRIAL`, ID `1sn7SS8awam-hqcKspk4sEJ8gmc3zqjeo-TH6MeoEeRXsFhrKNwltJvxS`. Distinct from production/COPY GAS.
After separate authorization only: compare online existing REST LiteGas function and its `phase15LiteFetchWithDeps` with LAB signatures; add LiteLatestThree pure logic and REST adapter without modifying the existing successful original; verify project manifest scopes include `spreadsheets.readonly` and `script.external_request`, not broad Sheets editing. If Apps Script project uses Advanced Sheets service, verify coexistence and avoid duplicate entrypoints. Then separately approve one manual READ_ONLY invocation, record actual 7×3 classifications, timing and safe logs. No triggers.

## Gate
`LAB_REST_ADAPTER_IMPLEMENTED` / `JS_MOCKS_36_PASS` / `NODE_CLI_NOT_VERIFIED` / `ONLINE_REVIEW_PENDING` / `DEPLOY_NO_GO`. Production EP-06632 protected; COPY EP-ID transfer prohibited; no changes to real Sheets/GAS/Properties/triggers/main/Pages.
