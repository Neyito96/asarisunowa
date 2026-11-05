# Phase24 ポリレビ｜既存所属照合ゲート（2026-11-05）

## ここまでの実測
- 本番エピソード台帳6,671件を読み取り済（A:DおよびL列）。
- タイトル「ポリレビ」17件。音声版「ニュースの現場から」15件のSpotify URL形式正常・EP-ID重複0。
- 朝ポキTV 2件は別媒体でSpotify個別URLなし。候補から除外。
- 候補manifest: `phase24-polirebi-readonly-candidates-20261105.json`。実再生・Spotify membership未確認。
- 2026-10-17記録 Issue #227 に、過去のポリレビ #15 が自動追加されたユーザーGASログの言及あり。現在の所属件数を意味しない。

## Spotify公式の2026年仕様
- GET `/v1/playlists/{id}/items` のlimit最大50。現在の旧 `PlaylistAutoSpotify.js` はlimit=100を指定している。現行仕様と不整合。過去の404の直接原因とは未確定。
- Spotifyによるとプレイリスト項目取得は現在の認証ユーザーが所有者または共同編集者である場合だけ可能。非該当時403。
- 参考：https://developer.spotify.com/documentation/web-api/reference/get-playlists-items
- 2026年移行案内：https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide

## 今回の追加実装
`P24PolirebiMembershipReadOnly20261105.gs`：
- `P24_POLIREBI_MEMBERSHIP_READ_ONLY()`: 既存GAS OAuthトークンを再利用。蔵から15件抽出し、Spotify**対象プレイリストの項目だけ**を最大50件／頁で取得。
- `P24_FETCH_SPOTIFY_PLAYLIST_ITEMS_READ_ONLY_`: Spotifyのページ繰返し・件数不一致・異常URL・403/404/429で停止。結果0件に化けさせない。
- `P24_POLIREBI_COMPARE_`: Spotify episode IDで `present / missing / held / uncertain` に分類。playlistの不明なアイテムがあれば `safeToSuggestAdds=false`。Spotifyへの追加はコード上存在しない。
- `P24_POLIREBI_COMPARE_SELF_TEST()`: 純粋関数によるテスト（登録済1＋未登録1／不明アイテムHOLD）。

## 運用
GitHubにコミットしたコードは**オンラインGAS未配備・未実行**。GitHubのみでOAuthトークンは使えない。既存Spotifyプレイリストの現況がまだ読めないため、現時点の追加数は0／差分は不明。
実機実行時は `P24_LIBRARY_PLAYLIST_SELF_TEST` → `P24_POLIREBI_COMPARE_SELF_TEST` → `P24_POLIREBI_MEMBERSHIP_READ_ONLY` の順。実行前にコード差分と認証ユーザーのプレイリスト権限を確認。403なら権限・所有関係を検証、404ならプレイリストID/アクセスを点検、429なら待機して停止。401時は認証の更新、以外も自動リトライ連鎖なし。
次工程は membership実測ログを取得→既存からの差分manifest→手動除外確認→追加を別承認。既存プレイリストが他者所有で403の場合は、取得できたふりをせず、管理者がエクスポートした所属ID一覧との比較か、適法な共同編集権限の確認を行う。

## 保護
本番台帳、GASトリガー、既存同期、公開サイト、Spotifyプレイリストは未変更。既存旧ヘルパー `getAllSpotifyPlaylistItems_` も修正しない。
