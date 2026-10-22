# 図書館起点のSpotify・プレイリスト連携 — 2026-10-22

既存PR #232を更新。新しい収蔵エンジン/トリガーを作らず、既存の検索index・Spotifyアダプター・出演者plannerを再利用する。既存PR #247/#248のRSS専用05時台運転と承認済み合成版SHAには手を加えない。**開発/ローカル試験まで。GAS配備、本番切替、Spotify実書込は未実施。**

## READ_ONLYの実測

台帳/検索対象タブはGoogle Drive/Sheets連携で読み、元本書込0。証拠は `docs/audits/2026-10-22-library-playlists/`。

|項目|結果|判定|
|---|---|---|
|台帳|6,591行、EP-ID一意6,591、最大EP-06591|読取時点PASS|
|Spotify個別URL|6,425件が存在しepisode URL形式に一致|対応の正しさ/権限は未検証|
|ニュースの学校|486行|検索対象から一律除外しない|
|図書館・宇宙 検索対象判定|EP-ID付き判定行0。見出しと空IDの未判定行のみ|採否確定HOLD|
|検索対象・判定ルール|「約5,936件」は暫定基準、個別6,591件未判定と明記|確定数として公表しない|
|出演者確認根拠|非空5,921行|非空であるだけでは本人確認・出演確認を認定しない|
|実データ検索|ニュースの学校×気候→EP-00545/EP-00858の2件。選択すると両方SCOPE_PENDING|プレビューPASS、実投稿HOLD|
|公開manifest|HTTP200、version=1df7cb5d103cfbfc、生成2026-10-21T05:17:19.664Z、source6591/公開6466|新しい自動公開の実証ではない|
|実GAS/トリガー/実行履歴|最新の認証済み読取経路なし。Issue241の最新記録もA/B/C承認・Mac実行未確認|稼働HOLD|

台帳の増加がないことだけで自動収蔵の成否は断定しない。RSSに適格新着がない場合もある。以前のALIB終了/トリガー0/停止設定と、現在の実機状態は区別する。MacでのA/B/C実施結果、`previewLibraryV3Autonomy`/`previewLibraryV3Morning`、朝の実行ログと登録51セル読戻しが必要。

## Spotify403 — 確定事項と未確定事項

既存 `Spotify.js` はClient Credentialsを公開メタデータ取得に使用し、`SpotifyAuth.js`/playlist経路はユーザーtokenを使用する。コード上の使い分けは存在するが、当該403の実行時token種別・scope・対象権限を取得した証拠はない。token値を提出する必要はない。

現行公式資料（2026-10-22確認）:

