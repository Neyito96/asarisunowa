# 報談RSS差分照合｜手動検証手順（READ_ONLY）

## 事前確認
- 対象は図書館の**テストコピー**に紐づくApps Script。元の共同編集シートは編集しない。
- GitHub PR #225の `OfficialRssDeltaPreview.js` と `OfficialRssLibraryPreview.js` の両方をテスト用GASに追加する。
- 既存のトリガー・Spotifyの自動育成・公開処理は変更しない。
- `取得元一覧` の「報談」H列は `https://feeds.megaphone.fm/TASC9421488254` のはず。事前に確認する。
- `エピソード台帳` は B=番組名、C=タイトル、D=配信日時、G=外部ID、I=元ページURL、O=音声URL（**O列が音声URLかは現物で必ず再確認**）、AM=人間除外、という想定。列定義が異なれば実行せずコードを修正する。

## 実行
1. テスト用スプレッドシートで「拡張機能 → Apps Script」を開く。
2. PRの2ファイルを追加し、`runHoudanRssPreview` を選択して実行する。初回のみ必要な権限を確認する。
3. 実行ログの `mode: READ_ONLY`、`show: 報談`、`inspected`、`counts` を控える。
4. `new` / `ambiguous` / `excluded` の各候補のタイトル・日付・GUID・URLを目視確認する。
5. 元台帳、トリガー、Spotifyプレイリスト、公開サイトに変化がないことを確認する。

## 合格条件
- HTTP 200のRSSを取得し、件数の合計が `inspected` に一致する。
- Omny→MegaphoneでIDが変わった既存回が無条件で `new` に分類されない。
- 人間除外済みの回は `excluded` または `ambiguous` として保留される。
- シートへの書き込みがゼロ。Spotify呼び出し・トリガー作成もゼロ。

## 未検証・注意
- **GASでの実RSS実行は未実施。** ログ・件数を推測しない。
- 同じタイトルと日付でも別回の可能性があるので `ambiguous` は人間確認。
- 現行プレビューは限定的な照合であり、自動登録や自動Spotify書き込みにはまだ使わない。
- 除外履歴は別シート `削除・除外履歴` にもある。自動保存を設計する際はこの履歴も必ず照合する。
