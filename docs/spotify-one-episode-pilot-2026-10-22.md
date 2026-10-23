# 実Spotify1話試験 — 承認受領・認証接続待ち 2026-10-22

**未実行。** 検索判定とURIの公開情報照合を完了し、書込対象を固定した。2026-10-22のユーザー指示で、この1URI・指定テスト先・最大1の実投稿承認を受領。追加承認は不要。実行は既存Mac認証への接続待ち。承認とは別に、既存ユーザー認証でのAPI読取・実行経路が必要。WORKには認証済みSpotify工具がなく、Plugin ManagementでSpotifyを探索したが該当接続候補なし。認証設定/スコープ/リダイレクトを勝手に変更しない。

## 固定する対象

|項目|値|
|---|---|
|EP-ID|EP-00004|
|題名|（World Insight #5）停戦から1年、それでも終わらないガザ|
|番組|ニュースの現場から|
|GUID|af085854-b81e-4578-b871-b4d7005c0188|
|投稿URI|spotify:episode:6opJ4Ig4s7CTY9fRqGEHd2|
|追加先|リス田｜自動更新テスト|
|playlist ID|4FiVIwysKDtLqEXfkfhu2O|
|最大追加|1エピソード・POST1回（既存なら0回）|
|planHash|e147bc8ee91e390960baa3f74acb28b81f27c0c118777bd1d3af8ed4f441f2fe|

公開照合：公式RSSのGUID/題名/配信日時3651秒、Spotify embedの題名/番組show URI/配信時刻/3651.44秒が対応。両者の公開時刻は2026-10-06 19:00Z＝10/07 04:00 JST。台帳に既存Spotify個別URLがあり再検索なし。判定表では対象・通常・確認済み、同一GUID/音声/Spotify mappingの競合なし。

エピソード/プレイリストの公開embedを各1回GETしHTTP200、プレイリスト名とURIを確認。embed trackListは0だが、**認証付きの全件snapshotで空/既存なしが確定したことにはしない**。公開embedのplayableは投稿権限の確認でもない。

## 承認対象の操作

1. 最新判定EP-ID・元GUID/URIとplanHashを再確認。本番RSS/GAS/トリガーに触れない。
2. 既存ユーザー認証で `GET /playlists/{testId}?fields=id,snapshot_id`、`GET /playlists/{testId}/items?limit=50&offset=…&additional_types=episode` を全ページ取得し、前後snapshotを確認。対象以外のIDを指定しない。所有/共同編集・スコープを確認する。
3. `GET /episodes/{episodeId}?market=JP` で番組・題名・配信日・再生可能性を読取照合。日付は公開時刻がUTC6日/JST7日である点に注意し、APIのday precisionが不一致ならHOLDし勝手に承認範囲を変えない。
4. 既存ならPOST0として記録。なければ既存executorの永続予約・ロック・最大1・planHash承認で `POST /playlists/{testId}/items` を1回だけ実施。
5. 新しい全件snapshotで当該URIの存在を確認しADDEDを記録。再実行しPOST0を確認。実POSTの2xxだけでは成功にしない。
6. 401/403/429/不完全ページ/不明item/通信断/読戻し失敗/競合は停止または保留。再送して結果を推測しない。401/403の無秘密request証拠を保存し、根因を確定できなければ未確定とする。

承認書込範囲はこのテストplaylist内の1URIだけ。既存本番playlist、台帳URLセル、OAuth、GAS配備/trigger、メール、公開JSON/Pages、PR mergeは含めない。新規playlist作成も含めない。

## 復旧と未解決

書込前snapshot/URI集合/予約receiptを保存。異常時は停止して予約を保全し、結果不明のPOSTを再送しない。追加済み1URIの削除は実行前に別承認を求め、playlist全体の置換や他の人の編集を巻き戻さない。

認証付き権限とAPI応答の実測は未完了。403は今回再現しておらず、旧403の対象method/endpoint/token種別/scope/所有関係が不明なため個別原因は確定していない。公開ページ200で403解消と判定しない。実RSS収蔵も、公式8本の取得成功とGAS定期実行を区別し、最新実機ログはHOLD。前回のA/B/C承認は今回のSpotify投稿承認へ流用しない。

