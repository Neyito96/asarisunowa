# Phase 14｜補填ロボ（Engine B）開発室・引き継ぎ仕様書
作成日：2026-10-24／対象：COPY専用／状態：設計・監査完了、Engine Bの無人運転は未実装・未承認

## 目的と境界
- 公式RSS／Omny公式JSON／Megaphone公式RSSにより、既存のエピソード台帳（新着を含む）の**空欄だけ**を補完する。
- **EP-IDの新規採番は禁止**。EP-ID、番組、GUID、タイトル、配信日時、音声URLを照合し、曖昧なら保留する。
- 既存値・数式・リッチテキスト・入力規則を破壊しない。推測値で埋めない。
- 書き込み対象はCOPY `1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY`、エピソード台帳（sheetId `806280644`）と同COPYのV3状態・監査シートに限定。
- 本番 `1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4`、Spotify、公開JSON、Pagesは**一切変更しない**。
- 収蔵ロボV19のCOPY朝トリガー（5時台・6時台）は現在設置済み。補填ロボと同時に台帳を書かない。両者のロック共有、時間帯分離、トリガー一覧の確認が必要。

## GitHubで確認した既存実装
- 対象ソース：`scripts/google-apps-script/LibraryOfficialRssEngine.gs`（ブランチ `feat/phase14-official-gas`）。
- `LibraryOfficialEngine.runBackfill()` は既存実装（約213〜275行）。設定 `LIB_OFFICIAL_CONFIG` の `engineValidation=P14_RUNTIME_VERIFIED`、`enabled`、`allowBackfill`、`otherWritersPaused` を要求。180秒のソフト締切、10件以下の処理、段階別優先列、`LIB_OFFICIAL_CHECKPOINT` と `LIB_OFFICIAL_BACKFILL_RETRY` による再開・保留キュー、`LIB_OFFICIAL_LAST_REPORT` を持つ。
- `plan()` は既存値の不一致を `NONEMPTY_PRESERVED` として記録、数式・チップ・入力規則を `STRUCTURE_PROTECTED` として保護する設計。
- `writePlan()` は本番IDへの書き込みを拒否、書込直前のnative行とV3状態のハッシュを検査、`officialBackfillPending` を先行保存、空欄への書き込み、読み戻し、`officialBackfill` 証跡の確定を行う。複数シート更新は非原子的。
- `verifyRowProof()` は通常VERIFIEDのほか、限定条件下のPENDING_REVIEWのスナップショット証拠も受け入れる。これを無条件に全PENDING_REVIEWへ拡張しない。
- `rss()`、`official()`、`material()`、`materialMegaphone()`、`fromJson()` を再利用。アルキキ／AJW／朝ポキTVを除外。
- 既存COPY試験では10件70セル補完・再実行0件の報告があるが、**現行コードの全台帳自動巡回の実機受入とは別**。

