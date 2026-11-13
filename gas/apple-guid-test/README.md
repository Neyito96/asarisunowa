# Apple GUID照合テスト — 独立COPY専用 Apps Script（Issue #280）

DeepSeek第5〜8版の設計（episodeGuid厳密一致・collectionId/trackId/個別URL検証・200件打切り・通信試行とキャッシュの分離・GUID 5/10件テスト）を、PR #281 の判定規則に合わせて **1ファイル** に統合したもの。6ファイル構成のうち、今回の目的（COPYでGUID照合を5件／10件実測）に要る部分だけを実装した。固定対象1,000件バッチ・URL書込・復旧処理は**入れていない**（別承認）。

| 項目 | 内容 |
|---|---|
| 読む | COPY「V2・公開台帳」の EP-ID / 番組 / Apple / 公式GUID（見出し名で列を探す） |
| 書く | COPYの新シート「URL補完GUIDテスト」へ追記だけ（16列）。台帳本体は書込前後のSHA-256で不変を確認 |
| 通信 | `itunes.apple.com/lookup?id={番組}&media=podcast&entity=podcastEpisode&country=JP&limit=200` を番組ごと1回。429/5xxは5秒後に1回だけ再試行。結果は6時間キャッシュ |
| 判定 | MATCH / MISMATCH（GUID違い・番組ID違い・trackViewUrlが個別EPでない）/ API_NULL_GUID / NOT_RETRIEVED（返却200件に無い）/ API_ERROR |
| 止まる | 保護ID（V1・V2作業用・本番59列・既存GAS）・COPY名でない・開いたIDが違う・トリガーあり・既存ログ見出し違い・`verifiedEnabled≠false`・11件以上 |
| 模擬試験 | `node --test tests/apple-guid-test-gas.test.mjs`（このファイルそのものをGAS模擬環境で実行・10項目） |

## 管理人の操作（1回・約5分）
1. https://script.google.com で「新しいプロジェクト」（名前「Apple GUIDテスト COPY」）。本番GAS・既存プロジェクトには貼らない。
2. 「プロジェクトの設定」→「appsscript.json をエディタで表示する」にチェック → `appsscript.json` を本フォルダのものに置換。
3. `コード.gs` を全部消して `AppleGuidTest.js` を貼り、保存。
4. `URLBOT_GUID_0_CHECK` を実行（許可画面で自分のアカウントを許可）。`status: CHECK_OK`、`target.name` に【COPY試験】、`eligible`（候補数）、`preview5` を確認。書込・通信なし。
5. `URLBOT_GUID_5` を実行。`status: OK`、`counts`、`api`、`readbackOk: true`、`sourceSheetUnchanged: true` を確認。
6. MATCH が出ていて ERROR だけでなければ `URLBOT_GUID_10` を実行（`overlapWith5` に5件テストと重複したEP-IDが出る）。
7. 実行ログの表示（JSON）を Issue #280 に貼るか、そのまま知らせる。

戻し方: COPYの「URL補完GUIDテスト」シートを削除すればよい（本番に影響なし）。