台帳/公式RSSを使った判定6,591行の反映証拠は既存PR250の `docs/search-scope-2026-10-22.md`。実行用planと無秘密の根拠は `docs/audits/2026-10-22-spotify-pilot/`。既存49ローカル/4 CIの試験証拠を再利用し、今回本番成功を主張しない。

## 承認後のMac実行口（今回の追加）

`node scripts/library-v3-playlist-pilot.mjs --preflight` をWORKで実行。2026-10-22T09:50:08Z、`AUTH_ROUTE_UNAVAILABLE`、API0/POST0。件数・読戻し・再実行追加・403有無は未測定。これは実Spotify試験の失敗/成功ではなく、認証経路未接続による未実行。claspのGoogle認証はSpotifyユーザー認証に流用できない。

既存executor/client/journalを再利用したMac Node22用入口を追加。固定planHash/EP-ID/URI/playlist/max1、全件snapshot、owner/実付与scope確認、予約永続化、読戻しと再実行0を要求する。403を含む非2xx/通信断が起きた時点で後続通信を停止し、自動再送しない。token、API生応答、所有者IDをログに出さない。ログはHTTP/時刻/固定endpoint/件数/snapshot/結果の無秘密要約。401/403/429を区別する。公開UTC日とJST日の差を理由にidentity条件を緩和しない。不一致はPOST0/HOLD。

**残る接続作業:** 既存のSpotify認証がMacローカルのどの実行ファイルにあるか、またはどのGASプロジェクトにあるかを確認する。認証値は送付しない。GASの `getSpotifyUserAccessToken()` しか存在しない場合、このNode入口へ直接接続済みとは扱わない。新規OAuth、scope変更、GAS配備は行わず、接続にそれらが必要なら具体差分を別途承認依頼する。

既存のローカル認証を使える場合、外部ローカルmoduleは `getExistingSpotifyAuth()` をexportし、メモリ上に `{accessToken, grantedScopes}` を返す。grantedScopesは過去の実付与記録を使い、要求scopeから推定して埋めない。既存の認証管理以外へのtokenコピー、ソース/ターミナル/チャットへの貼付は禁止。providerを今回新規の認証方法として捏造しない。実付与scope不明ならread-only preflight後HOLD。

既存providerの絶対パスが確定した後、同一Mac上・同じjournalを使い、リポジトリ内で実行する（パスは実在ファイルへ置き換える）。

```sh
node scripts/library-v3-playlist-pilot.mjs --preflight /absolute/path/to/existing-auth-provider.mjs
node scripts/library-v3-playlist-pilot.mjs --execute-approved /absolute/path/to/existing-auth-provider.mjs
```

2つ目は今回の承認だけを使用し、成功時は内部で再実行0まで検証する。ログはMacの `~/asarisunowa-spotify-pilot-EP-00004/result-日時.json`、永続予約は同ディレクトリのjournal。各runログは別名で保全し、journalを削除して再実行しない。403/結果不明/読戻し失敗は停止、確認できない件数はnull。実行したMacから無秘密のresultを返却して、実試験結果を確定する。成功後の削除/全置換は今回の承認外。

今回の追加試験はすべて無通信モック。API実投稿・OAuth変更・GAS配備・元台帳/本番playlist/公開siteの変更0。

## 本番GASの特定後のREAD_ONLY確認

ユーザーが認証元を「朝リスの輪 プレイリスト投稿受付」、Macの既取得先を `~/Desktop/asarisu-gas-audit-20261012` と特定。プロジェクト名/Script IDを把握したことと、WORKからソース・関数を実行可能なことを区別する。WORKからMacのパスは参照できない。

GitHubの0841c7c時点のコードをREAD_ONLY確認（8ファイルSHAはproduction-auth-route.json）。

