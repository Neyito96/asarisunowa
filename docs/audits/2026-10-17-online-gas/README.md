# 統合V3・オンラインGAS差分監査

2026-10-17 JST。PR #226、GitHub比較基準 `7ce330a50fe7fd719fc39b6028fdd8efe9d494c5`。

**認証済みCloud Browserで実際の画面と全ソースを読取。オンラインへの保存、関数実行、Properties変更、トリガー変更、シート書込、デプロイ、マージは今回すべて0。** GitHubには監査文書とローカル互換性検査のみを追加した。

## 結論と環境の区別

指定URLは **朝リスの田_Phase2_隔離検証**。公開サービスの本番プロジェクトとは別だが、ソースの参照先は実際の図書館シート `1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4`。隔離という名前はデータの隔離を保証しない。V3はまだ配置されていない。

|確認対象|指定された隔離検証プロジェクト|関連する公開サービス本番|
|---|---|---|
|プロジェクト名|朝リスの田_Phase2_隔離検証|朝リスの輪 プレイリスト投稿受付|
|script ID|`1eLqB-k1XIQz5qqOxamvUlinqld7jwSDO6AkWLx9Zg0ePGsuU7pE4rec-`|`1HpZNp96TQ7S1ilmfyItKI2IxYgdk8ufCsWXSVNEaGkh7_uQRXkr6k1I9`|
|作成日|2026/10/12|2026/09/08|
|ソース取得|全33ファイル取得・各2回全文一致|今回は取得対象外（概要・デプロイ・トリガーを読取）|
|デプロイ管理|アクティブ0・アーカイブ0|アクティブ4、対象はversion 73|
|現在表示されるトリガー|0件|6件、全件時間ベース・Head・表示エラー率0%|
|7日間概要|502実行・エラー率15.34%・1ユーザー|618実行・エラー率0.32%・21ユーザー|

本番との特定根拠: `app/PlaylistCombinedAutoForm.tsx` / `scripts/google-apps-script/SpotifyAuth.js` の公開エンドポイントID `AKfycbxlZCNqGqOEY7j61OgcSGM8_xfGT08f4jjamXtSj2DES9fXl-xwJrvcRGYHnskidjIMug` が、関連プロジェクトの「Playlist metadata resolver 2026-10-06」、version 73（2026/10/06 17:42）と一致した。今回この公開サービスは変更しない。

維持対象の本番6ハンドラー: `runAutoUpdateBackfillHourlyV1`、`syncKinoDougaPlaylist`、`syncIsshoShinbunPlaylist`、`syncToyohidePlaylist`、`runAutoUpdateAutomationV1`、`syncListenerPodcastPlatforms`。前回実行日は全件10/17、直近は10:48:29。画面の「時間ベース」だけから正確な周期は断定しない。

トリガー件数は現在ログインしている所有者に表示される範囲。他所有者のトリガー、外部起動元、別プロジェクトからの図書館書込が不存在とは証明していない。

## 全ソース比較

取得日時 `2026-10-17T02:21:15.663Z`。33件 = `.gs`32 + `appsscript.json`1。全件をエディターで全選択・コピーし、再選択して再読した全文が33/33一致。最後の保存ボタンは無効。Apps Script APIによる固定バージョン取得ではなく、画面に表示されたHEADの読取である。

- 末尾空白とCR/LFを正規化して一致: **20ファイル**。
- GitHub対応ファイルと差異: **7ファイル**（うち1件は分割配置）。
- 対応する単独ファイルがGitHubにない: **6ファイル**（AP2_Engine、AP2_Tests、AP3_RealServices、AP4_LibrarySearch、AP4_LibraryAudit、LibraryV2MatchDiagnostic）。AP2_Engineは既存V2と内容が重複する。
- [source-map.csv](source-map.csv): 全33件の対応名、原文SHA-256、正規化SHA-256、バイト数。正規化一致とバイト一致を区別する。
- [online-to-github.diff](online-to-github.diff): オンラインを左、GitHubを右とする**比較資料**。一括適用用ではない。

