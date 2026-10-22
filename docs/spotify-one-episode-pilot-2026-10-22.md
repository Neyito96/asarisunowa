# 実Spotify1話試験 — 承認依頼 2026-10-22

**未実行。** 検索判定とURIの公開情報照合を完了し、書込対象を固定した。ユーザーの指示に従い、実書込前の承認待ち。承認とは別に、既存ユーザー認証でのAPI読取・実行経路が必要。WORKには認証済みSpotify工具がなく、Plugin ManagementでSpotifyを探索したが該当接続候補なし。認証設定/スコープ/リダイレクトを勝手に変更しない。

## 固定する対象

|項目|値|
|---|---|
|EP-ID|EP-00004|
|題名|（World Insight #5）停戦から1年、それでも終わらないガザ|
|番組|ニュースの現場から|
|GUID|af085854-b81e-4578-b871-b4d7005c0188|
|投稿URI|spotify:episode:6opJ4Ig4s7CTY9fRqGEHd2|
|追加先|リス田｜自動更新テスト|
|playlist ID|4FiVIwysKDtLqEXfkfhu2O|
|最大追加|1エピソード・POST1回（既存なら0回）|
|planHash|e147bc8ee91e390960baa3f74acb28b81f27c0c118777bd1d3af8ed4f441f2fe|

公開照合：公式RSSのGUID/題名/配信日時3651秒、Spotify embedの題名/番組show URI/配信時刻/3651.44秒が対応。両者の公開時刻は2026-10-06 19:00Z＝10/07 04:00 JST。台帳に既存Spotify個別URLがあり再検索なし。判定表では対象・通常・確認済み、同一GUID/音声/Spotify mappingの競合なし。

エピソード/プレイリストの公開embedを各1回GETしHTTP200、プレイリスト名とURIを確認。embed trackListは0だが、**認証付きの全件snapshotで空/既存なしが確定したことにはしない**。公開embedのplayableは投稿権限の確認でもない。

## 承認対象の操作

1. 最新判定EP-ID・元GUID/URIとplanHashを再確認。本番RSS/GAS/トリガーに触れない。
2. 既存ユーザー認証で `GET /playlists/{testId}?fields=id,snapshot_id`、`GET /playlists/{testId}/items?limit=50&offset=…&additional_types=episode` を全ページ取得し、前後snapshotを確認。対象以外のIDを指定しない。所有/共同編集・スコープを確認する。
3. `GET /episodes/{episodeId}?market=JP` で番組・題名・配信日・再生可能性を読取照合。日付は公開時刻がUTC6日/JST7日である点に注意し、APIのday precisionが不一致ならHOLDし勝手に承認範囲を変えない。
4. 既存ならPOST0として記録。なければ既存executorの永続予約・ロック・最大1・planHash承認で `POST /playlists/{testId}/items` を1回だけ実施。
5. 新しい全件snapshotで当該URIの存在を確認しADDEDを記録。再実行しPOST0を確認。実POSTの2xxだけでは成功にしない。
6. 401/403/429/不完全ページ/不明item/通信断/読戻し失敗/競合は停止または保留。再送して結果を推測しない。401/403の無秘密request証拠を保存し、根因を確定できなければ未確定とする。

承認書込範囲はこのテストplaylist内の1URIだけ。既存本番playlist、台帳URLセル、OAuth、GAS配備/trigger、メール、公開JSON/Pages、PR mergeは含めない。新規playlist作成も含めない。

## 復旧と未解決

書込前snapshot/URI集合/予約receiptを保存。異常時は停止して予約を保全し、結果不明のPOSTを再送しない。追加済み1URIの削除は実行前に別承認を求め、playlist全体の置換や他の人の編集を巻き戻さない。

認証付き権限とAPI応答の実測は未完了。403は今回再現しておらず、旧403の対象method/endpoint/token種別/scope/所有関係が不明なため個別原因は確定していない。公開ページ200で403解消と判定しない。実RSS収蔵も、公式8本の取得成功とGAS定期実行を区別し、最新実機ログはHOLD。前回のA/B/C承認は今回のSpotify投稿承認へ流用しない。

台帳/公式RSSを使った判定6,591行の反映証拠は既存PR250の `docs/search-scope-2026-10-22.md`。実行用planと無秘密の根拠は `docs/audits/2026-10-22-spotify-pilot/`。既存49ローカル/4 CIの試験証拠を再利用し、今回本番成功を主張しない。
