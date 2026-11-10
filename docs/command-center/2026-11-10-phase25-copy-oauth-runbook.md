# Phase25 COPY OAuth 監査と最短手順書 (2026-11-10)

対象: COPY 専用 GAS `16qdHt_nojvKK4Qzcww4C7jkg6frpLiYIHXn4CG-_UtILn4qKlmoixT9R`。本番・main・トリガーは変更しない。
秘密値(Client ID を除く token / secret / auth code / verifier)は会話・GitHub に出さない。

## 1. 実コード監査結果 (COPY GAS 上のソースを読み取りのみで確認)

| 項目 | 実コード |
|---|---|
| 認可開始関数 | `P25_COPY_PREPARE_SPOTIFY_AUTH()` (引数なし) |
| コールバック | `P25_COPY_SPOTIFY_CALLBACK(e)` (stateトークンのメソッド名) |
| redirect URI | `'https://script.google.com/macros/d/' + ScriptApp.getScriptId() + '/usercallback'` = 指令の URI と一致 |
| Client ID の保管 | Script Property `P25_COPY_SPOTIFY_CLIENT_ID` (英数32桁、不一致は COPY_CLIENT_ID_REQUIRED) |
| scope | `playlist-read-private playlist-modify-private` のみ |
| フロー | Authorization Code + PKCE(S256)。client secret 不要。`show_dialog=true` |
| state/nonce | `ScriptApp.newStateToken()` (timeout 600s) + nonce を Script Property に保存。コールバックで nonce 一致と期限(10分)を検証、不一致は拒否 |
| コード交換 | `accounts.spotify.com/api/token` に code+verifier。HTTP200・bearer・expires_in>0・返却scopeがちょうど上記2つ、を全て満たさなければ保存しない |
| 後始末 | nonce/verifier/期限/client/URL を finally で削除。Spotify の playlist 操作は一切しない |
| 保存先 | `P25CopyToken.js` の `p25CopyTokStore_`。`P25_COPY_SPOTIFY_ACCESS_TOKEN/_REFRESH_TOKEN/_EXPIRES_AT` |
| 注意 | 認可URLは Script Property `P25_COPY_AUTH_URL` に保存され、ログには出ない |

注: P25CopySpotifyAuth / P25CopyToken / P25LiveRead は COPY GAS にのみ存在し、本PRのリポジトリには未収録。

## 2. 前回 `COPY_ISOLATION_REQUIRED` になった原因 (確定)

`P25_INSPECT_COPY(config, playlistId)` 等のドロップダウン関数は **config を引数で受け取る**。エディタから実行すると config が undefined になり、`p25CopyIo_` が必ず `COPY_ISOLATION_REQUIRED` を投げる。設定不備ではない。
正しい入口は引数なしの `P25_COPY_PREFLIGHT_20261107` / `P25_COPY_READ_ONLY_20261107`(内部で `p25CopySessionConfig20261107_()` を渡す)。

## 3. 試験に必要な設定 (`p25CopySessionConfig20261107_`)

- `copyPlaylistIds: ["1N0T7tMxPMKxXy77C0RPMw"]` (ちょうど1件。非公開・認可ユーザー所有であること)
- `officialFeedUrls`: omny.fm / omnycontent.com / feeds.megaphone.fm の公式フィード(空だと READ_ONLY が COPY_SETUP_INCOMPLETE)
- 書き込み実行時のみ: `write:true`, `legacyWriterDisabled:true`(COPY GAS にはレガシーwriterが無いことの確認後), `maxAdditions:1`, `maxPlaylists:1`
- COPY Sheet: `P25_STATE` 1行目 `key|version|part|json`、`自動更新申請` に test playlist の URL 行(状態は 確認待ち/招待承認待ち/増分自動更新/初回補完中 のいずれか)
- ledgerSheetId は本番台帳(読み取りのみ)。state/request に本番シートは使えない(コードでガード済み)
- 試験プレイリストの実記録(11/07 COPYセッション記録): ID `1N0T7tMxPMKxXy77C0RPMw`、名称「朝リス Phase25 COPY試験 2026-11-07」、NEYITO所有、非公開、空。**`[P25-COPY]` 接頭辞は実態と不一致のため受入条件から廃止**(名称変更は承認されておらず行わない)。受入条件は下記の強一致(ID・所有者・非公開・allowlist)とする。コードに名前検査は無く、リポジトリ内に `[P25-COPY]` は存在しない。

## 4. 既存 Spotify アプリの流用可否

- 技術的には可能: COPY の redirect URI をアプリの Redirect URIs に追加し、Client ID を COPY の Script Property に入れるだけ(PKCE なので secret 不要)。
- 懸念: 流用先が本番用アプリだと、本番アプリの設定(Redirect URI)に触れる。Development Mode ではアプリ数・許可ユーザー数に制限があり、認可する Spotify アカウントがそのアプリのユーザー許可リストに入っている必要がある。
- 判定基準(管理人がダッシュボードで確認): ①COPY用に使うSpotifyアカウントがアプリの所有者/許可ユーザーか ②そのアプリが本番GASと共用か。②が「共用」なら新規作成を推奨、「未使用/COPY用に作成済み」なら流用可。**未確認事項**: ダッシュボードの実状態(サンドボックスから Spotify に到達できないため未検証)。

## 5. 最短手順 (管理人の操作は 認可1回 + 実行1回)

事前(Claude が COPY GAS 上で準備。管理人操作なし): config の copyPlaylistIds/officialFeedUrls、シート見出しの確認。ただし **Google アカウントが COPY 専用と確認できるまで認可は開始しない**。

