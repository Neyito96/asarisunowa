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
| `PodcastResolve.js` | Spotify episode URLを番組へ解決する処理。 |
| `PodcastApple.js` | Apple Podcasts / iTunes Searchによる番組メタデータ補完。 |
| `PodcastResolveCommon.js` | Podcast URL正規化、HTMLメタ抽出、タイトル・配信者整形、配信元判定。 |
| `PodcastUrlResolve.js` | Spotify / Apple Podcasts / YouTube / LISTEN / stand.fm等を横断するPodcast URL解決ルーター。 |
| `PodcastResolveHandler.js` | `doGet` の `type=resolve` API処理。 |
| `PodcastPlatformSync.js` | 朝リスPodcastの配信先URL補完。シートへの書き込みを伴う。 |
| `SpotifyAuth.js` | SpotifyユーザーOAuth、認証callback、ユーザーアクセストークン取得。 |
| `Spotify.js` | Client Credentials、Spotify番組取得・解決、Spotify専用HTTP補助。 |
| `PlaylistAuto.js` | 共通ルールによるSpotifyプレイリスト自動更新。 |
| `PlaylistAutoSpotify.js` | 自動更新で使うSpotifyプレイリスト全件取得補助。 |
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
- PR #47: Apple Podcastsカタログ補完3関数を `PodcastApple.js` へ分離。
- PR #48: Podcast解析の共通補助7関数を `PodcastResolveCommon.js` へ分離。
- PR #50: `resolvePodcastUrl()` を `PodcastUrlResolve.js` へ分離。
- PR #51: `getAllSpotifyPlaylistItems_()` を `PlaylistAutoSpotify.js` へ分離。

## 現在の評価

### `doPost`

現時点で十分に薄い。入力解析、入力長チェック、自動更新申請、基本検証、アートワーク補完、投稿種別・URL検証、保存処理の順に補助関数へ委譲している。

**方針:** 当面はこれ以上細分化しない。

### `doGet`

現時点で十分に薄い。OAuth callback / OAuth取消、callback検証、status、resolve、各データ読み取り、未知typeエラーのルーティングを担当する。

**方針:** `status` や `type` 読み取りだけをさらに別ファイルへ移すような細分化は優先しない。

### Podcast URL解析

PR #47・#48・#50により、Apple補完・共通補助・URL全体ルーター・Spotify episode解決の境界が明確になった。

**方針:** Podcast URL解析側は一旦完成扱いとし、これ以上の細分化を優先しない。

### `Spotify.js`

PR #45・#50・#51後、残る主な責務は以下。

- `getSpotifyAccessToken()`：Client Credentials用アクセストークン取得。
- `fetchSpotifyShowFromWebApi()`：Spotify Web APIから番組情報取得。
- `resolveSpotifyShow()`：Spotify show URLから番組情報解決。
- `fetchSpotifyJson()` / `fetchSpotifyText()`：Spotify公開情報取得用補助。

これらはSpotify番組解決のために相互依存が強く、現時点では1つの責務として自然にまとまっている。

**方針:** Spotify整理はここで一旦完了扱い。HTTP補助だけをさらに分けるような細分化は優先しない。

## 次に確認する候補

### 1. `PlaylistSpecial.js` の役割とトリガー互換

現在は以下2関数だけの薄い入口。

- `syncToyohidePlaylist()`
- `syncIsshoShinbunPlaylist()`

どちらも `syncAutoPlaylistByPlaylistId_()` を呼ぶだけだが、Apps Scriptの既存トリガーがこれらの関数名を参照している可能性がある。

**次の確認方針:**
- まずGitHub上で呼び出し元・関数名参照を調査する。
- トリガー互換の可能性があるため、確認なしに削除・改名しない。
- 実トリガー確認が必要な場合は、GitHub整理とは別工程として扱う。

### 2. `PlaylistAuto.js` の内部責務

ルール定義、候補取得、マッチング、追加、最終更新日反映を1ファイルで持つが、現時点で機能的なまとまりは保たれている。

**方針:** 行数だけを理由に分割しない。次に分けるなら、明確な責務境界が確認できた場合のみ。

### 3. 定数配置

`SPREADSHEET_ID`、シート名、投稿合言葉などを `Config.js` へまとめる案はあるが、効果は限定的。優先度は低い。

## 安全な進め方

1. 1 PR = 1責務の移動または1種類の文書更新に限定する。
2. 挙動変更とファイル移動を同じPRに混ぜない。
3. グローバル関数名・定数名の重複がないことを確認する。
4. Apps Script本番への `clasp push` / デプロイ / トリガー変更は別工程にする。
5. 本番Spotify・スプレッドシートへの書き込み処理は、整理PRの確認目的では実行しない。
6. `コード.js`、Podcast URL解析、`Spotify.js` は現時点で十分整理されたとみなし、過剰分割を避ける。

## 推奨する次の作業

`PlaylistSpecial.js` の2つの入口関数がGitHub上のどこから参照されているかを調査し、既存トリガー互換のために残すべき薄いラッパーかを判断する。

この調査では関数削除・改名・トリガー変更・Apps Script本番操作は行わない。
