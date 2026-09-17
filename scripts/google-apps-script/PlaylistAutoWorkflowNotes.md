# 自動更新プレイリスト workflow

このメモはコードの運用境界を明示するためのものです。

1. `requested` — 申請受付。Spotifyアクセスなし、本番書き込み不可。
2. `bootstrap` — 初回構築。7番組をshowごとのチェックポイントで段階取得する。429では保存して停止。
3. `review` — 初回候補を人が確認する。本番有効化前の必須段階。
4. `incremental` — 各showの前回境界までを取得し、新着だけ判定する。
5. `paused` — 停止。

## 判定方式

- `title-text`: 指定文字列を `episode.name` だけから検索する。
- `speaker`: `name`, `description`, `html_description` を対象にする。必要に応じて専用 `matchStrategy` を使う。

## 安全原則

- 取得範囲（bootstrap/incremental）と、エピソードの採否判定（ruleType/matchStrategy）を分離する。
- 新規申請は `enabled:false` / `productionWriteAllowed:false` から開始する。
- bootstrap と review を完了するまで本番自動更新を有効化しない。
- 429では再試行ループをせず、状態とcooldownを保存して停止する。
- 1回の取得は原則1ページ。showごとに境界を保持する。
- Spotifyプレイリストへの本番書き込みは別工程で明示的に有効化する。

## 「今あるリストを育てる」v1

- 申請直後は `招待承認待ち`。フォーム送信だけではSpotifyへ書き込まない。
- 運用アカウントが共同編集招待を承認すると、`runAutoUpdateAutomationV1` が編集可能状態を検知する。
- シリーズ型・出演者型は、承認時点の各Show先頭エピソードを境界として保存し、`増分自動更新` へ移る。
- 過去回は自動で遡及追加しない。承認後に公開された新着差分だけを追加する。
- テーマ型、候補11件以上、境界消失、Spotify追加の一部失敗は `確認待ち` にする。
- Spotifyで取得不能または再生不能のエピソードは追加対象から除外する。
- 正常追加後だけ作業台の最終更新日を更新する。
- 招待承認を確認したら、共同編集者招待URLは申請シートから消去する。

時間主導トリガーは `runAutoUpdateAutomationV1` を1時間ごとに設定する。トリガーの追加・変更は、本番反映と分けて承認を得て実施する。
