# Google Apps Script 整理マップ

このファイルは、`scripts/google-apps-script/` の責務を整理し、今後の変更を小さな Pull Request 単位で安全に進めるための作業メモです。

## 現在の方針

- `コード.js` は Web アプリの入口 (`doGet` / `doPost`) とルーティングに限定する。
- 入力解析、検証、保存、API読み取り、Podcast URL解析などの補助処理は責務ごとのファイルへ分離する。
- 1 PR = 1責務を基本とし、整理と挙動変更を同じPRに混ぜない。
- GitHub上の整理と Apps Script 本番への `clasp push` / デプロイ / トリガー変更は別工程にする。
- 本番Spotify・スプレッドシートへの書き込み処理は、整理PRの確認目的では実行しない。

## 現在の主な役割

| ファイル | 主な役割 |
| --- | --- |
| `コード.js` | Web アプリ入口 (`doGet` / `doPost`) とルーティング。 |
| `ApiCommon.js` | URL・タイトル正規化、JSON / JSONPレスポンス、JSONP callback検証。 |
| `ApiReadHandler.js` | `playlist` / `podcast` / `listenerPodcast` のAPI読み取り分岐。 |
| `HttpFetch.js` | `fetchJson` / `fetchText` による共通HTTP取得補助。 |
| `PostInput.js` | `doPost` 入力の読み取り・正規化。 |
| `PostValidation.js` | 投稿入力長、必須項目、投稿種別、URL形式の検証。 |
| `PostArtwork.js` | 投稿時のアートワーク補完。 |
| `PostSheets.js` | 投稿保存で使うシート取得と受付ログ。 |
| `PostDuplicate.js` | 通常投稿の重複判定。 |
| `PostWrite.js` | 通常投稿の保存先選択と行追加。 |
| `PostSave.js` | 通常投稿保存処理全体の取りまとめ。 |
| `AutoUpdateRequest.js` | プレイリスト自動更新申請の受付。 |
| `SheetData.js` | シート読取、重複判定、シート名のゆるい取得。 |
| `PodcastResolve.js` | Podcast URL解析、番組情報・アートワーク・配信元判定。 |
| `PodcastResolveHandler.js` | `doGet` の `type=resolve` API処理。 |
| `PodcastPlatformSync.js` | 朝リスPodcastの配信先URL補完。シートへの書き込みを伴う。 |
| `Spotify.js` | SpotifyユーザーOAuth、Client Credentials、プレイリスト取得、Spotify番組解決、Podcast URL解決。 |
| `PlaylistAuto.js` | 共通ルールによるSpotifyプレイリスト自動更新。 |
| `PlaylistSpecial.js` | 共通ルールに収まらない特殊更新。 |
| `PlaylistDates.js` | プレイリスト最終更新日の取得・書き込み。 |
| `Test.js` | 読み取り中心の手動診断。実行前に呼び出し先を確認する。 |
| `TestWriteDanger.js` | 本番データを書き換える可能性がある診断。明示承認なしに実行しない。 |

## 完了した主な分離

- PR #28: HTTP取得補助を `HttpFetch.js` へ分離。
- PR #30: 投稿入力長チェックを `PostValidation.js` へ分離。
- PR #31: 投稿URL検証を `PostValidation.js` へ分離。
- PR #32: 自動更新申請処理を `AutoUpdateRequest.js` へ分離。
- PR #33: 投稿重複判定を `PostDuplicate.js` へ分離。
- PR #34: 通常投稿の保存先選択・行追加を `PostWrite.js` へ分離。
- PR #35: 通常投稿のシート取得・受付ログを `PostSheets.js` へ分離。
- PR #36: 通常投稿保存処理全体を `PostSave.js` へ分離。
- PR #37: 通常投稿の基本入力検証を `PostValidation.js` へ分離。
- PR #38: 投稿時のアートワーク補完を分離。
- PR #39: `doPost` 入力読み取りを `PostInput.js` へ分離。
- PR #40: JSONP callback検証を `ApiCommon.js` へ共通化。
- PR #41: Podcast URL解析API処理を `PodcastResolveHandler.js` へ分離。
- PR #42: `playlist` / `podcast` / `listenerPodcast` のAPI読み取りを `ApiReadHandler.js` へ分離。

## 現在の評価

### `doPost`

現時点で十分に薄い。入力解析、入力長チェック、自動更新申請、基本検証、アートワーク補完、投稿種別・URL検証、保存処理の順に補助関数へ委譲している。

**方針:** 当面はこれ以上細分化しない。API契約や処理順を変える必要が出たときにのみ個別PRで扱う。

### `doGet`

