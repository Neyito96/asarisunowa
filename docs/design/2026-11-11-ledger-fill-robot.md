# 台帳リンク補完ロボット設計（第49号）— DRAFT・本番未接続

## 目的
Claudeの逐セル書込（第48号で約2,000リクエスト/1,000セル、Sheets毎分書込quotaに反復到達）をやめ、定型処理をプログラムへ移す。

## 構成（最小変更・新DBなし）
| 層 | 実体 | 状態 |
|---|---|---|
| 収集/強キー照合 | 既存 `listen-fill-candidates.json`（GUID完全一致+日付±1日+個別EP URL） | 既存 |
| マニフェスト生成(読取専用) | `scripts/ledger-fill-robot/build-manifest.mjs`（既存非空/重複GUID/HOLD/URL重複を除外、sha256付与） | 新規 |
| 書込ロボット中核 | `scripts/google-apps-script/LedgerFillRobot.js`（GAS/Node共用の純JS） | 新規・未デプロイ |
| 実行基盤 | 既存GASのScriptLock/PropertiesService/SPREADSHEET_IDを再利用（PodcastPlatformSyncと同流儀） | 未接続 |

## 安全設計
- モード: READ_ONLY / DRY_RUN / WRITE。WRITEは manifest.approval（issue・列・上限・シート）必須。承認スコープ外の列・上限超過・HOLD・重複URL・expectedOld非空は検証で拒否。
- 単一ワーカー（LockService）。重複起動は LOCKED で拒否。
- チャンク（既定50）ごとに列全体を再取得→各セルを EP-ID一意一致・空欄・URL重複で分類。非空は絶対に上書きせず SKIP_CONFLICT。同一値は冪等 DONE。
- 書込後に再取得して読み戻し。不一致は即停止。
- quota/429/503は指数バックオフ＋ジッター。書込結果が不明なら停止して報告（盲目再試行しない）。
- チェックポイント（PropertiesService）で途中再開。時間上限(GAS 6分)に達したら PARTIAL_TIME で停止し再開可能。
- 全行A〜K差分監査 `auditDiff`（想定外変更を検出）。

## 測定（モック、`tests/ledger-fill-robot.test.mjs` 12件合格）
- 1,000セル（quota注入あり）: 書込リクエスト約23回、API合計約100回、Claude介入0回。
- 参考: 第48号のClaude逐セル方式は1,000セルで約2,000+回の呼び出し。

## 未実施・承認待ち
- COPY環境での実機試験（COPY台帳IDとGAS配置が必要。管理人側の準備/承認事項）
- 本番デプロイ、時間駆動トリガー有効化、Sheets REST+サービスアカウント経路: 管理人の別承認が必要
- 定期READ_ONLY巡回、第41号再生可能性チェッカー（HTTP200≠再生可能）: 後続

## 第50号 追記（2026-11-11）: マニフェスト v2
- 生成は `scripts/ledger-fill-robot/build-manifest-v2.mjs`（EP-ID+GUIDキー・行番号非依存・見出し名確認・SDGs1095正本優先・掲載判定=対象のみ）。
- ロボットは `keyPolicy:'EPID+GUID'` のとき、書込直前に EP-ID で行を引き、その行の G/J 列に GUID があるか再確認（無ければ `SKIP_GUID_MISMATCH`）。監査は EP-ID 基準の `auditDiffByEp`。
- 結果・未完事項・再開手順: `docs/operations/2026-11-11-listen-k-v2-manifest-resume.md`
