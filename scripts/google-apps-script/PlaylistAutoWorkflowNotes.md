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