|経路|確認した挙動|試験での扱い|
|---|---|---|
|SpotifyAuth.js / getSpotifyUserAccessToken|ユーザーaccess tokenのcacheを参照。なければScriptPropertiesの既存refresh tokenでaccounts.spotify.com/api/tokenへrefresh_token grant。取得tokenはcache内のみ|既存GAS内で再利用可能な設計。現在の秘密値の存在/有効性は未確認。関数の返り値をログやclasp run応答に出さない|
|Spotify.js / getSpotifyAccessToken|client_credentials grantのアプリ用token|ユーザーplaylistへの投稿認証として流用しない|
|startSpotifyUserAuth / callback|OAuth state生成、認可・refresh token保存|今回呼び出さない。要求scope3種が記載されていても現在の実付与scopeとは判定しない|
|PlaylistAuto.js|getSpotifyUserAccessTokenから同期へ渡す|全playlist同期は実行しない|
|PlaylistAutoSpotify.js|items?market=JP&limit=100、nextをたどる全件取得|新しい固定対象clientのlimit50/前後snapshotとは異なる。実機へ勝手に修正しない|
|PlaylistAutoEpisodes.js|GET429時にRetry-Afterを最大60秒へ短縮し2回再試行|今回の即停止試験には使わない。今回の403原因をこれと断定しない|
|PlaylistAutoWrite.js|個別/一括POST /items。2xx時のmembership読戻しはこのhelperにはない。個別forEachは403を記録後に次要素へ継続|そのまま試験しない。固定対象、最大1、最初の異常後の停止・読戻し・予約が必要|
|PlaylistAutoV2Production.js|repoではenabled=false。候補全体処理、scoped state保存、場合により一覧表の日付更新|実機の設定とは断定しない。今回の承認範囲を越えるため同期関数を実行しない|
|AutoUpdateAutomationV1.js / inspectAutoUpdatePlaylistAccessV1_|GET /me とplaylist owner/collaborativeを確認。失敗はprofile/playlistの粗いreasonにする|この診断だけでHTTP403根因/実付与scopeは確認できない。pending全体診断も今回実行しない|

認証の既存実装は再利用候補として確認できたが、現在の実機との一致と有効な権限はHOLD。403が以前発生した理由は、対象request/当時のtoken種別/HTTP証拠なしのため未確定。

追加の実アクセス確認：指定GAS編集URLをcloud browserで開いたがGoogle DevelopersのApps Script紹介・ログインページへ転送され、編集ソースは取得できなかった。接続済みDriveでもApps Script MIME/朝リスの名前に該当する取得可能なプロジェクトなし。既存Google Drive/Sheetsへのアクセス権はGAS Execution APIのアクセス権ではない。Spotify APIリクエスト0であり、403無しとも解消とも記録しない。

### Macで次に取得する証拠（読取のみ）

既存99ファイル取得先を上書きせず、新しい一時フォルダーへ現在のソースを取得し、まずSHAだけ返す。既存clasp認証が利用できるMacで実行。`clasp clone` はダウンロードのみ。push/deploy/run/loginや秘密値の出力は含めない。

```sh
spotify_audit_dir="$(mktemp -d "$HOME/Desktop/asarisu-spotify-readonly.XXXXXX")"
cd "$spotify_audit_dir"
clasp clone 1HpZNp96TQ7S1ilmfyItKI2IxYgdk8ufCsWXSVNEaGkh7_uQRXkr6k1I9
shasum -a 256 SpotifyAuth.js Spotify.js PlaylistAutoSpotify.js PlaylistAutoV2Production.js AutoUpdateAutomationV1.js PlaylistAutoWrite.js PlaylistAutoEpisodes.js PlaylistAuto.js
```

返却するのは8ファイルのSHA結果のみ。拡張子が.gsの場合はその実在ファイル名を使う。認証失敗なら秘密を含まないエラー種別のみ返し、勝手に再認証しない。実ソースのSHAが異なれば、その時点で最新ソースとの差を確認する。ScriptPropertiesやclasp認証ファイルの内容は返さない。

実試験の承認自体は有効。GAS内に現在の承認対象だけを実行する安全な入口がなければ、NodeからGASのtokenを取り出して代用しない。既存同期関数を流用して範囲を拡大することもしない。必要なGASの追加関数と予約receiptの範囲を準備して、GASコード反映について別承認を求める（今回その反映は行っていない）。

