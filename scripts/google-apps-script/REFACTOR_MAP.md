# Google Apps Script 整理マップ

このファイルは、`scripts/google-apps-script/` の責務を整理し、今後の分割を小さな Pull Request 単位で進めるための作業メモです。

## 現在の役割

| ファイル | 主な役割 |
| --- | --- |
| `コード.js` | Web アプリの入口 (`doGet` / `doPost`) と投稿受付。現在は `fetchJson` / `fetchText` も残る。 |
| `ApiCommon.js` | URL・タイトル正規化、JSON / JSONP レスポンス生成。 |
| `SheetData.js` | シート読取、重複判定、シート名のゆるい取得。 |
| `PodcastResolve.js` | Podcast URL解析、番組情報・アートワーク・配信元判定。 |
| `PodcastPlatformSync.js` | 朝リスPodcastの配信先URL補完。シートへの書き込みを伴う。 |
| `Spotify.js` | Spotify OAuth / API / Podcast解決。 |
| `PlaylistAuto.js` | 共通ルールによるSpotifyプレイリスト自動更新。 |
| `PlaylistSpecial.js` | 共通ルールに収まらない特殊更新。 |
| `PlaylistDates.js` | プレイリスト最終更新日の取得・書き込み。 |
| `Test.js` | 読み取り中心の手動診断。実行前に呼び出し先を確認する。 |
| `TestWriteDanger.js` | 本番データを書き換える可能性がある診断。明示承認なしに実行しない。 |

## 次に分ける候補

### 1. HTTP取得補助

`コード.js` に残る以下を `ApiCommon.js` または新しい `HttpCommon.js` へ移す候補とする。

- `fetchJson`
- `fetchText`

移動時は処理内容を変更せず、関数名も変更しない。GASは複数ファイルでグローバル名前空間を共有するため、移動だけなら既存呼び出し側の変更は不要。

### 2. 投稿入力検証

`コード.js` の `validatePostInputLengths_` と投稿種別ごとの入力検証は、将来的に `PostValidation.js` へ分離する候補。ただし `doPost` のAPI契約と密接なので、HTTP取得補助の移動後に別PRで扱う。

### 3. `doPost` 本体

現時点では分割しない。自動更新申請、プレイリスト、Podcast、朝リスPodcastの受付が同居しているため、まずテスト可能な補助処理を外へ出してから小さく分ける。

## 安全な進め方

1. 1 PR = 1責務の移動に限定する。
2. 最初のPRでは挙動・定数値・関数名を変更しない。
3. GitHub上の整理と `clasp push` / デプロイ / トリガー変更を別工程にする。
4. 本番Spotify・スプレッドシートへの書き込み処理は、整理PRの確認目的では実行しない。
5. 各PRでグローバル関数名・定数名の重複がないことを確認する。

## 推奨する次のPR

`コード.js` の `fetchJson` / `fetchText` を共通HTTP補助ファイルへ移す。

この変更は、関数本体をそのまま移動するだけにして、APIレスポンス、Spotify、シート、トリガー、デプロイには触れない。