- [2026年移行](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide): `/tracks`→`/items`、開発モード要件。既存の主要writerは既に`/items`であり、旧endpointを今回の原因と断定しない。
- [Get Playlist Items](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items): 所有者/共同編集者以外には403。GET上限50件。既存のGAS補助/Morning/PR232 adapterには`limit=100`があり、新adapterだけ50へ修正。400等の原因候補であり、403の直接原因とは断定しない。
- [Add Items](https://developer.spotify.com/documentation/web-api/reference/add-items-to-playlist): `playlist-modify-public/private`の適切なユーザー認可、最大100 URI。試験実行はさらに最大1件へ制限。
- [Create Playlist](https://developer.spotify.com/documentation/web-api/reference/create-playlist): `POST /me/playlists`。新規は非公開を既定とし、作成承認は追加承認と分離。

認証付き再現ログ未取得につき **403の個別原因は未確定**。diagnosticsに記録するのは時刻、GET/POST、queryなしendpoint、HTTP、Retry-After、既知のgrant種別・scope不足/所有権の真偽だけ。token/secret/state/生の認証ヘッダー/応答本文は保存しない。401を認証要求、403をFORBIDDEN、429を待機、5xx/通信例外を別扱いにする。401だけから期限切れか失効かまでは断定しない。403の回避やOAuth変更は実装しない。

## 実装

1. `library-v3-playlist-workbench.mjs`: 既存buildLibrarySearchIndexを利用。複数語AND/OR、番組、JST配信期間、根拠付き出演者、関連記事見出し、ページング、個別選択/除外を処理。二重EP-IDは全候補を保留。判定表をEP-IDでjoinし、重複判定行も保留。タイトルだけで再配信扱いにしない。未判定話/未確認出演者の話自体は検索に残す。
2. 出演者は公式RSS/JSON、公式URL、出演役割、出演区画の根拠文を要求。スタッフ/広告/説明文への言及のみは出演扱いにしない。寺下まりか・太田昌彦・佐藤陽・高橋健一郎にはさらにpersonIdentityVerifiedを要求。既存出演者セルを自動的にVERIFIEDへ変換しない。
3. URIがある場合は再検索せず使用候補へ。ただしURL形式は対応確認ではない。EP-ID/GUID/source/Spotify show/対応根拠と、APIの番組・タイトル・配信日・再生可能性を照合。未登録/曖昧URIは保持し保留。新規自動Spotify探索は追加しない。将来補完は既存V3の候補照合を再利用し、同名・同日だけの曖昧候補は人の確認へ戻す。
4. `library-v3-spotify-playlist-client.mjs`: 既存adapterを拡張。50件ページング、開始/終了snapshot照合、不明item/途中変更/不完全応答を保留。取得結果だけで追加成功としない。
5. `library-v3-playlist-executor.mjs`: 指定試験playlist `4FiVIwysKDtLqEXfkfhu2O`、最大1件、planHash一致、明示承認、永続journalと排他が必須。本番IDへは実行不可。予約を永続保存してから1POST、全件読戻しでmembershipを確認後ADDED。403/結果不明/読戻し失敗は再送保留。既に観測/追加した話は後に人が削除しても復活させない。429はRetry-After全期間を保持。新規非公開作成は別関数・別承認・別予約で管理し、曖昧な作成を再試行しない。
6. `library-v3-playlist-journal.mjs`: ローカルの原子的置換/fsyncと排他ファイル。全プロセスは同じ保護ディレクトリを使う。クラッシュ後の残留lock/RESERVEDは自動消去せず、実状態確認後に管理者が解除する。秘密値は保存しない。
7. `preview-library-playlist.mjs`: 私有JSONからREAD_ONLYの検索/候補JSONを出力。入力を変更しない。既存出力には上書きしない。
8. `build-library-playlist-gas-preview.mjs`: 同じ検索実装をGAS用へ生成。`LibraryPlaylistPreview.js`は既存`libV3Context_(false)`を読むだけの入口。収蔵・採番・writer・トリガーを増設しない。人名/URI/同一性を未検証のセルから昇格しないため、実投稿へ直結しない。GASへの追加配備は別承認で、今回のA承認2ファイルには含めない。

予約/完了のreceiptはplaylist+Spotify IDをキーとし、操作履歴とplanHash/EP-ID/GUID/時刻/失敗分類を残す。新しいrequest IDを付けても同じURIを二重投稿しない。JST日付でのSpotify照合が一致しなければHOLDとし、時差を勝手に丸めて採用しない。

## タブ方式とWeb方式

|方式|利点|制約|役割|
|---|---|---|---|
|管理用3タブ|監査・承認・保留理由を一覧化しやすい|一般投稿者へ台帳編集権限を渡せない|管理者の承認/運用|
|Web UI|検索・個別選択・状態確認をスマホで扱える|投稿者認証、サーバー再検証、権限と通知の設計が必要|一般投稿者の入口|

**推奨はWeb UI＋非公開の管理用3タブ。** 今回はどちらも本番へ接続せず、`docs/prototypes/library-playlist/`でファイル入力式のWeb試作を実装。tokenはブラウザーへ渡さず、選択JSONの保存まで。架空デモと実データを区別して表示する。

承認後の3タブは台帳と別の管理ブックを推奨。元の6,591行/列には追加書込しない。

- プレイリスト設定: setting_id/owner/playlist_id/action/AND_OR/keywords/shows/date_from/date_to/people/enabled/approved_at
- 投稿候補キュー: request_id/setting_id/EP-ID/GUID/Spotify_URI/選択/除外/判定版/plan_hash/status/reason/received_at/validated_at/library_matched_at
- 実行履歴: request_id/EP-ID/playlist_id/status/HTTP/endpoint/retry_at/reserved_at/spotify_updated_at/readback_at/failed_at/site_published_at

受付/確認中/Spotify反映済み/サイト反映済み/要確認を区別。サイト公開時刻はPages読戻しまで埋めない。将来のWeb送信ではクライアントJSONを信用せず、サーバーが最新台帳/判定/除外を読み直してplanHashを再生成する。外部利用者には管理シートやtokenへのアクセスを与えない。

## 再現と試験

```sh
node --test tests/library-playlist-*.test.mjs tests/library-spotify-diagnostics.test.mjs tests/library-v3-search-index.test.mjs tests/library-v3-person-playlist-plan.test.mjs tests/library-v3-performer-playlist-batch.test.mjs tests/library-v3-spotify-playlist-client.test.mjs
node scripts/build-library-playlist-gas-preview.mjs
node scripts/preview-library-playlist.mjs PRIVATE_INPUT.json NEW_PRIVATE_OUTPUT.json
python3 -m http.server 8766 --bind 127.0.0.1
# Macで http://127.0.0.1:8766/docs/prototypes/library-playlist/ を開く
```

JSON契約はepisodes/decisions/query/selectedEpIds/excludedEpIds/playlistIdまたはnewPlaylistName。episodesは既存plannerのEP-ID/公式根拠契約に準拠。判定シートの見出し付き配列はdecisionValuesとして渡せる。castやSpotifyセルの非空を根拠確認の代わりにしない。

49/49ローカル試験PASS。AND/OR/日付/個別選択/出演者/未判定/重複/欠損、403/401/429/5xx、POST不明、読戻し失敗、永続予約、排他、再実行0追加、別承認の新規作成、GAS生成/無書込を確認。既存indexが重複の先頭行を残す欠陥も修正し、重複全行を検索から保留する回帰を追加。

スマホUIの実ブラウザー試験はHOLD。Playwrightブラウザー未導入で、取得した配布ファイルが不完全なため起動不可。Safariでの実操作成功を主張しない。実Spotify試験も未実行。認証がなく、判定シートの確定候補が0のため、投稿可能1件を作るために判定を捏造しない。

## 本番切替前の操作と復旧

1. **RSSは別ゲート**: Mac A/B/Cの反映SHA/2設定/トリガー/実行ログを確認し、収蔵・51セル読戻し・同一GUID0追加を実証する。今回Spotify実装をその前提条件にしない。
2. **読取照合**: 判定表の個別確定、公式出演者根拠、試験対象EP-ID/GUID/既存Spotify個別URL/show/APIメタデータ、所有/共同編集・必要scopeを確認。当該403のendpoint/HTTP/時刻/token種別・scopeの有無を取得する。秘密値/OAuth変更は不要。
3. **試験1件**: 対象EP-ID/URI、上記テストplaylist、追加前snapshot、planHash、追加最大1、同一GUID再実行0、読戻し対象と復旧操作を提示。認証済み実行経路が用意できてから試験する。本番IDはこのexecutorで実行不可。
4. **本番は別承認**: 対象playlistとルールのallowlist、実行関数、管理ブック/範囲、署名済みplan、停止方法、旧writerとの排他を提示する。承認前に既存GAS/トリガー/認証/公開JSONを切り替えない。この試作は本番allowlistを持たない。
5. **復旧**: executorの呼出を停止しjournal/予約/履歴を保全。token/IDcounter/台帳は触らない。実試験で追加した1URIの削除は、追加前snapshotとの差を確認したうえで削除承認を得て実施する（自動削除なし）。人の追加・削除をsnapshot全体置換で戻さない。コード未配備なら本番への復旧操作は不要。

PR232には既存のV3等の大きな未マージ差分も含まれ、mainとの競合が報告されている。今回の追加commitだけを独立してレビューし、PR全体をそのまま本番GASへコピーしない。既存Aの2ファイル置換手順やmanifestに混ぜない。
