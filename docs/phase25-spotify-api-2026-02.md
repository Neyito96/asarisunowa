# Spotify Web API 2026-02 移行(Development Mode)とPhase25(2026-11-09)

出典: Spotify 公式「February 2026 migration guide」。
- バッチ取得 `GET /episodes?ids=…`(ほか `/tracks` `/albums` `/artists` `/shows` `/audiobooks` `/chapters`)は廃止。単体取得 `GET /episodes/{id}` を使う。
- `/playlists/{id}/tracks` は `/items` に改名(Phase25 は `/items` を使用済み)。`POST /users/{id}/playlists` は `POST /me/playlists`(Phase25 は `/me/playlists` を使用済み)。
- Development Mode: アプリ所有者の Premium が必要。プレイリストの `items` は、所有者または共同編集者のプレイリストだけ返る。
- 2026-11-09 の COPY 試験: EP-06678 の照合が 401(再認証前)→ 403(再認証後)。原因は廃止された一括取得への依存。

## 修正(COPY のみ・本ブランチ)
`P25CopyAdapter.js` の `verifyEpisodes` を 1 件ずつの `GET /episodes/{id}?market=JP` に変更。
| 応答 | 分類 |
| --- | --- |
| 200 かつ `is_playable` が false でない | ok |
| 200 かつ `is_playable:false` | unplayable |
| 404 | missing |
| 400、返った ID が違う、ID 形式が不正、台帳側の問題 | notVerifiable |
| 401 / 403 / 429 / 5xx / 予算超過 / 通信失敗 | **全体を停止**。残りは notVerifiable、`stopped.reason` に理由(`SPOTIFY_AUTH_REQUIRED` `SPOTIFY_FORBIDDEN` `SPOTIFY_RATE_LIMITED`+`retryAfterSeconds` `SPOTIFY_SERVER_ERROR` `API_BUDGET_EXHAUSTED`)。再試行しない |
- 予算: `config.apiBudget`(既定50)。1 エピソード = 1 呼び出し。結果に `apiUsage` を返す。
- 書き込みは一切ない(GET のみ)。

## 本番側の調査(修正・反映はしていない。別判断)
廃止 API への依存は次の2か所です。
1. `P25SpotifyTarget.js` の `p25SpotifyVerifyEpisodes_`(`P25_VERIFY_EPISODE_IDS` が使用)。一括取得のため、本番で実行すると 403 になる。**読み取り専用だが、P25 の ID 照合が動かない。**
2. `AutoUpdateAutomationV1.js` 約1201行(旧方式の新着取得で `episodes?ids=` を使用)。応答が 200 でないと `continue` で**黙って飛ばす**ため、一括取得が 403 の間は旧方式で候補が静かに 0 件になる可能性がある(誤追加ではなく、取りこぼし)。
- それ以外の Spotify 呼び出し(`/episodes/{id}`、`/shows/{id}/episodes`、`/playlists/{id}/items`、`/me/playlists`、`/search`)に廃止 API はない。`/search` は `limit` 上限が 10 になった点だけ要確認(上限 50 で呼ぶ箇所があれば 400)。
- 本番のプレイリスト読み取りは、所有者・共同編集者でないプレイリストでは `items` が返らない仕様にも注意(管理アカウントが所有するものだけが対象)。
