# 司令塔指令｜Phase24 蔵起点プレイリスト構築へのピボット（2026-11-05）

## 決定と振り返り
従来の `PlaylistAuto.js` は Spotify番組取得 `fetchAutoPlaylistEpisodes_` と Spotify既存プレイリスト全件取得 `getAllSpotifyPlaylistItems_` を毎回必要とし、取得不可/404/429や再取得負荷に影響されてきた。補填で台帳は6,671 EP、Spotify個別URL 6,526件まで到達（2026-11-05 Issue #265 最終記録）。蔵検索にはタイトル・番組・出演者・清掃概要・EP-ID・配信先リンクが整備されている。

**採用アーキテクチャ**: 公式RSS→厳格照合→本番エピソード台帳→蔵→候補抽出→人間レビュー→Spotify公開プレイリスト反映（別承認）。Spotifyを検索データベースとして全件走査しない。Spotifyの既知個別URLを利用する。公開Spotifyへの追加・既存登録確認の段階にはSpotify APIまたは手動操作が別途必要で、「一切Spotifyにアクセス不要」とはしない。

## 今回の実装
`scripts/google-apps-script/P24LibraryPlaylistProposals20261105.gs` を追加。GASに置く **READ_ONLY** 候補生成器で、台帳の A=EP-ID、B=番組、L=Spotify URL、W=清掃本文を読み、タイトル・日時・出演者は現行シートの見出しを検索して検出。見出し不明なら停止し列を推測しない。8既存ルールの連載・人物・テーマを蔵から抽出する。候補にはEP-ID、行、タイトル、番組、日時、Spotify個別URL、マッチ語、レビュー要否を添付。Spotify個別URLが未入力・不正な候補は保留に分離。API呼び出し、シート書込、Spotifyプレイリスト変更、トリガーはゼロ。

`P24_LIBRARY_PLAYLIST_SELF_TEST` は純粋な基本検査。 `P24_LIBRARY_PLAYLIST_PROPOSE("polirebi")` は単体READ_ONLY、 `P24_LIBRARY_PLAYLIST_PROPOSE_ALL()` は全8ルール。オンラインGASへのデプロイ・実機台帳実行は未実施。誤採用回避のため**テーマ・出演者ルールは全候補レビュー**、連載もタイトルコードや旧ルールと突合してから採用。新しい読み取り関数は本番同期とは接続しない。

## 安全ゲートと続き
1. GASに追加する前に本番コードとの差分とヘッダーを確認。READ_ONLYで1連載・1出演者・1テーマの候補数と誤採用例を集計。
2. 正本G列GUIDの一意性、番組、タイトル、公開日、Spotify L列の形式・同一回を監査。**URL形式が正常＝HTTP200/同一回/再生可能ではない**。
3. 採用manifest（EP-ID, source row, title, date, Spotify URL, reason, reviewedBy, reviewAt, status）を作成。既存プレイリスト所属と人的除外を確認して差分を計算。
4. 更新機構では Spotify検索/全番組取得を撤去。ただし Spotifyへのアイテム追加、membership読み戻し、429共有待機、冪等性、失敗HOLDは保持。二重登録・ユーザー削除復活を禁止する。
5. COPY/モックで回帰テスト→管理人承認→本番適用→実際の追加件数・公開プレイリスト確認。

## 範囲外・未完了
現時点で**Spotifyプレイリストの新規作成/公開/項目追加は0件**。実機の候補数も未測定。既存ルールの `enabled`、本番GAS・台帳・サイト・トリガーには手を触れない。

参照 Issue #265 および `PlaylistAutoRules.js`、`PlaylistAuto.js`、`PlaylistAutoSpotify.js`、`public/library/library.mjs`。
