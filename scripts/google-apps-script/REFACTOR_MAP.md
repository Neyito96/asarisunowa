# Google Apps Script 整理マップ

このファイルは、`scripts/google-apps-script/` の責務を整理し、今後の変更を小さな Pull Request 単位で安全に進めるための作業メモです。

## 現在の方針

- `コード.js` は Web アプリの入口 (`doGet` / `doPost`) とルーティングに限定する。
- 入力解析、検証、保存、API読み取り、Podcast URL解析、プレイリスト自動更新などは責務ごとのファイルへ分離する。
- 1 PR = 1責務を基本とし、整理と挙動変更を同じPRに混ぜない。
- GitHub上の整理と Apps Script 本番への `clasp push` / デプロイ / トリガー変更は別工程にする。
- 本番Spotify・スプレッドシートへの書き込み処理は、整理PRの確認目的では実行しない。
- 行数だけを理由に細分化せず、責務境界が明確な場合だけ分ける。

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
| `PlaylistAuto.js` | プレイリスト自動更新の入口・候補抽出・追加方式選択・更新日反映のオーケストレーション。 |
| `PlaylistAutoRules.js` | 自動更新ルール定義、Show ID展開、対象テキスト生成、キーワード判定。 |
| `PlaylistAutoEpisodes.js` | 自動更新対象エピソードのSpotify取得・ページング・重複排除。 |
| `PlaylistAutoSpotify.js` | 自動更新で使うSpotifyプレイリスト全件取得補助。 |
| `PlaylistAutoWrite.js` | Spotifyプレイリストへの個別追加・一括追加の書き込み補助。 |
| `PlaylistSpecial.js` | 個別プレイリスト用の互換入口。既存Apps Scriptトリガーが関数名を参照している可能性があるため保持。 |
| `PlaylistDates.js` | プレイリスト最終更新日の取得・書き込み。 |
| `Test.js` | 読み取り中心の手動診断。実行前に呼び出し先を確認する。 |
| `TestWriteDanger.js` | 本番データを書き換える可能性がある診断。明示承認なしに実行しない。 |

## 完了した主な分離

- PR #28: HTTP取得補助を `HttpFetch.js` へ分離。
- PR #30〜#39: `doPost` の入力、検証、重複判定、保存、アートワーク補完を責務別に分離。
- PR #40〜#42: `doGet` の callback検証、Podcast解析API、データ読み取り分岐を分離。
- PR #45: SpotifyユーザーOAuth関連を `SpotifyAuth.js` へ分離。
- PR #47: Apple Podcastsカタログ補完を `PodcastApple.js` へ分離。
- PR #48: Podcast解析の共通補助を `PodcastResolveCommon.js` へ分離。
- PR #50: `resolvePodcastUrl()` を `PodcastUrlResolve.js` へ分離。
- PR #51: `getAllSpotifyPlaylistItems_()` を `PlaylistAutoSpotify.js` へ分離。
- PR #53: `PlaylistSpecial.js` を既存トリガー互換入口として保持する方針を明文化。
- PR #54: 自動更新ルール定義・判定を `PlaylistAutoRules.js` へ分離。
- PR #55: 自動更新対象エピソード取得を `PlaylistAutoEpisodes.js` へ分離。
- PR #56: 個別追加処理を `PlaylistAutoWrite.js` へ分離。
- PR #57: 一括追加処理を `PlaylistAutoWrite.js` へ分離。

## 現在の評価

### `doPost`

十分に薄い。入力解析、入力長チェック、自動更新申請、基本検証、アートワーク補完、投稿種別・URL検証、保存処理の順に補助関数へ委譲している。

**方針:** これ以上細分化しない。

### `doGet`

十分に薄い。OAuth callback / OAuth取消、callback検証、status、resolve、各データ読み取り、未知typeエラーのルーティングを担当する。

**方針:** これ以上の細分化を優先しない。

### Podcast URL解析

