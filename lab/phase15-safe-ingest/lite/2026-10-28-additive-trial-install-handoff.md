# Phase15 latest3｜試験専用GASへの追加用コード引継ぎ（2026-10-28）

## Scope / gate
指令: d3d79a4e86bf40f0db19e18aa575263cbfe41862。**コード準備のみ**。試験専用 Phase15_Lite_READ_ONLY_TRIAL の既存 `LiteCore.gs` / `LiteGas.gs` を変更しない。実GASへの設置・実行未承認。本番/COPY書込・採番・トリガーは不可。

## GASで新規作成するファイル（2つだけ）
1. `LiteLatestThree.gs` ← [貼付用コード](./LiteLatestThree.gs)（最新3件の純粋選定）。
2. `LiteLatestThreeTrialGas.gs` ← [貼付用コード](./LiteLatestThreeTrialGas.gs)（Sheets REST read-only＋既存RSS接続）。

**旧LAB `LiteLatestThreeGas.gs` は貼らない。** それは `phase15LiteFetchWithDeps` を要求しており実機で確認された関数名とは違うため。本作業の貼付版は新ファイル名 `LiteLatestThreeTrialGas.gs` で衝突を避けた。

### 呼出し関係
`phase15Latest3ReadOnlyTrial()` → REST Sheets A1:H / A1:J → `phase15Latest3Scan_()` → 実機側既存 `phase15LiteFetchRss_(feed)`。接続関数が存在しなければ `STOP_EXISTING_RSS_FUNCTION_MISSING` で停止。**関数シグネチャと返却形（配列 item.guid/title/pubDate/link）はオンラインソースを直接取得できておらず未確認**。既存ソースを変更せず、設置前に引数と戻り値を画面で照合すること。

### 実行関数
`phase15Latest3ReadOnlyTrial`。**設置承認と実行承認は別途必要。現時点ではどちらも行わない。**

## Read-only safety
- REST `GET` 2範囲のみ、OAuth bearer token。403その他非200は STOP。
- ヘッダーチェック A/H および A/G/I/J は推定文字列のままであり、実機での正式照合未了。相違時 `STOP_SCHEMA_UNVERIFIED`。権限を広げない。
- RSS URL は許可リストに限定。GUIDと配信日時の不正、同一フィードGUID重複ではその番組を SOURCE_PENDING にして3件の断定を回避。validの全件を日付降順＋GUID順で整列した先頭最大3件。番組間GUID衝突と台帳重複は区別。
- 書込／採番／トリガー／Properties処理なし。ログに候補タイトル・URL・GUIDが含まれる（試験専用ログとして扱い共有前に確認する）。トークンはログに出さない。

## 事前確認と残る未確認
1. 試験用既存GASの `phase15LiteFetchRss_` が `(feed)` を受け取り、配列を返すか、オンライン画面で目視。そうでなければSTOPし、別途アダプターだけ改訂。既存2ファイルは変更しない。
2. 既存ファイルに `phase15Latest3Scan_` / `phase15Latest3ReadOnlyTrial` の同名関数がないこと。
3. ヘッダー A/H、A/G/I/J と実スプレッドシートの一致。先行検証証拠は未確認。
4. appsscript.json の `spreadsheets.readonly` と `script.external_request` 等が適正か確認。想定外の編集権限要求はSTOP。
5. 7本すべてのRSSサイズ、配信日時の形式、HTTP挙動、取得所要時間（GAS制限内）は未実証。
6. GitHubソースへの静的作成は完了。ただし新しい2ファイルについて Nodeテスト・実GASのエンドツーエンドは **NOT_VERIFIED**。以前の36/36 PASSを新差分に流用しない。

## 承認後に限定して行うこと
- 承認1：既存試験プロジェクトに**新規2ファイルを追加のみ**。他ファイルは触らない。
- 承認2：人手で `phase15Latest3ReadOnlyTrial` を一回だけ実行。最大21件の番組・タイトル・日時・状態・EP-ID、実行時間とエラーを記録。手動以外の起動はしない。

Status: `ADDITIVE_CODE_PREPARED` / `ONLINE_SIGNATURE_PENDING` / `INSTALL_NO_GO` / `RUN_NO_GO` / `PRODUCTION_WRITER_NO_GO`.
