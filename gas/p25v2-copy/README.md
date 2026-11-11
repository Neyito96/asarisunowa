# V2収蔵ボット — 独立COPY専用 Apps Script（P25V2）

公式RSS（7番組）を直接読み、**COPY**のスプレッドシートに新しい回を1件ずつ収蔵する。本番・V2正本・本番GASとは別の、新しい独立プロジェクトで動かす。

| 状態 | 内容 |
|---|---|
| 実装済 | RSS取得（5xxは1回だけ再試行）→ GUID/タイトル/配信日/概要原文 → 既収蔵・（再）HOLD・GUID衝突BLOCKの判定 → 固定ID採番履歴（採番済→登録完了）→ 台帳へ小バッチ追記（既定1件・上限10）→ 読み戻し → 収蔵詳細17列に原文とSHA256 → 実行ログ。中断時は「採番済」の行だけを次回に修復して再開、同じGUIDは二重に入らない |
| 模擬PASS | `tests/p25v2-copy-gas.test.mjs`（配布ファイルそのものを GAS 模擬環境で実行）ほか |
| **実機未実行** | OAuth許可とCOPYでの実書込は、管理人の操作が必要（下の手順） |

書かないもの: 「概要（清掃済）」「出演者」「関連記事URL」と6サービスのURL。清掃結果は品質が未検証のため、収蔵工程では台帳本体に入れない（清掃・補完は別工程）。トリガーは作らない（自動実行は別承認）。

## ファイル
- `dist/P25V2CopyIngest.js` … これ1つを貼る（自動生成。編集しない）
- `dist/appsscript.json` … 権限（スプレッドシート・外部URL取得・トリガー有無の確認のみ）
- `src/P25V2CopyMain.js` … 入口と設定。共有コードは `scripts/google-apps-script/P25V2IngestAdapter.js`
- 再生成: `node scripts/ledger-v2/build-copy-gas.mjs`（`--check` でずれ検査）
- clasp を使う場合: `.clasp.json.example` を `.clasp.json` にして新プロジェクトの scriptId を入れ、`rootDir` は `dist`。本番GASの scriptId は絶対に入れない

## 管理人の操作（1回・約10分）
準備
1. https://script.google.com で「新しいプロジェクト」を作る（スプレッドシートの「拡張機能」からは作らない＝独立にする）。名前は「V2収蔵ボット COPY試験」。旧本番GASのプロジェクトには貼らない。
2. 左の「プロジェクトの設定」→「appsscript.json をエディタで表示する」にチェック。エディタで `appsscript.json` の中身を `dist/appsscript.json` に置き換える。
3. `コード.gs` の中身をすべて消し、`dist/P25V2CopyIngest.js` の中身を貼って保存。

点検（書込なし）
4. 関数 `P25V2_1_CHECK` を選んで「実行」。許可の画面が出たら自分のアカウントで許可（唯一のOAuth承認。権限は「スプレッドシート」「外部URLの取得」「トリガーが**無いこと**の確認」だけで、トリガーを作る権限ではない）。
   確認: `"status": "CHECK_OK"`、`triggers: 0`、`target.name` に【COPY試験】、7番組すべてに件数、`publicCount`（公開数。COPYでは 6033 のはず）、`fetchAllMs`（全件取得の時間）。
   **`CHECK_OK` 以外（`CHECK_WITH_FEED_ERRORS`・`CHECK_FETCH_TOO_SLOW` など）なら、ここで止めて表示を知らせる。**
5. `P25V2_2_DRYRUN` を実行（書込なし）。`counts.CANDIDATE`（新着の候補数）と `next` を見る。

分岐A: 新着あり（CANDIDATE が1以上）
6A. `P25V2_3_WRITE_ONE` → `"status": "OK"`・`"added": 1` を確認。
7A. `P25V2_4_VERIFY` → `"status": "VERIFY_OK"` を確認。
8A. もう一度 `P25V2_3_WRITE_ONE` を実行してよいのは、DRYRUN の候補が2以上のときだけ（同じ回は二重に入らない）。

分岐B: 新着なし（CANDIDATE が0。今のCOPYはこちらの可能性が高い）
6B. `P25V2_3_WRITE_ONE` と `P25V2_4_VERIFY` は**実行しない**（VERIFY は書込記録が無いので `NO_WRITE_TO_VERIFY` になるだけ）。試験用に架空の回を作ることもしない。
7B. `P25V2_5_BACKFILL_RAW` を実行。既存の原文未取得21件のうち最大10件を、公式RSSの原文で埋める。
   確認: `"status": "OK"`、`filled`（埋めたEP-ID）、`otherCellsChanged: 0`（他のセルは不変）、`publicBefore` と `publicAfter` が同じ、`hold`（理由つきで見送った行）、`totalMs`。
8B. もう一度 `P25V2_5_BACKFILL_RAW` を実行。残りがあれば最大10件埋まる。**全部埋まった後の実行で `"status": "OK_NO_CHANGE"`・`filled: []` になれば「再実行で差分0」の確認完了。**

最後
9. 実行ログ（左の「実行数」でも可）の、各関数の `status` と件数（`CHECK`・`DRYRUN`・`WRITE_ONE` か `BACKFILL_RAW`・`VERIFY`）を PR #306 に貼るか、そのまま知らせる。表示に本文は含まれない。

途中で `ERROR`・`VERIFY_NG`・`READBACK_MISMATCH`・`OTHER_CELLS_CHANGED`・`PUBLIC_COUNT_CHANGED`・`STOP_FEED_ERRORS`・`STOP_TIME_BUDGET` が出たら、それ以上は実行せず、表示をそのまま知らせる。COPY以外のファイルを開こうとすると自動で止まる（保護ID・名前・実際に開いたID・シート見出しを毎回確認）。

## 受入条件（実機）
- GAS実機で CHECK_OK → DRYRUN → （A）WRITE_ONE OK＋VERIFY_OK、または（B）BACKFILL_RAW OK（他セル不変・公開数不変）
- エラー時は書込0で停止（取得エラー・時間超過・対象違い・トリガーあり）
- 再実行で差分0（A: 同じ回が既収蔵、B: `OK_NO_CHANGE`）
- 全件取得が `CHECK_FETCH_TOO_SLOW`（2分超）や `STOP_TIME_BUDGET`（4分超）になったら、番組ごとの分割実行に切り替える（コード修正は Claude が行う）

## 障害時
- 「LOCKED」: 別の実行中。数分おいて再実行。
- 取得エラー（`feedErrors`）: その番組だけ飛ばし、他は続行。次回の実行で拾う。
- 書込の途中で止まった: もう一度 `P25V2_3_WRITE_ONE`。採番履歴の「採番済」行を確認して、台帳に入っていれば「登録完了」に直し、無ければ同じ番号で入れ直す（人が「要確認」にした行には触れない）。
- 戻したい: COPYなので、追記された最終行・採番履歴の該当行・収蔵詳細の該当行を手で削除すればよい（本番には影響なし）。
