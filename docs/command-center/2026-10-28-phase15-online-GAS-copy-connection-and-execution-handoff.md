# Phase15｜オンラインGAS実機着手・COPY接続監査および最小実行案内（補填・収蔵ロボ→司令塔）
2026-10-28 / 指令 3b0934ff1a626956388f5a125016955c97945bde

## 接続先の実在確認（オンラインGAS管理APIの利用不可）
- **既存COPY GAS**：https://script.google.com/home/projects/1roni6h_C9vKxtP_2I6jGgXKE2KJ1yRRhE3ZD1JsZ6XXRnT5RcndqyfJo/edit — 2026-10-25の運用マップと、Phase14 10/26 22:24実機記録に一致。ただし **現在のオンラインエディタにどのコードがあり、トリガーが生きているかは未検証**。既存ファイルを上書きしない。
- COPY台帳：https://docs.google.com/spreadsheets/d/1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY/edit 。**エピソード台帳** sheetId=806280644 / 55列、**取得元一覧** sheetId=1260786691（公式7番組と除外フィードが登録）をSheets接続で実読検証。
- テスト専用 **P15_BACKFILL_100_COPY_20261028** sheetId=93331003 は6列で、統合GASの55列writerには使えない。実書込はCOPY内「エピソード台帳」でのみ許す。COPY本台帳のEP-00001〜00007のV/W等をREAD_ONLY照合済。COPY W2/W3/W4は空欄、W5以降には旧式Wの残存あり。
- **本番専用GAS**：2026-10-25時点のマップはID未確認。最近の実機からの新IDは今回取得できていないため、URLを創作しない。
- 本番台帳：https://docs.google.com/spreadsheets/d/1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4/edit 。正式正本のまま、今回は未書込。
- 初期情報：Phase14履歴に実際のCOPY GAS公式RSS/JSON 5件DRY_RUN結果、Omny JSON 3件 HTTP200 がある。ただし**統合GASを今回オンラインGASで実行して確認したわけではない**。

## GitHub LABコード
https://github.com/Neyito96/asarisunowa/blob/lab/phase15-safe-ingest-engine-20261027/lab/phase15-safe-ingest/automation/Phase15IntegratedProductionEngine.gs
現コードコミット 29334c2372ae8b556ed62ffb257cccb16c158865。
- 実用入口 p15iParserSmokeTests、p15iCopyTrialDryRun、p15iProductionDryRun、p15iCopyTrialWrite、p15iRetryPendingCopyHolds。
- p15iCopyTrialDryRun はCOPYエピソード台帳2行目、取得元一覧の公式RSS/JSONでGUID確認を試みる（スプレッドシート書込なし）。
- p15iCopyTrialWrite は同じ1行を限定書込、**初回確認後の明示COPY書込ゲート** `P15_WRITES_ENABLED=YES` が必要。V既存値は書き換えず、現W空欄に原文の関連記事3対が正しく保持できる場合のみ。N/O/P等既存値も上書きしない。
- 実COPY IDと取得元一覧が照合できたため、同じコードをCOPYプロジェクトに別ファイルとして追加可能。ただしオンラインGASコード編集権限を持つconnectorは現在なし。
- 拡張済み: P15I_HOLD_QUEUE記録、1〜10件単位の保留再試行 `p15iRetryPendingCopyHolds()`、基本カーソルを変更しない個別リトライ、監査シートへの事前PENDING差分、更新後再読込、100行分割。現時点で実オンラインの保留キュー再試行は未検証。
- **要改善前置き**: 同じGASプロジェクト内の既存関数・トリガーが書込可能な場合、LockServiceの排他は共通コードがlockを利用する時しか安全ではない。他writerの対象行と運転時間の調整が先。オンライン実行はまずREAD_ONLYのみ。

## Mac上で最小のオンライン実機検証操作
1. 既存 [COPY GAS](https://script.google.com/home/projects/1roni6h_C9vKxtP_2I6jGgXKE2KJ1yRRhE3ZD1JsZ6XXRnT5RcndqyfJo/edit) を開き、左のファイル一覧と時計マークの「トリガー」で既存V19関数を確認する。**既存コード・既存トリガーは削除しない**。
2. 左の **＋ → スクリプト** で新ファイル `Phase15IntegratedProductionEngine.gs` を追加し、上記GitHubの全文を貼付けて保存する。GAS内の既存定数や関数の置換はしない。
3. 関数セレクターで **`p15iParserSmokeTests`** → 実行。実行ログ6件の `ok:true` を確認。
4. 続けて **`p15iCopyTrialDryRun`** → 実行。承認ダイアログが出たら対象スプレッドシートと外部URL取得の権限を確認。ログの `officialGuids`、`officialJsonVerified`、`officialJsonLog`、`feeds`、`holds` を提出する。**ここまでは台帳への書込ゼロを意図**。
5. 認証・GUID一致・予定更新セル・他writerとの競合を評価した後、COPY実書込へ。事前にScript Properties `P15_WRITES_ENABLED` を `YES` とした上で `p15iCopyTrialWrite` を実行。まずCOPY「エピソード台帳」2行目だけ。実行後、同じ関数を再実行し `counts` すべて0を確認。原本VとEP-ID/GUIDを前後比較し、P15I_AUDITおよびP15I_HOLD_QUEUEを照合。
6. 本番書込・本番トリガー設置はまだ禁止（本番ゲートOFF）。

## 現在の数値（誤認防止）
統合GASオンライン実行0、実公式RSS/JSON取得0、実COPY更新0、実本番更新0、実GASカーソル未保存、実トリガー未設置。公式RSS7本とCOPY取得元一覧の実在・接続先は確認。
**司令塔へ：Macでまず上記3・4の実行ログを受け渡してほしい。実出典照合の結果に基づき、COPY一行writeの可否を最終判断する。** 
