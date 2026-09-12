# 朝リスの輪 Google Apps Script

## 正本と旧版

このディレクトリ (`scripts/google-apps-script/`) を、現在の本番 Google Apps Script (GAS) のソースコードの正本として扱います。

リポジトリ直下の `scripts/google-apps-script-playlist-submit.gs` は旧版のスナップショットです。原則として編集せず、修正が必要な場合は、まず本ディレクトリの本番コードとの差分と用途を確認してください。

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `コード.js` | Web アプリの入口である `doGet` / `doPost`、スプレッドシートの読み書き、API レスポンス、Podcast 情報の補助処理、プレイリスト更新日処理、および一部の運用・診断処理を含むメインコードです。 |
| `Spotify.js` | Spotify のユーザー OAuth、アクセストークン更新、Spotify Web API、プレイリスト項目取得、および Spotify を含む Podcast URL の情報解決を担当します。 |
| `PlaylistAuto.js` | 番組、対象プレイリスト、キーワードのルールに基づく Spotify プレイリストの自動更新を担当します。 |
| `PlaylistSpecial.js` | 複数番組を横断する出演者検索など、共通ルールに収まらない特殊な Spotify プレイリスト更新を担当します。 |
| `Test.js` | Spotify の取得結果やプレイリスト差分をログで確認する手動診断コードです。本番 API を参照するため、一般的なオフライン単体テストとは異なります。 |
| `appsscript.json` | タイムゾーン、V8 ランタイム、例外ログ、Web アプリの実行主体・公開範囲などを定義する GAS マニフェストです。 |

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

`syncAllAutoPlaylists`、`syncToyohidePlaylist`、`updatePlaylistLatestDates` などを定期実行している場合は、Apps Script 管理画面で関数名、頻度、実行アカウント、失敗通知を確認してください。トリガーを追加・削除・変更するときは、本番運用への影響を確認し、その構成を本READMEまたは運用資料にも記録します。

## 安全な確認方法

- 通常は静的解析、差分確認、構文確認、読み取り専用の診断を優先します。
- 本番 Spotify プレイリスト、本番スプレッドシート、Script Properties、デプロイ、トリガーを変更する操作は、管理者の明示的な承認を得てから実行します。
- `Test.js` や `test` という名前だけで安全とは判断しません。関数内の API メソッドとシート操作を確認し、書き込みがないことを確認してから実行します。