## READ_ONLY実API接続の最小反映案（未承認・未配備）

ユーザーから届いたSpotifyAuth.jsを、repo版へ3箇所のログ差分だけ戻して再構成。SHAは実機報告の13d28dc8595182f44a9ce5bd301e448f5b95aad08c20d19ed842153e746a1bccと完全一致し、認証フロー/要求scopeの差分なしを確認できた。他の不一致5ファイルは今回の診断では呼ばない。ALIBは一切呼ばない・変更しない。

実機からのトークン直返し、Macへの秘密値転送、既存の全playlist同期は使わない。既存のgetSpotifyUserAccessTokenをGAS内部で呼び、診断結果のみ返す。これには本番GAS保存内容の変更が生じるため、従来の本番GAS反映の事前承認条件に従い、次の2点だけの反映承認を求める。Spotify1件試験の承認を取り直すものではない。

|変更|対象と内容|復旧|
|---|---|---|
|既存1ファイルのログ1ブロック修正|SpotifyAuth.jsのrefresh失敗時だけ、getContentText出力をHTTPステータス出力へ置換。scripts/manual/SpotifyAuth.refresh-log-only.patch。関数/認証設定/scope/redirect/成功時処理不変。修正後SHA630f1db8fe78360582074285c03207e51b5058e7665f84c62e94fb078212bbcb|既取得の実機バックアップから同ファイルだけ復元し元SHA13d28dc…を確認|
|診断ファイル1つ追加|scripts/manual/SpotifyApprovedPilotReadOnly.gs。公開関数inspectApprovedSpotifyConnection20261022。正しいScript IDでだけ動作。GET /me→固定test playlist metadata→全ページitems(limit50)→metadata再確認→固定episode GET。各非200/403/401/429/通信断は即停止。token/生応答/ユーザーIDは非出力|この新規ファイルだけ除去。既存99ファイル/trigger/台帳/playlistは触らない|

新規関数名が実機99ファイル内にないことを確認してから追加。manifest/OAuth/認証情報/既存trigger/ALIBに触れない。99ファイルのclasp pushや丸ごと置換は実施しない。GASエディタで承認済みの既存1ブロックと新規1ファイルだけ保存し、新しいweb app deploymentや公開設定変更をしない。通常の既存token refreshはGAS内の既存cache更新のみ。新規ScriptPropertiesを作らない。既存OAuth開始/callbackは呼ばず、その2関数内の旧ログは今回の変更範囲外で実行しない。

診断はSpotifyリソースへのGETだけ。認証cacheがなければ既存認証関数の通常refresh POST(accounts.spotify.com/api/token)が発生し得る。正常取得tokenは既存cache内のみ、返り値/ログへ出さない。refresh失敗は既存関数がHTTPのみログ出力し、空tokenで診断停止。勝手な再認証/再試行なし。

成功してもREAD_ONLYで実付与modify scopeを証明したとは記録しない。GETでユーザー認証/所有/全件閲覧/既存登録は確認できるが、実付与scopeは既存実装で保存されていないためUNVERIFIEDと出す。必要write scopeはplaylist.publicから示す。POST権限の実証は承認済みの後続1件試験で行い、その403は成功にしない。診断自体にはplaylist POST処理なし。診断成功だけで既存syncを呼ばない。

GET403時はstatus STOP_403、失敗endpoint/HTTP/時刻を保存し後続request0。根本原因は応答だけで特定不能ならFORBIDDEN_ROOT_CAUSE_UNCONFIRMED。401/429/ネットワークと区別する。全件snapshot不完全/編集競合/null itemは保留。トークン返却や所有者ID出力なし。

検証：tests/library-playlist-gas-connection.test.mjsの12/12 PASS（無通信VMモック、403の発生段階ごとの即停止、401/429、秘密値非出力、未修正ログ検知、snapshot競合、既登録/他所有/null itemを含む）。実API0/POST0。ALIB/本番台帳/本番playlist/既存trigger/公開site変更0。承認後、Mac操作は1コマンドずつ案内し、次の出力を確認してから進める。
