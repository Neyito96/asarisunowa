# Phase25 COPY準備・認可待ち記録

Issue #271 COPYゲートに従った作業。2026-11-07 JST（UTC 11-06）。本番変更なし。EP-00028 HOLD維持。

## 実際に作成・確認した資産

|対象|ID|確認した状態|
|---|---|---|
|独立COPY GAS|16qdHt_nojvKK4Qzcww4C7jkg6frpLiYIHXn4CG-_UtILn4qKlmoixT9R|新規作成、名称変更、コード保存、関数選択肢を確認|
|COPY受付・状態シート|1lbfEq3Tdj6QaLGJOWZfez-xNkQ5yRHRILqmP1nLJtQw|新規作成。P25_STATE A1:D1はkey/version/part/json、受付タブは9列。ヘッダー読戻し確認。データ行なし|
|新規Spotify試験プレイリスト|1N0T7tMxPMKxXy77C0RPMw|朝リス Phase25 COPY試験 2026-11-07、NEYITO所有、非公開、空の画面を確認。エピソード追加0|

GASには既存P25LibraryPipeline.js、P25CopyAdapter.jsと今回のP25CopySession20261107.js、P25CopyOwnership.jsを連結してコード.gsへ保存した。既存本番プロジェクトは編集していない。トリガー作成・削除なし。

## 実機試験の状況

P25_COPY_PREFLIGHT_20261107を実行操作したが、初回OAuthの「このアプリは Google で確認されていません」で停止。認可も事前検査成功も未確認。受付→蔵検索→Spotify差分のREAD_ONLY通し試験は未実施。実機PASSではない。

セッション設定はwrite:false、legacyWriterDisabled:false。プレイリストallowlistと公式RSSは未設定のまま保存されており、READ_ONLY入口はCOPY_SETUP_INCOMPLETEで停止する設計。試験playlist作成後のID設定、合成受付1行、公式RSS検証、COPY専用短期Spotifyトークンが次工程。ブラウザのSpotifyログインはAPI認可の代替ではない。本番トークンは転用していない。

Google認可はアカウント情報への新規アクセスを伴うため管理者の操作・判断が必要。トークンをチャットやGitHubへ貼らない。

## モック試験（実機と区別）

`node --test tests/gas-*.test.mjs`: 38 PASS / 0 FAIL。

既存35件に所有権テスト3件を追加。日次・毎時・個別3経路（加えてtheme/manual）について所有者不一致、PAUSED、再入BUSY、世代変更、ロックスコープ外writer、例外時解放を検証。自己検査は30確認・模擬書込8回で外部I/Oなし。51/101件のSpotifyページ取得・重複防止など既存テストも合格。

共通dispatcherはCOPY用の設計実験。旧本番関数への組込みなし。注入lock/storeを使うモックであり全実更新経路の排他を証明していない。ScriptLockは別GASを跨がない。

実GAS用P25_COPY_LOCK_HOLDER_20261107とCONTENDERを用意。認可後、独立した2実行でholderを10秒保持しcontenderを重ねる。ACQUIRED時刻区間が重ならないこと、または競合側が拒否されることを実行ログで確認する。未実行。Spotifyやトリガーを変更しない。

## 次のゲートと復旧

1. COPY GASの認可内容を管理者が確認する。
2. 上記新規playlistのみallowlistへ設定。公式RSSを確認し、個人情報を含まない合成受付をCOPYへ配置。別途COPY用Spotify認可を準備。
3. write:falseで候補EP-ID/GUID/Spotify ID、既登録・人的除外・HOLDを確認。二度実行し差分を照合。
4. 最大1件追加は対象3識別子と事前snapshot/登録内容を示して別承認を求める。現時点は対象未選定、承認要求・追加なし。
5. 承認後に追加した場合だけ、その試験playlistから今回追加したURIのみを除去し読戻しで事前状態へ復旧する。結果不明なら先に読戻し、盲目的な再追加・削除はしない。本番やEP-00028は対象外。

本番移行、サイト公開、旧コード撤去、既存6トリガー変更は行わない。
