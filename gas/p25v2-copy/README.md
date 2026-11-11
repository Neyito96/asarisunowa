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
1. https://script.google.com で「新しいプロジェクト」を作る（スプレッドシートの「拡張機能」からは作らない＝独立にする）。名前は「V2収蔵ボット COPY試験」。
2. 左の「プロジェクトの設定」→「appsscript.json をエディタで表示する」にチェック。エディタに戻り、`appsscript.json` の中身を `dist/appsscript.json` で置き換える。
3. `コード.gs` の中身をすべて消し、`dist/P25V2CopyIngest.js` の中身を貼って保存。
4. 上の関数選択で `P25V2_1_CHECK` を選び「実行」。許可の画面が出たら自分のアカウントで許可する（ここが唯一のOAuth承認）。実行ログの最後に `"status": "CHECK_OK"` と、7番組それぞれの件数が出ればよい。
5. `P25V2_2_DRYRUN` を実行（書込なし）。`counts` の `CANDIDATE`（新しく入れる候補の数）を控える。
6. 候補が1以上なら `P25V2_3_WRITE_ONE` を実行（COPYに1件だけ書く）。`"status": "OK"`・`"added": 1`・`addedEpIds` を確認。
7. `P25V2_4_VERIFY` を実行（書込なし）。`"status": "VERIFY_OK"` なら、台帳・採番・原文（SHA256一致）が揃い、再実行しても二重に入らないことの確認まで完了。
8. 実行ログ（左の「実行数」でも可）の `CHECK_OK / DRYRUN の counts / WRITE_ONE の addedEpIds / VERIFY_OK` を PR #306 に貼るか、そのまま知らせる。

途中で `ERROR`・`VERIFY_NG`・`READBACK_MISMATCH` などが出たら、それ以上は実行せず、表示をそのまま知らせる。COPY以外のファイルを開こうとすると自動で止まる（保護ID・名前・実際に開いたID・シート見出しを毎回確認）。

任意: `P25V2_5_BACKFILL_RAW`（収蔵詳細で原文が空の行を、SHA256と文字数が一致する場合だけ埋める。1回10件）、`P25V2_6_RESCAN_READONLY`（全回を見て未収蔵を一覧するだけ。書かない）。

## 障害時
- 「LOCKED」: 別の実行中。数分おいて再実行。
- 取得エラー（`feedErrors`）: その番組だけ飛ばし、他は続行。次回の実行で拾う。
- 書込の途中で止まった: もう一度 `P25V2_3_WRITE_ONE`。採番履歴の「採番済」行を確認して、台帳に入っていれば「登録完了」に直し、無ければ同じ番号で入れ直す（人が「要確認」にした行には触れない）。
- 戻したい: COPYなので、追記された最終行・採番履歴の該当行・収蔵詳細の該当行を手で削除すればよい（本番には影響なし）。