|差異|オンライン現状|導入時の扱い|
|---|---|---|
|appsscript.json|明示3スコープ、V8、Asia/Tokyo。webapp項目なし|維持。GitHub版をコピーしない|
|Import1007SafeBatch|append上限100、GitHubは50|今回は維持。V3とは別レビュー|
|LibraryMetadataBackfillV1|概要改行のencodeLineBreaksと約290行の追加運用処理|全体を維持。GitHub版で置換すると消失する|
|LibraryMetadataBackfillV2Writer|EP-00061の一回限り関数を別ファイルに分離|両ファイル維持。GitHub版追加で重複させない|
|EP00061_DescriptionFix|上記関数の本体はGitHub V2Writerに含まれる|分割配置として扱い、再実行しない|
|LibraryGuidReconciliationPreview|GitHubにある除外集計/フィルタ追加が未反映|V3依存ではないので維持。診断値を安全な書込許可に使わない|
|LibraryV2CheckpointEngine|`922f16e`の同ファイルと正規化全文一致|V3用の後方互換オプション差分のみ承認後に反映|

manifestのGitHub版は明示oauthScopesを持たず、`webapp.executeAs=USER_DEPLOYING` / `access=ANYONE_ANONYMOUS` を持つ。無断反映で権限・公開設定の差異を持ち込まない。オンラインの3スコープはspreadsheets、script.external_request、script.scriptapp。V3の現実装が要求するサービスを既に含むが、実行時の認可状態は未試験。

オンラインV1独自の11関数名: scheduledLibraryMetadataBackfill5min / recordLibraryBackfillRun_ / testLibraryBackfillHistory / installLibraryMetadata5minTrigger / stopLibraryMetadata5minTrigger / restoreLibraryMetadataHourlyTrigger / encodeLineBreaks / testEncodeLineBreaks / previewLibraryDescriptionNewlines / writeLibraryDescriptionNewlines / repairLibraryDescriptionNewlines_。これらはテスト名でも実書込を含み得るため今回実行していない。

### 既存グローバル名の重複

17種類の名前が重複（[duplicate-functions.json](duplicate-functions.json)）。

- AP2_Engine と LibraryV2UnifiedFastAutomation が6関数を重複。特に scheduledLibraryV2UnifiedFast は**異なる本体**。AP2側はGUID/metadata交代の旧経路、後者はチェックポイント経路。GASのファイル順に依存して正しい方が選ばれるとは保証できず、旧自動処理再開を禁止する理由になる。今回削除・改名しない。
- OfficialRssLibraryPreview と runHoudanBackfillPreview は正規化全文一致で10関数が重複。
- V1内でtestEncodeLineBreaksが2回定義される。

V3の30関数は既存名と**衝突0**、LIB_V2_SHEET_ID定義は1箇所。オンライン32gsの結合、およびエンジン差替え＋V3追加後33gsの結合はcompile-only検査に合格。構文合格は既存の重複関数の実行順や実GAS性能を保証しない。

## 読取で確認した実行実績

実行履歴の先頭50行を取得（[executions-visible.csv](executions-visible.csv)）。41完了・5失敗・4タイムアウト。これは7日間502実行の全数ではない。今回新たな関数実行は0。

|開始時刻JST|関数|実行画面の所要秒|確認内容|
|---|---|---:|---|
|10/17 10:36:07|writeMediaTalkPilot10Once|99.637|ログに10EP・20セル・PILOT_WRITTEN|
|10/17 10:34:26|previewMediaTalkPilot10Preflight|65.931|完了|
|10/17 10:27:09|previewLibraryV2NewsScene|88.786|完了|
|10/17 10:24:16|previewLibraryV2MediaTalk|67.062|完了|
|10/17 10:21:27|previewLibraryV2Checkpoint|7.083|完了|
|10/16 21:11:20|scheduledLibraryV2UnifiedFast|360.879|タイムアウト|
|10/16 21:01:20|同上|360.846|タイムアウト|
|10/16 20:51:20|同上|360.981|タイムアウト|
|10/16 20:21:13|同上|360.727|タイムアウト|

