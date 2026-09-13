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
| `PodcastResolve.js` | Podcast URL解析、Spotify episode解決、Appleカタログ補完、HTMLメタ情報・タイトル整形。 |
| `PodcastResolveHandler.js` | `doGet` の `type=resolve` API処理。 |
| `PodcastPlatformSync.js` | 朝リスPodcastの配信先URL補完。シートへの書き込みを伴う。 |
| `SpotifyAuth.js` | SpotifyユーザーOAuth、認証callback、ユーザーアクセストークン取得。 |
| `Spotify.js` | Client Credentials、プレイリスト全件取得補助、Spotify番組解決、Podcast URL解決。 |
| `PlaylistAuto.js` | 共通ルールによるSpotifyプレイリスト自動更新。 |
| `PlaylistSpecial.js` | 共通自動更新への薄い入口。 |
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
- PR #45: SpotifyユーザーOAuth関連を `SpotifyAuth.js` へ分離。

## 現在の評価

### `doPost`

現時点で十分に薄い。入力解析、入力長チェック、自動更新申請、基本検証、アートワーク補完、投稿種別・URL検証、保存処理の順に補助関数へ委譲している。

**方針:** 当面はこれ以上細分化しない。

### `doGet`

現時点で十分に薄い。OAuth callback / OAuth取消、callback検証、status、resolve、各データ読み取り、未知typeエラーのルーティングを担当する。

**方針:** `status` や `type` 読み取りだけをさらに別ファイルへ移すような細分化は優先しない。

## Spotify整理後の評価（2026-09-13）

ユーザーOAuthは `SpotifyAuth.js` へ分離済み。

`Spotify.js` に残る主な責務は以下。

- `getAllSpotifyPlaylistItems_()`：自動更新で使うプレイリスト全件取得補助。
- `getSpotifyAccessToken()`：Client Credentials用アクセストークン。
- `fetchSpotifyShowFromWebApi()` / `resolveSpotifyShow()`：Spotify番組情報取得。
- `fetchSpotifyJson()` / `fetchSpotifyText()` / `resolvePodcastUrl()`：Spotifyを含むPodcast URL解決補助。

`getAllSpotifyPlaylistItems_()` は `PlaylistAuto.js` から使われるが、この1関数だけのためにファイルを増やす効果は小さい。

**方針:** Spotify整理はいったんここで止める。Client Credentials系と番組解決系は依存が強いため、無理に分割しない。

## PodcastResolve責務調査（2026-09-13）

`PodcastResolve.js` は次のまとまりを持つ。

1. **入力URL・タイトル判定**
   - `normalizePodcastInputUrl()`
   - `looksLikeEpisodeTitle()`

2. **Spotify episode → 番組解決**
   - `resolveSpotifyEpisode()`
   - `resolveSpotifyShow()` やSpotify取得補助に依存する。

3. **Apple Podcastsカタログ補完**
   - `findPodcastByEpisodeTitle()`
   - `findPodcastMetadataByTitle()`
   - `findPodcastArtworkByTitle()`

4. **HTMLメタ・文字列整形**
   - `firstMeta()`
   - `cleanupTitle()`
   - `cleanupMaker()`
   - `decodeHtml()`
   - `detectProvider()`

### 分離価値の評価

最も境界が明確なのは **Apple Podcastsカタログ補完3関数**。

この3関数は共通して iTunes Search API を読み取り、番組名・配信者・アートワークを補完する責務を持つ。Spotify episode解決やHTMLメタ解析とは役割が異なる。

次に分けるなら、以下3関数だけを `PodcastApple.js` へ単純移動する。

- `findPodcastByEpisodeTitle()`
- `findPodcastMetadataByTitle()`
- `findPodcastArtworkByTitle()`

関数名・検索URL・一致判定・戻り値は変更しない。

一方、`resolveSpotifyEpisode()` は `resolveSpotifyShow()` や文字列整形へ依存するため、現時点では残す。

`firstMeta()` / `cleanupTitle()` / `cleanupMaker()` / `decodeHtml()` / `detectProvider()` は複数の解決処理から共有されるため、単なるファイル数増加にならないかを見てから判断する。

## 次に確認する候補

### 1. Apple Podcastsカタログ補完を `PodcastApple.js` へ分離

上記3関数だけを単純移動する。

**注意:** iTunes Search APIの呼び出し条件や一致ロジックは変更しない。外部APIの実行テストは整理PRでは行わない。

### 2. `PlaylistAuto.js` / `PlaylistSpecial.js` の境界確認

`PlaylistSpecial.js` は現在、共通ルールへの薄い入口になっている。残す価値があるか、名前を含めて後で棚卸しする。ただし実際の更新ロジック変更は別PRにする。

### 3. 定数配置

`SPREADSHEET_ID`、シート名、投稿合言葉などの定数を `Config.js` へまとめる案はあるが、効果は限定的。優先度は低い。

## 安全な進め方

1. 1 PR = 1責務の移動または1種類の文書更新に限定する。
2. 挙動変更とファイル移動を同じPRに混ぜない。
3. グローバル関数名・定数名の重複がないことを確認する。
4. Apps Script本番への `clasp push` / デプロイ / トリガー変更は別工程にする。
5. 本番Spotify・スプレッドシートへの書き込み処理は、整理PRの確認目的では実行しない。
6. `コード.js` は現時点で「入口として十分薄い」とみなし、過剰分割を避ける。

## 推奨する次の作業

`PodcastResolve.js` のApple Podcastsカタログ補完3関数を `PodcastApple.js` へ単純移動する。

この作業では関数名・検索条件・戻り値を変えず、Apps Script本番デプロイや外部サービスへの書き込みは行わない。
