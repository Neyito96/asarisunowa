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
- リポジトリ内コードにはプレイリスト名 `[P25-COPY]` の検査が存在しない。名前確認は preflight 手順(下記)で人手+ログ確認とする。コード化は別途提案。

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
1. READ_ONLY preflight: `P25_COPY_PREFLIGHT_20261107` → `P25_COPY_READ_ONLY_20261107`。確認: EP-06678 の GUID・Spotify ID、除外/HOLD履歴、テストプレイリストの名前が `[P25-COPY]` で始まること、現メンバーシップ。
2. 不一致・token無し・403・429・メンバーシップ不明のいずれかで即停止。
3. 承認(`P25_APPROVE_COPY` に inspect が返した manifest を完全一致で渡す。STALE_APPROVAL は停止)。
4. `write:true` で EP-06678 のみ POST 最大1件 → readback で追加確認 → 再実行して POST 0件を確認。
5. ログ/スナップショットのみ報告(秘密値なし)。

## 6. 停止条件
COPY専用でないGoogleアカウント / 想定外scope / Client ID 形式不正 / 本番ID検出 / テストプレイリスト名・所有者の不一致。