Apple補完・共通補助・URL全体ルーター・Spotify episode解決の境界が明確になった。

**方針:** 一旦完成扱い。これ以上の細分化を優先しない。

### `Spotify.js`

Client Credentials、Spotify番組取得・解決、Spotify専用HTTP補助が残っているが、相互依存が強く1つの責務として自然にまとまっている。

**方針:** 一旦完成扱い。過剰分割しない。

### プレイリスト自動更新

PR #54〜#57により責務が以下へ分かれた。

- `PlaylistAutoRules.js`: ルール定義・判定
- `PlaylistAutoEpisodes.js`: エピソード取得
- `PlaylistAutoSpotify.js`: 既存プレイリスト項目取得
- `PlaylistAutoWrite.js`: Spotify書き込み
- `PlaylistAuto.js`: 同期オーケストレーション
- `PlaylistSpecial.js`: 互換入口
- `PlaylistDates.js`: 最終更新日

`PlaylistAuto.js` は現在、全件同期入口、playlistId指定入口、1ルール分の同期進行を担当しており、オーケストレーションとして自然なまとまりになっている。

**方針:** プレイリスト自動更新の構造整理は一旦完成扱い。これ以上は機能追加・不具合修正の必要が生じた時だけ見直す。

### `PlaylistSpecial.js`

`syncToyohidePlaylist()` と `syncIsshoShinbunPlaylist()` は `syncAutoPlaylistByPlaylistId_()` を呼ぶだけの薄い入口。

Apps Scriptのインストール済みトリガー設定はGitHubには保存されないため、実環境で参照されている可能性をGitHubだけでは否定できない。

**方針:** 実トリガー一覧を確認するまでは削除・改名しない。

## 残タスク

構造整理そのものはほぼ完了。残りは以下の安全確認を中心とする。

### 1. リポジトリ全体の最終棚卸し

- 同名トップレベル関数・定数の重複がないか。
- 旧ファイル名・旧責務を参照する文書やコメントが残っていないか。
- テスト関数が本番処理と混在していないか。
- 書き込み系テストが `TestWriteDanger.js` 以外へ残っていないか。

この棚卸しは原則として読み取り・検索だけで行い、問題が見つかった場合のみ個別PRにする。

### 2. 定数配置

`SPREADSHEET_ID`、シート名、投稿合言葉などを `Config.js` へまとめる案はあるが、現状で重大な保守上の問題はない。

**方針:** 優先度低。整理のためだけには実施しない。

### 3. 実トリガー棚卸し

`PlaylistSpecial.js` の互換入口を将来整理する場合のみ、Apps Script本番側でインストール済みトリガーの関数名を読み取り確認する。

**注意:** トリガー確認はGitHub整理とは別工程。明示依頼なしにトリガーの作成・削除・変更は行わない。

## 安全な進め方

1. 1 PR = 1責務の移動または1種類の文書更新に限定する。
2. 挙動変更とファイル移動を同じPRに混ぜない。
3. グローバル関数名・定数名の重複がないことを確認する。
4. Apps Script本番への `clasp push` / デプロイ / トリガー変更は別工程にする。
5. 本番Spotify・スプレッドシートへの書き込み処理は、整理PRの確認目的では実行しない。
6. `コード.js`、Podcast URL解析、`Spotify.js`、プレイリスト自動更新は現時点で十分整理されたとみなし、過剰分割を避ける。
7. `PlaylistSpecial.js` の入口関数は、実トリガー確認前に削除・改名しない。

## 推奨する次の作業

GitHub上で `scripts/google-apps-script/` 全体の最終棚卸しを行う。

目的は新たな分割ではなく、重複関数、古い参照、テスト混在、危険な書き込み系診断の取り残しがないかを確認し、問題がなければ今回の構造整理を完了扱いにすること。

この棚卸しでは、Apps Script本番、Spotify API、スプレッドシート、Script Properties、トリガーは操作しない。