### 操作A: 認可 (管理人)
1. Spotify Dashboard で対象アプリの Redirect URIs に `https://script.google.com/macros/d/16qdHt_nojvKK4Qzcww4C7jkg6frpLiYIHXn4CG-_UtILn4qKlmoixT9R/usercallback` を登録し、Client ID(32桁)を COPY GAS の プロジェクトの設定 → スクリプト プロパティ `P25_COPY_SPOTIFY_CLIENT_ID` に直接入力(チャット・GitHub には貼らない)。
2. COPY GAS で `P25_COPY_PREPARE_SPOTIFY_AUTH` を実行 → 10分以内に Script Property `P25_COPY_AUTH_URL` の URL を開き(値は共有しない)、Spotify にログインして2権限を許可。
3. 画面に「COPYの読み取り・非公開プレイリスト変更用トークン…保存しました」と出れば完了。

### 操作B: 実行 (Claude 実施、管理人の操作は承認のみ)
1. READ_ONLY preflight: `P25_COPY_PREFLIGHT_20261107` → `P25_COPY_READ_ONLY_20261107`。確認: EP-06678 の GUID・Spotify ID、除外/HOLD履歴、テストプレイリストについて 実ID=`1N0T7tMxPMKxXy77C0RPMw`・所有者が認可したSpotifyアカウント(NEYITO)・非公開(public=false)・`copyPlaylistIds` と完全一致、の4点が強一致すること(名称は記録値「朝リス Phase25 COPY試験 2026-11-07」と一致を参考確認、不一致でも上記4点が一致していれば可。名称変更は行わない)、現メンバーシップ。
2. 不一致・token無し・403・429・メンバーシップ不明のいずれかで即停止。
3. 承認(`P25_APPROVE_COPY` に inspect が返した manifest を完全一致で渡す。STALE_APPROVAL は停止)。
4. `write:true` で EP-06678 のみ POST 最大1件 → readback で追加確認 → 再実行して POST 0件を確認。
5. ログ/スナップショットのみ報告(秘密値なし)。

## 6. 停止条件
COPY専用でないGoogleアカウント / 想定外scope / Client ID 形式不正 / 本番ID検出 / テストプレイリストの実ID・所有者・非公開設定・allowlist のいずれかの不一致、または現メンバーシップ取得不能(名称のみの差異は停止条件にしない)。
Googleアカウント確認: COPY GAS にログイン中のアカウントが COPY 専用か(アドレスの提出は不要、Googleアカウント画面で本人確認)。確認が済むまで操作A は開始しない。Spotify Dashboard に未使用/COPY専用アプリがあれば流用、無い場合のみ新規作成。本番アプリの流用は原則避ける。`P25_COPY_AUTH_URL`(state を含む)・token・nonce は貼付禁止。

## 7. 更新 (2026-11-10 14:38 JST): トークン露出対応

司令塔確認: COPY GAS のスクリプトプロパティに Client ID・Access Token・Refresh Token・有効期限・2 scope が既に存在。従来の「未設定」は撤回。ただし Access/Refresh Token がスクリーンショットに写ったため **既存トークンは露出済みとして扱う**。Claude は秘密値を読まず・転記しない(プロパティの値の取得は一切行っていない)。「認可済み」とは断定しない。

### 7.1 失効(管理人、画面操作)
1. Spotify アカウントの「アプリ」(Account → Apps / 接続済みアプリ)で当該 COPY 用アプリの「アクセス権を削除(Remove access)」を実行 → そのユーザーに発行済みの Refresh/Access Token が無効化される(Spotify 公式画面の表示に従う。結果が画面で確認できない場合は未失効として扱う)。
2. COPY GAS のスクリプト プロパティから `P25_COPY_SPOTIFY_ACCESS_TOKEN` / `P25_COPY_SPOTIFY_REFRESH_TOKEN` / `P25_COPY_SPOTIFY_EXPIRES_AT` を削除(値は開かず、行の削除のみ)。`_CLIENT_ID` は秘密ではないので残してよい。
3. 画像が GitHub/チャットに残っている場合は削除または非表示にする。Client Secret は PKCE のため不要。もし Secret が設定されていたら Dashboard で再発行。
4. 本番GAS・本番Spotify アプリのトークンは対象外(触らない)。

### 7.2 安全な再認可(操作A を再実行)
- 前提: §5 操作A と同じ。Google アカウント COPY 専用確認 → Spotify Dashboard の COPY 用アプリ確認 → `P25_COPY_PREPARE_SPOTIFY_AUTH` → 10分以内に認可。以降、**スクリーンショットでスクリプト プロパティを開いた状態を撮らない**(値は表示しない)。

### 7.3 再取得後の READ_ONLY 確認(Claude 実施。EP-06678 書込みはこの全てが済むまで禁止)
実施順: ① `P25_COPY_PREFLIGHT_20261107`(isolation PASS・POST 0) ② プレイリスト実ID・所有者・非公開・allowlist一致の確認 ③ membership取得(snapshot前後一致) ④ トークン有効性は GET のみで確認。いずれも `write:false`。
- 注意(コード監査): 既存 `readMembership` は snapshot_id と items のみ取得し、**所有者・public/private は検査しない**。②のために GET `playlists/{id}?fields=owner(id),public,name` を行う READ_ONLY 関数を COPY GAS に追加する提案(COPY GAS への追加であり本番変更ではないが、管理人承認後に実施)。承認前は管理人が Spotify 画面で所有者・非公開を目視確認し、結果のみ(値でなく「一致/不一致」)を記録する。
- 停止: 401/403/429、scope が2つ以外、所有者/非公開/ID/allowlist 不一致、membership 取得不能、本番ID検出。
