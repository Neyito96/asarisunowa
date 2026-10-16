# 独立エピソード図書館｜Backfill 引き継ぎ・監査記録

更新: 2026-10-16

## 正本と運用
- Google Sheets「エピソード台帳」: 既存エピソードとメタデータの正本。
- 同ブック「自動補完・実行履歴」: GAS実行の日時・件数・更新EP-IDを記録。書き込み実績と読み取り専用監査を混同しない。
- GitHub: GASソース、変更理由、監査の判断と未検証事項を記録。
- GitHubへのコミットはGASへの自動反映を意味しない。V2定期トリガーは無断で変更しない。

## 2026-10-16 実データ監査（READ ONLY）
- 台帳 6,591 EP
- 出演者・スタッフ X 空欄 639
- Spotify個別URL L 空欄 166
- 概要原文 V 空欄 390（ニュースの現場から 262）
- 画像URL N 空欄 5,525、音声URL O 空欄 5,555、再生時間 P 空欄 98
- GUID（外部ID G）空欄 5,457。空欄5,457件すべてにSpotify個別URLあり。
- RSS 10フィード、6,511 item。GUID一致 1,006、未登録と判定されたGUID 5,214。これは真の新着5,214件を意味しない。
- RSSに一致した既存行の補完候補0、タイトル不一致4、取得エラー0。
- GUID空欄内訳: ニュースの現場から 2,621、MEDIA TALK 1,730、こどもそうだんしつ 1,103、ニュースの学校 1、報談 2。

## 確認済みV2補完
- V2 pilot: 80 EP / 240セルの補完を実施（複数回の実行）。
- EP-00061 概要原文 3,084文字の個別補完と事後検証が成功。
- スプレッドシート「自動補完・実行履歴」の実行行が正本。GitHubは実行結果の代替にならない。

## コードと安全な次の一手
- LibraryMetadataBackfillV2.js / LibraryMetadataBackfillV2Writer.js: 既存RSS GUID・タイトル一致を条件に、空欄の画像・音声・再生時間・概要を補完。
- LibraryMetadataBackfillNextAudit.js: 欠損数とRSSカバレッジを読み取り専用で集計。
- LibraryGuidReconciliationPreview.js: GUID空欄行とRSSを番組名・正規化タイトル・JST日付の厳密一致でプレビュー。書き込み・トリガー操作・Spotify APIアクセスなし。
- 次: GUIDプレビューの実行結果を確認し、番組名の不一致や配信日時の揺れ、同名回、再配信を分類する。GUID補完はSpotify同一性も検証した別の安全なwriterで行う。
- 5,214件を自動新規収蔵しない。既存ID・既存値・人間除外を保護する。
- 読み取り専用監査結果は、書き込み件数0として別種の実行履歴に残す設計を今後追加する。現在は未実装。

## 未検証
- GUID空欄行とRSSの一対一照合率。
- Spotify URLとRSS GUIDの真正な対応。
- 音源URLのHTTP疎通。
- 262件の「ニュースの現場から」概要の取得可能性。
- 新着収蔵の重複防止・途中再開・本番サイト反映。

## 13:36:21–13:36:45 JST GUID照合・ユーザー実行ログ
- READ_ONLY_GUID_RECONCILIATION: GUID空欄 5,457件、Spotify URLあり 5,457件、RSS 10フィード / 6,511項目。
- 番組名・正規化タイトル・JST日付で一意照合 4,010件（約73.5%）。未照合 1,447件、曖昧判定 0、日付欠損 0、RSSエラー 0、書込 0。
- ログには excludedBlank / eligibleWithSpotify がなく、修正版がGASに反映されたと判断できない。
- 実データのヘッダーを2026-10-16にGoogle Sheetsから再確認。「人間除外」は39列目（AM列、ゼロ起点38）、「外部ID」はG列、「Spotify個別URL」はL列。既存の「自動補完・実行履歴」はA:Jの10列構成。
- 次の作業: GUID照合結果の安全検証（除外・既存GUID重複・同一Spotifyエピソードの一致）。検証を経ずに一括書き込みしない。

## 2026-10-16 13:53 JST以降 — V2高速GUID復元のコードレビューと台帳実測
- 作業時ブランチ先頭は 11ac7fa（official item URL由来のGUID復元コードを追加）。引き継ぎ文末尾の 0e256d3 より新しい。main の自動更新コミットと混同しない。
- Google Sheetsのエピソード台帳を全6,591行（ヘッダー別）読取。GUID空欄5,457件の公式個別URL（J列）は全件 `https://www.asahi.com/special/podcasts/item/?itemid=...` 形式、Spotify URL（L列）も全件あり。
- 公式URL itemid が既存GUIDと衝突せず、台帳内で一意、かつ人間除外なしの候補は5,164件。残る293件は重複・除外などで保留（複数の公式URL itemid は290種類が重複）。この5,164件はURL由来の候補であり、RSSのGUIDとSpotifyとの真正な同一性の全件証明ではない。
- 変更: 既存 `LibraryOfficialGuidFastBackfill.js` のG列書き込みを連続行単位の `setValues` に変更し、まとめ読戻しで検証。履歴ヘッダーは一括読取。直前に全台帳の公式URL由来GUID重複を再検証。10件/80件入口、ScriptLock、実行履歴追記は維持。
- GitHubコミット: e7b9870（まとめ書き）、c9865c6（直前のURL一意性再確認）。コード編集のみで、GASへのデプロイ、GAS本番実行、GUID補完は一切行っていない。
- 重要: 既存の `writeLibraryOfficialGuidBatch_` は、公式個別URLの `itemid` からGUIDを候補化する。RSSと突合せる検証・Spotifyエピソードとの同一性検証が未実装のため、5,164件をそのまま大量書き込みしてはならない。次工程は公式URL itemidとRSS GUIDの一意一致をRSS並列取得内で確認し、不一致/欠損を保留すること。
- ボトルネック: Writer本体は依然 GUID照合専用。公式URLのGUID復元とWriterの統合、および完了監査・途中再開は未実装。10件・80件の書き込みは、GAS反映と適切な確認を経るまで実施しない。
