# 朝リスの輪 Google Apps Script

## 正本と旧版

このディレクトリ (`scripts/google-apps-script/`) を、現在の本番 Google Apps Script (GAS) のソースコードの正本として扱います。

リポジトリ直下の `scripts/google-apps-script-playlist-submit.gs` は旧版のスナップショットです。原則として編集せず、修正が必要な場合は、まず本ディレクトリの本番コードとの差分と用途を確認してください。

## ファイル構成

### Web API・投稿処理

| ファイル | 役割 |
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

### Podcast・Spotify

| ファイル | 役割 |
| --- | --- |
| `PodcastResolve.js` | Spotify episode URLを番組へ解決する処理。 |
| `PodcastApple.js` | Apple Podcasts / iTunes Searchによる番組メタデータ補完。 |
| `PodcastResolveCommon.js` | Podcast URL正規化、HTMLメタ抽出、タイトル・配信者整形、配信元判定。 |
| `PodcastUrlResolve.js` | Spotify / Apple Podcasts / YouTube / LISTEN / stand.fm等を横断するPodcast URL解決ルーター。 |
| `PodcastResolveHandler.js` | `doGet` の `type=resolve` API処理。 |
| `PodcastPlatformSync.js` | 朝リスPodcastの配信先URL補完。シートへの書き込みを伴う。 |
| `SpotifyAuth.js` | SpotifyユーザーOAuth、認証callback、ユーザーアクセストークン取得。 |
| `Spotify.js` | Client Credentials、Spotify番組取得・解決、Spotify専用HTTP補助。 |

### プレイリスト自動更新

| ファイル | 役割 |
| --- | --- |
| `PlaylistAuto.js` | 自動更新の入口・候補抽出・追加方式選択・更新日反映のオーケストレーション。 |
| `PlaylistAutoRules.js` | 自動更新ルール定義、Show ID展開、対象テキスト生成、キーワード判定。 |
| `PlaylistAutoEpisodes.js` | 自動更新対象エピソードのSpotify取得・ページング・重複排除。 |
| `PlaylistAutoSpotify.js` | 自動更新で使うSpotifyプレイリスト全件取得補助。 |
| `PlaylistAutoWrite.js` | Spotifyプレイリストへの個別追加・一括追加の書き込み補助。 |
| `PlaylistSpecial.js` | 個別プレイリスト用の互換入口。既存トリガーが関数名を参照している可能性があるため保持。 |
| `PlaylistDates.js` | プレイリスト最終更新日の取得・書き込み。 |

### 診断・設定

| ファイル | 役割 |
| --- | --- |
| `Test.js` | 読み取り中心の手動診断。実行前に呼び出し先を確認する。 |
| `TestWriteDanger.js` | 本番データを書き換える可能性がある診断。明示承認なしに実行しない。 |
| `appsscript.json` | タイムゾーン、V8ランタイム、例外ログ、Webアプリ設定などを定義するGASマニフェスト。 |
| `REFACTOR_MAP.md` | 現在の責務分担と整理方針、残タスクを記録する作業メモ。 |
| `AGENTS.md` | GitHub/GAS作業時の安全ルールと運用ルール。 |

## Web サイトと Apps Script の関係

GitHub Pages 上の Web サイトは、デプロイ済み GAS Web アプリを API として使用します。

- GET / JSONP: プレイリスト、朝リス Podcast、おすすめ Podcast の一覧取得、および Podcast URL の情報解決
- POST: プレイリスト、Podcast、自動更新申請の受付
- GAS: Google スプレッドシートの読み書き、外部サービスからの情報取得、Spotify OAuth とプレイリスト更新

GitHub への変更だけでは、デプロイ済み GAS Web アプリは更新されません。GAS への反映とWebアプリのバージョン更新・再デプロイは、GitHub のレビューとは別の運用工程として扱います。

## clasp による同期方針

`clasp` 3.4.1 は導入済みです。GitHub 上の本ディレクトリをコードの正本とし、次の流れを基本とします。

1. 通常の開発はGitHub上の正本を基準に行う。Apps Scriptオンラインエディタで直接変更した可能性がある場合は、作業開始前にローカルの未コミット変更を確認したうえで `clasp pull` し、GitHubとの差分を確認する。
2. GitHub 上で変更し、Pull Request でレビューする。
3. `clasp push` の前に、反映される差分を提示して管理者の明示的な承認を得る。
4. レビュー・承認済みのコードだけを、管理者が `clasp push` する。
5. `clasp push --force` は通常使用せず、必要性と上書き対象を確認したうえで個別に明示的な承認を得る。
6. Apps Script 側で必要なバージョン作成とWebアプリの再デプロイを行う。
7. 読み取り専用の疎通確認後、必要な場合に限って承認済みの書き込み確認を行う。

Apps Script オンラインエディタで直接変更した場合は、その内容を速やかに `clasp pull` してGitHubへ戻し、二つの正本を作らないようにします。`clasp pull` の前にはローカルの未コミット変更を確認し、意図しない上書きを防ぎます。`.clasp.json` の Script ID と認証ファイルは公開範囲を確認して管理し、OAuth認証ファイルやトークンをGitへコミットしてはいけません。

## Script Properties で管理する情報

秘密情報や環境ごとに異なる値はソースへ直接記載せず、Apps Script の Script Properties で管理します。現在のコードが参照する主な秘密情報は次のとおりです。

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_USER_REFRESH_TOKEN`
- OAuth の一時的な state や、今後追加する署名・認証用秘密値

アクセストークン、リフレッシュトークン、OAuth 認可コード、Spotify 共同編集者招待 URL、認証ファイル、その他の資格情報をGitHubへ保存しないでください。実際の値をドキュメント、ログ、テストデータ、Issue、Pull Request本文へ転載することも禁止します。

## 時間トリガー

時間主導トリガーなどのインストール済みトリガーは Apps Script プロジェクト側で管理され、現在のGitHubソースと `appsscript.json` だけからは完全に再現できません。

`syncAllAutoPlaylists`、`syncToyohidePlaylist`、`syncIsshoShinbunPlaylist`、`updatePlaylistLatestDates` などを定期実行している場合は、Apps Script 管理画面で関数名、頻度、実行アカウント、失敗通知を確認してください。トリガーを追加・削除・変更するときは、本番運用への影響を確認し、その構成を本READMEまたは運用資料にも記録します。

`PlaylistSpecial.js` の互換入口は、実トリガー一覧を確認するまでは削除・改名しません。

## 安全な確認方法

- 通常は静的解析、差分確認、構文確認、読み取り専用の診断を優先します。
- 本番 Spotify プレイリスト、本番スプレッドシート、Script Properties、デプロイ、トリガーを変更する操作は、管理者の明示的な承認を得てから実行します。
- `Test.js` や `test` という名前だけで安全とは判断しません。関数内の API メソッドとシート操作を確認し、書き込みがないことを確認してから実行します。
- `TestWriteDanger.js` の関数は書き込みを伴う可能性があるため、明示承認なしに実行しません。

## 現在の整理状態

2026-09時点で、`コード.js`、Podcast URL解析、Spotify認証・番組解決、プレイリスト自動更新は責務ごとに分離済みです。行数を減らすこと自体を目的にした細分化はここで止め、今後は機能追加や不具合修正で明確な責務境界が必要になった場合だけ再分割します。

詳細な整理履歴と残タスクは `REFACTOR_MAP.md` を参照してください。