## 実装前に必ず修正・監査する事項
1. **COPYターゲット固定**：現行 `runBackfill()` は設定駆動。新たなCOPY専用入口関数で、ScriptApp.getScriptId() とCOPYスプレッドシートID、対象タブID・55列ヘッダーを強制検査。本番ID拒否だけでは不十分。
2. **V19との競合**：同一GASプロジェクトのScriptLockで排他する。収蔵ロボの5・6時台を避け、補填ロボは例えば07:30以降の時間帯で試験。既存トリガーの無断削除・上書きは禁止。収蔵ロボの実行中はBUSYとして終了する。
3. **カーソル**：現行の `stage/offset` 方式を維持し、COPY専用プロパティ名に分離。初回基準の行数、完了周回、最後のEP-ID、更新日時を記録。末尾まで達したら次段階へ。新着追加で最終行が伸びても破綻しない。各段階の再巡回も可能にする。
4. **候補の取得範囲**：現行 `runBackfill()` は毎回8本のRSSに存在するGUIDだけをインデックス化するため、古い6,591件の大半は `OFFICIAL_RSS_ITEM_NOT_IN_CURRENT_FEED` になり得る。歴史的な公式JSON URLや台帳に残る証拠を使った独立の履歴補完経路を追加する。RSSに存在しない行を毎回無限リトライしない。
5. **GUIDの照合**：台帳G列・AZ列・音声URL由来GUID・採番履歴・V3状態を照合。GUID不一致、同GUID複数候補、タイトル・公開日時・音声URLの矛盾は書き込まず保留。
6. **ネイティブ型と装飾**：現行 `attempt()` は `getValues()` を擬似セルへ変換し `plan()` に渡す。これでは数式・入力規則・チップ・リッチテキストを完全には検知できない。Sheets APIの実セルメタデータ取得か対象セルの個別構造検査を追加。日付の型とV3ハッシュは `getValues()` の55列で厳密照合。
7. **書込中断復旧**：`officialBackfillPending` を検出した行は自動再書込せず、現在値・beforeHash・期待列を検査する復旧専用READ_ONLY診断と、明示承認付きの回復手順を用意。
8. **監査ログ**：実行ID、COPY対象ID、開始終了、段階・カーソル前後、候補数、行数、補完セル数、既存値保持数、構造保護数、保留理由別件数、リトライ残数、エラー、変更前後の行ハッシュ、各セルの出典を記録。個人情報や本文の過剰ログは避ける。
9. **再試行方針**：HTTP 429/5xxは待機・バックオフ。404、情報源未発見、ID不一致、構造衝突を区別。永久保留を無制限にリトライしない。キュー上限・経過時間・優先順位を設定。
10. **時間制限**：GAS総実行時間にはRSS取得・JSON取得・シート読み取りも含まれる。180秒のソフト締切だけに依存せず、開始直後から全体時間を計測し、余裕を残して停止・カーソル保存。
11. **監査後の公開**：補填ロボは公開JSONや蔵ページを直接更新しない。蔵人が別途COPYの差分を検査して公開可否を判断。

## 段階的な受入テスト
A. **READ_ONLY監査**：COPY台帳の空欄分布、EP-06594（要レビュー）、EP-06595〜06597（2020年の過去データ混入）、EP-06598〜06624（新着27件）の身元・証拠を一覧化。現行の `runBackfill()` をいきなり有効化しない。
B. **DRY_RUN**：最初の10件で変更予定セルと保留理由を提示、書込・プロパティ・トリガー変更0。既存値と数式の保護を実証。
C. **COPY限定書込**：承認後に10件以内で空欄補完、V3行ハッシュと証跡を読み戻す。再実行で変更0、他の既存値変更0。
D. **巡回試験**：再開カーソル、リトライキュー、途中停止、RSS不在の過去行、HTTP障害、競合ロック、末尾折返しを検証。
E. **COPY無人巡回**：手動試験合格後にのみトリガー設置。設置前後のトリガー数と翌朝の実行履歴を確認。本番移行は別承認。

## 司令塔への報告形式
- 対象コミット／変更ファイル
- COPYでの処理行数・補完セル数・既存値保護件数
- EP-IDとGUIDの不一致・保留理由
- チェックポイント・リトライキュー
- V19との競合・トリガー状態
- 本番書き込み0の確認と、次に承認が必要な操作

## 引き継ぎ先
- GitHub：`Neyito96/asarisunowa`
- 作業ブランチ：`feat/phase14-official-gas` を参照。補填ロボの編集は別ブランチを切り、収蔵ロボV19と同一ファイルを同時編集しない。
- COPY台帳：`https://docs.google.com/spreadsheets/d/1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY/edit`
- COPY GAS：`https://script.google.com/home/projects/1roni6h_C9vKxtP_2I6jGgXKE2KJ1yRRhE3ZD1JsZ6XXRnT5RcndqyfJo/edit`