現時点で十分に薄い。OAuth callback / OAuth取消、callback検証、status、resolve、各データ読み取り、未知typeエラーのルーティングを担当する。

**方針:** `status` や `type` 読み取りだけをさらに別ファイルへ移すような細分化は、現時点では効果が小さいため優先しない。

## Spotify責務調査（2026-09-13）

`Spotify.js` は現在、少なくとも次の4系統の責務が同居している。

1. **ユーザーOAuth**
   - `SPOTIFY_USER_REDIRECT_URI`
   - `startSpotifyUserAuth()`
   - `handleSpotifyUserOAuthCallback_(e)`
   - `getSpotifyUserAccessToken()`

2. **ユーザー権限でのプレイリスト取得補助**
   - `getAllSpotifyPlaylistItems_(playlistId, token)`

3. **Client CredentialsによるSpotify公開API読み取り**
   - `getSpotifyAccessToken()`
   - `fetchSpotifyShowFromWebApi(showId)`

4. **Spotify / Podcast URL解決**
   - `resolveSpotifyShow(cleanUrl)`
   - `fetchSpotifyJson(url)`
   - `fetchSpotifyText(url)`
   - `resolvePodcastUrl(url)`

### 依存関係上の重要点

- `getSpotifyUserAccessToken()` はユーザーOAuth用で、プレイリスト更新系から使う。
- `getSpotifyAccessToken()` はClient Credentials用で、Spotify番組情報取得側から使う。名前が似ているが用途は別。
- `fetchSpotifyShowFromWebApi()` は `getSpotifyAccessToken()` に依存する。
- `resolveSpotifyShow()` は `fetchSpotifyShowFromWebApi()` と、`PodcastResolve.js` 側の `firstMeta` / `cleanupMaker` / `decodeHtml` / `looksLikeEpisodeTitle` / Apple補完関数群に依存する。
- `resolvePodcastUrl()` はSpotifyだけでなくApple Podcasts、YouTube、HTMLメタ情報取得も扱うため、単純に `Spotify.js` だけの責務とは言い切れない。

### 分離方針

最も安全な次の候補は、**ユーザーOAuthだけを `SpotifyAuth.js` へ単純移動すること**。

移動対象は以下だけに限定する。

- `SPOTIFY_USER_REDIRECT_URI`
- `startSpotifyUserAuth()`
- `handleSpotifyUserOAuthCallback_(e)`
- `getSpotifyUserAccessToken()`

この4項目は `Spotify.js` の先頭に連続しており、その直後からプレイリスト取得処理へ切り替わるため、責務境界が明確。

一方、`getSpotifyAccessToken()` や `fetchSpotifyShowFromWebApi()` はPodcast解決側と密接なので、この段階では動かさない。

## 次に確認する候補

### 1. `SpotifyAuth.js` へのユーザーOAuth分離

上記4項目を処理内容・関数名・定数値を変えずに単純移動する。

**注意:** 認証フロー自体は実行しない。GitHub上のファイル分割だけに限定する。

### 2. `PodcastResolve.js` の責務整理

Podcast解決処理は機能上まとまりがある一方、Spotify / Apple / HTMLメタデータ / タイトル整形など複数の補助処理を含む。まずは関数一覧と依存関係を確認し、分けるなら「単純移動だけ」で成立するまとまりがあるかを調査する。

**注意:** 動作が複雑で外部サービス依存もあるため、無理に分割しない。

### 3. `PlaylistAuto.js` / `PlaylistSpecial.js` の境界確認

共通ルール化が進んだため、特殊処理として残すべきものと共通化できるものを棚卸しする。ただし、実際のプレイリスト更新ロジック変更は整理PRと分ける。

### 4. 定数配置

`SPREADSHEET_ID`、シート名、投稿合言葉などの定数を `Config.js` へまとめる案はあるが、現状でも入口ファイルから参照しやすく、効果は限定的。優先度は低い。

## 安全な進め方

1. 1 PR = 1責務の移動または1種類の文書更新に限定する。
2. 挙動変更とファイル移動を同じPRに混ぜない。
3. グローバル関数名・定数名の重複がないことを確認する。
4. Apps Script本番への `clasp push` / デプロイ / トリガー変更は別工程にする。
5. 本番Spotify・スプレッドシートへの書き込み処理は、整理PRの確認目的では実行しない。
6. `コード.js` は現時点で「入口として十分薄い」とみなし、過剰分割を避ける。

## 推奨する次の作業

`Spotify.js` 先頭のユーザーOAuth4項目を `SpotifyAuth.js` へ単純移動する。

この作業では処理内容・関数名・定数値を変えず、Spotify認証・プレイリスト更新・Apps Script本番デプロイは実行しない。
