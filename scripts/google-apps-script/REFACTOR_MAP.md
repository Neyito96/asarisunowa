# Google Apps Script 整理マップ

このファイルは、`scripts/google-apps-script/` の責務を整理し、今後の分割を小さな Pull Request 単位で進めるための作業メモです。

## 現在の役割

| ファイル | 主な役割 |
| --- | --- |
| `コード.js` | Web アプリの入口 (`doGet` / `doPost`)、投稿受付、投稿入力長チェック。 |
| `ApiCommon.js` | URL・タイトル正規化、JSON / JSONP レスポンス生成。 |
| `HttpFetch.js` | `fetchJson` / `fetchText` による共通HTTP取得補助。 |
| `SheetData.js` | シート読取、重複判定、シート名のゆるい取得。 |
| `PodcastResolve.js` | Podcast URL解析、番組情報・アートワーク・配信元判定。 |
| `PodcastPlatformSync.js` | 朝リスPodcastの配信先URL補完。シートへの書き込みを伴う。 |
| `Spotify.js` | Spotify OAuth / API / Podcast解決。 |
| `PlaylistAuto.js` | 共通ルールによるSpotifyプレイリスト自動更新。 |
| `PlaylistSpecial.js` | 共通ルールに収まらない特殊更新。 |
| `PlaylistDates.js` | プレイリスト最終更新日の取得・書き込み。 |
| `Test.js` | 読み取り中心の手動診断。実行前に呼び出し先を確認する。 |
| `TestWriteDanger.js` | 本番データを書き換える可能性がある診断。明示承認なしに実行しない。 |

## 完了した分離

### HTTP取得補助

PR #28で、`コード.js` にあった以下の関数を `HttpFetch.js` へ移動済み。

- `fetchJson`
- `fetchText`

関数名・処理内容・戻り値は変更していない。

## 次に分ける候補

### 1. 投稿入力長チェック

`コード.js` の `validatePostInputLengths_` を `PostValidation.js` へ移す候補とする。

最初のPRでは以下を守る。

- 関数名を変えない
- `limits` の値を変えない
- `labels` の文言を変えない
- 戻り値を変えない
- `doPost` 側の呼び出し方を変えない

GASは複数ファイルでグローバル名前空間を共有するため、関数本体だけの移動なら呼び出し側の変更は不要。

### 2. 投稿種別ごとの検証

URL形式や投稿種別の検証も将来的な分離候補。ただしAPI契約に関わるため、`validatePostInputLengths_` の単純移動とは別PRにする。

### 3. `doPost` 本体

現時点では分割しない。自動更新申請、プレイリスト、Podcast、朝リスPodcastの受付が同居しているため、補助処理を外へ出してから小さく分ける。

### 4. `doGet` 本体

現時点では分割しない。status / resolve / playlist / podcast / listenerPodcast の既存API契約を維持する。

## 安全な進め方

1. 1 PR = 1責務の移動に限定する。
2. 挙動変更とファイル移動を同じPRに混ぜない。
3. GitHub上の整理と `clasp push` / デプロイ / トリガー変更を別工程にする。
4. 本番Spotify・スプレッドシートへの書き込み処理は、整理PRの確認目的では実行しない。
5. 各PRでグローバル関数名・定数名の重複がないことを確認する。

## 推奨する次のPR

`コード.js` の `validatePostInputLengths_` を `PostValidation.js` へ移す。

この変更では、関数本体をそのまま移動するだけにして、APIレスポンス、Spotify、シート、トリガー、デプロイには触れない。
