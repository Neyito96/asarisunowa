# 2026-10-26 補填ロボ次工程｜COPY公式RSS/JSON DRY_RUN実行準備と修正提案

## 司令塔指令と現在の実施区分
受入指令 `docs/command-center/2026-10-26-backfill-readonly-acceptance.md` を確認。
本番/COPY台帳、V3、採番履歴、GASプロジェクト、トリガーは**変更していない**。

今回作成したCOPY専用GAS: `scripts/google-apps-script/Phase14BackfillFiveOfficialDryRun.gs`、関数 `phase14BackfillFiveOfficialDryRun`。
GASの実行コネクタは利用できないため、**公式RSS/JSON取得を伴うGAS実機DRY_RUNはまだNOT_RUN**。実行成功や公式ソースHTTP200、`writes=0` の実機測定を主張しない。Githubへのコード保存は実施済み。

## COPY READ_ONLY前提検査実績
COPYのEP-06627〜06631が存在しGUIDあり。EP-06632はCOPYに無し（収蔵ロボ担当）。対象5件のCOPY A:BC行を取得、公式情報の主要欠損（J,N,P,W,AC,AL等）を確認。
Sheets APIのCellDataからCOPYの I:P と W:AC 5行計75セルについて数式・データ検証・textFormatRuns・chipRunsに該当するものは0。これは対象55列全域の数式・構造保護が未検査であることに注意。GAS DRY_RUNは55列の`getFormulas/getRichTextValues/getDataValidations` を再取得する。

### 実行予定関数の性質
- COPY GASスクリプトIDとCOPYスプレッドシートID・台帳sheetId・55列ヘッダーを固定検証。
- 固定対象5件のEP-ID,GUIDと採番履歴・V3 GUIDを照合。EP-06632の新規採番はしない。
- 公式RSSの対象GUIDのitemを取得、タイトル照合。Omny系のみ公式JSONを取得、Megaphone系にはJSONを強制しない。
- 既存空欄のみ予定として列J/N/O/P/V/AZ/BAを抽出。式・入力規則・リッチリンクを保護して除外。W列は更新予定に含まない。
- ログだけ出力し、台帳/状態/プロパティ/トリガー変更0の仕様。
- **実機未実行**。正式なplannedCells/hold件数・HTTP結果は未確定。

## EP-06630 関連記事の提案（W列上書きなし）
公式由来と記録されたRSS原文（本番V6631）に【関連記事】見出し・記事3本と個別URLが存在し、本番AC6631にURLが列挙される。W6631には記事名もURLも無い。
現行Wの本文・収録日を保持した上で、末尾に以下の公式RSS由来の関連記事セクションを追加する**提案のみ**：
- AIがAIを狂わせる　サイバー被害責めるほど「攻撃者の思うつぼ」
  https://www.asahi.com/articles/ASV9L33M4V9LULFA02SM.html?iref=omny
- 記事2見出し：V6631の【関連記事】から正確に再抽出する必要あり（現時点で確定転記しない）。
  https://www.asahi.com/articles/ASV9P03RZV9PPLBJ001M.html?iref=omny
- （読者と記者のｂｅ会議）繰り返し読む本はありますか？
  https://www.asahi.com/articles/DA3S16559894.html?iref=omny
これは既存W非空セルの内容更改に当たるため補填ロボの空欄補完仕様の範囲外。承認まで変更禁止。

## EP-06631 ゲスト個別リンクの提案（W列上書きなし）
公式由来RSS原文（本番V6632）にゲストの作品/近況向けリンク `https://x.com/MangaLearn` が存在。W6632には無い。現行Wの本文・収録日を保ち、末尾に「菜緒都さんの作品・近況（X） https://x.com/MangaLearn」を追記する**提案のみ**。広告や番組共通宣伝のリンクと区別する。承認前は変更禁止。

## 未解決・次の操作
1. COPY GASにGitHubの新規`.gs`を追加し、`phase14BackfillFiveOfficialDryRun`を**手動実行**してログを取得。コードは未実機テストのため必ずdry_run専用を使用。
2. 出力`sourceChecks/plans/holds/writes/propertiesChanged/triggersChanged`をログに保存。RSS/JSON HTTP状態、GUID/タイトル証拠、対象セルと保護判定を確定。
3. V3 native row hashは別工程。COPY既存トリガーは一切変更しない。
4. EP-06632は収蔵ロボ担当。補填ロボによる新規EP-ID採番禁止。
5. EP-06630/31のW列は司令塔・ユーザー承認まで既存値を変更しない。

