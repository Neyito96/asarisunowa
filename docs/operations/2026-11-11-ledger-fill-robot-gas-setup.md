# 台帳リンク補完ロボット — GAS配置手順書（COPY台帳での試験用）

作成: 2026-11-11 / 第50号 / 状態: **手順書のみ。配置・実行・トリガー設定はまだ誰も行っていない。**
対象コード: `scripts/google-apps-script/LedgerFillRobot.js`（PR #299 Draft）

> この手順は **COPY台帳** で試すためのもの。本番台帳・本番GASプロジェクト・トリガー・OAuth は一切変更しない。
> 本番への導入は、COPY試験の結果を見てから管理人が別途承認する。

## 0. 先に知っておくべき注意（調査で判明）
1. **既存GASの `SPREADSHEET_ID`（`コード.js`）は本番エピソード台帳とは別のシート**（`1KSzo…`）を指す。ロボットは `SPREADSHEET_ID` を使わない設計に変更済み（書込先は Script Properties で明示）。
2. 本番GASプロジェクトは `ANYONE_ANONYMOUS` 公開のWebアプリ。ロボットは **本番プロジェクトに入れない**。COPY台帳に紐づく **別の新しいGASプロジェクト** で試す。
3. `scripts/google-apps-script/` には `.claspignore` が無い。このまま本番プロジェクトへ `clasp push` すると `LedgerFillRobot.js` も本番へ入る。**本番への clasp push 前に、ロボットを除外するか別ディレクトリへ移す判断が必要**（未決定・要承認）。
4. ロボット関数は `doGet/doPost` から呼ばれないので、Webアプリ経由では実行されない（エディタからの手動実行のみ）。

## 1. COPY台帳を用意する（管理人がGoogleドライブで実施）
1. 本番「エピソード台帳」スプレッドシートを開き、ファイル → コピーを作成。名前例: `【COPY試験】エピソード台帳 2026-11-xx`。
2. コピーのURLに含まれるID（`/d/` と `/edit` の間）を控える → 以下 `COPY_ID`。
3. COPYは共有しない（自分だけ）。

## 2. 試験用GASプロジェクトを作る
1. COPY台帳で 拡張機能 → Apps Script（COPYに紐づく新プロジェクトができる）。
2. プロジェクト名例: `LedgerFillRobot-COPY試験`。
3. 新しいスクリプトファイル `LedgerFillRobot.gs` を作り、`scripts/google-apps-script/LedgerFillRobot.js` の中身を **そのまま全部** 貼り付けて保存。他の本番ファイルは入れない。

## 3. マニフェストを置く
1. COPY用マニフェストを生成（Actions または手元。読取専用）:
   ```
   node scripts/ledger-fill-robot/build-manifest-v2.mjs --ledger AK.json --judge BDBE.json --scope scope.json \
     --sdgs sdgs.json --rss lpa.json --out out/copy-test.json --report out/copy-test-report.json \
     --run-id listen-k-v2-copytest-YYYYMMDD --max 50 --spreadsheet-id <COPY_ID>
   ```
   試験は最初の1ファイル（50セル）だけ使う。COPYはコピー直後の本番と同内容なので、同じ判定になる。
2. 出力 `out/copy-test-b1.json` を Google ドライブにアップロードし、ファイルID → `MANIFEST_FILE_ID`。
3. ファイル内の `sha256` を控える → `SHA`。

## 4. Script Properties を設定（試験用プロジェクトのみ）
プロジェクトの設定 → スクリプト プロパティ:
| キー | 値 |
|---|---|
| `LFR_TARGET_SPREADSHEET_ID` | `COPY_ID` |
| `LFR_MANIFEST_FILE_ID` | `MANIFEST_FILE_ID` |
| `LFR_APPROVED_SHA256` | `SHA` |
| `LFR_ALLOW_WRITE_RUN_ID` | まず **空のまま**（DRY_RUN だけ可能） |

## 5. 実行（エディタから手動。トリガーは作らない）
1. エディタに一時関数を作る（保存不要なら実行後に削除）:
   ```js
   function lfrDry() { return runLedgerFillRobotFromProps('DRY_RUN'); }
   function lfrWrite() { return runLedgerFillRobotFromProps('WRITE'); }
   ```
2. `lfrDry` を実行。初回は権限確認（スプレッドシート・ドライブ）が出る → COPY試験プロジェクトなので許可してよい。
3. 実行ログで `status: COMPLETE_DRY_RUN`、`dryRunWritable: 50`、`skips: 0` を確認。
4. 問題なければ `LFR_ALLOW_WRITE_RUN_ID` に マニフェストの `runId` を入れて `lfrWrite` を実行。
5. 期待: `status: COMPLETE`、`written: 50`、`failed: 0`。同じ関数をもう一度実行 → 全件 `done`（冪等、再書込なし）。

失敗時の表示と意味:
| status | 意味 | 対応 |
|---|---|---|
| CONFIG_MISSING | プロパティ未設定 | 4.を確認 |
| MANIFEST_HASH_MISMATCH | ファイルが改変・破損 | 再アップロード |
| WRITE_NOT_APPROVED_SHA / _RUN | 承認値と不一致 | 4.の値を確認 |
| WRITE_TARGET_MISMATCH | マニフェストの書込先 ≠ 設定 | `--spreadsheet-id` を付け直して生成 |
| LOCKED | 同時実行 | 片方の終了を待つ |
| PARTIAL_TIME | 6分制限で途中停止 | 同じ関数を再実行（チェックポイントから続き） |
| HALT_WRITE_ERROR / HALT_READBACK_MISMATCH | 書込失敗・読み戻し不一致 | **停止。再実行せず報告** |

## 6. 試験後の監査（読取専用）
1. 試験前後で COPY の `エピソード台帳!A1:K` を取得（前: 手順5の前、後: 終了後）。
2. `auditDiffByEp(pre, post, manifest)` を Node で実行し `unexpected === 0`、`changed === written` を確認。
3. 追加の障害試験（任意）: 実行中に COPY の先頭へ行を挿入 → 正しいEP行に書かれるか／EP行のJ列を別GUIDに変える → `SKIP_GUID_MISMATCH` で書かれないか。

## 7. 後片付け
- `LFR_ALLOW_WRITE_RUN_ID` を空に戻す。一時関数 `lfrDry/lfrWrite` を削除。
- 結果（status・件数・監査結果・所要時間・API回数）を Issue #283 へ報告。
- COPY台帳と試験プロジェクトは結果確認まで残す。

## 8. 本番導入は別承認（この手順書の範囲外）
本番で使う場合も、本番GASプロジェクトに混ぜない（専用プロジェクト）・時間トリガーは別承認・マニフェストは `--spreadsheet-id <本番ID>` 付きで再生成し、管理人が sha256 と runId を承認してから。