MEDIA TALKの展開ログを実読: EP-05585〜EP-05576、列7/15、proposedCells=20、writtenCells=20、内部elapsedMs=98700。[observed-pilot-log.json](observed-pilot-log.json)。99.637秒は実行基盤全体、98.700秒は関数内部で別の測定。checkpointChanged=false / triggerChanged=falseはログの自己申告で、過去Properties比較による証明ではない。今回この20セルを再書込していない。

21:01:20の約361秒実行中に21:06:20の3.024秒実行も表示される。起動の重なりは確認できるが、短い実行が台帳を書いた、またはleaseでskipしたとは詳細ログなしに断定しない。取得item/API数は上記UI履歴にないため、この監査では未確認。V3のGAS実測時間も未確認。

## 安全な導入対象

**第一段階は指定の隔離検証プロジェクトだけ**。公開サービス本番の6トリガーとversion73を維持する。GitHub GASフォルダ101ファイルの一括同期は行わない。

承認対象の正確なソース差分は [proposed-two-files.diff](proposed-two-files.diff):

1. `LibraryV2CheckpointEngine.gs` 1ファイルをGitHub7ce330a対応版へ差替え。既存V2の既定値を維持し、V3向けの拡張投影、45秒取得timeout、transport延期、別cache namespace/22,000文字chunk等を追加する。
2. `LibraryV3.gs` 1ファイルを新規追加。既定disabled、read-only入口3個と承認後write入口を持つ。

既存の残り32ファイル（manifestを含む）を維持する。旧V1/V2、AP2〜AP4、EP-00061の手作業、Import1007を再構成しない。V3のために公開webappをデプロイする必要はなく、Head実行と公開version73の変更を混同しない。

本番へ進める前に [migration-and-approval.md](migration-and-approval.md) の段階ごとに判定する。この文書は実行許可ではない。

## バックアップと接続上の限界

指定プロジェクト全33ソースをprivate ZIPとして保存。取得時刻/script ID、ファイル別SHA256を同梱。ZIP SHA256: `f5d5f737e5108efe5a654672c570cf4f6aac5f1fd277985ed538a80bb3310bde`。認証情報、Script Properties、個人アカウント表示、シートデータを同梱しない。ソースに対する機械的なsecretパターン検査の検出候補0は、秘密が絶対にない証明ではないため、全原本を公開GitHubへは追加しない。

ホームにPhase2_BACKUP_20261017 / Phase2_BACKUP_20261016という既存プロジェクト名があったが、内容/取得時刻/対象範囲は未確認。この名前だけで復元可能とは判定しない。今回のZIPもProperties・トリガー・シートの完全バックアップではない。

未確認: 他所有者トリガー、正確な周期、Propertiesのキー/運用値、公開本番Headとversion73の全文、既存Driveバックアップ内容、全実行履歴、V3実GAS試験。今回ブラウザーで指定HEAD取得はできたが、Apps Script APIによる固定version書出しは使っていない。これらを「接続不可」と一括扱いせず、未調査の範囲として残す。

## 再検証

- `node scripts/audit-online-gas-compatibility.mjs /private/source-capture.json`: 33件の個別/結合compile、導入後結合compile、V3関数名、依存定数、922f16e一致、重複コピーを確認。ソースを評価/実行しない。private captureはGitに追加しない。
- `node --test tests/gas-*.test.mjs`: 61/61 PASS（V3 29、V2 25、関連既存7）。
- Python audio/projection tests 6/6 PASS。既存RSSプレビュー23 assertions PASS。
- [test-results.txt](test-results.txt)。モック上のwriteと実環境writeを区別。今回の実シートwriteは0。
