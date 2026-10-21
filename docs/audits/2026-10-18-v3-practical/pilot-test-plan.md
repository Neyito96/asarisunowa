> **ZIP受領後の更新:** 全36ファイル照合とコピー専用経路のローカル13試験は完了。以下の取得不可・コード未準備の記述はそれ以前の経緯。[現在の差分と承認範囲](zip-final-validation.md)を優先。

# PR #230：試験先の限定と1件保存の準備

2026-10-18 11:26 JSTのユーザー指示を反映。試験先指定は投稿の承認ではない。今回、オンラインコード・シート・Properties・トリガー・Spotifyに変更は加えていない。GitHubコードのHEADは4b0028cを確認し、全面機能監査と全件巡回は繰り返していない。

## Spotifyの唯一の試験先

|項目|確定内容|
|---|---|
|名称|リス田 自動更新テスト（ユーザー指定。Spotify側の表示は未取得）|
|許可対象のID|`4FiVIwysKDtLqEXfkfhu2O` のみ|
|書込許可|未承認。指定だけで投稿しない|
|上限|プレイリスト追加POSTを最大1回、URIを1件だけ|
|禁止|他リストへの投稿、置換、削除、並替、説明/公開状態変更、失敗時の無条件再送|
|試験EP|未選定。GUID・台帳IDまたは新着候補・Spotify URI・Show ID・タイトル・配信日をREAD_ONLYで一意に確定してから提示|

[試験条件JSON](pilot-test-plan.json)はレビュー用の宣言であり、GASのPropertiesや実行中コードが自動参照する設定ではない。現在の汎用runnerへこのIDを設定したと偽っていない。実行用の限定ラッパーを用意する際も、このID以外を送信前に拒否し、1件以外のpayloadを拒否する必要がある。

## 使用する認証の案と未確認事項

既存V1の `SpotifyAuth.js:getSpotifyUserAccessToken()` を再利用する。既存キャッシュを優先し、必要なら既存のClient ID/Secret/User Refresh Tokenを読み、OAuth access tokenを更新してcacheに保存する。GitHub版のこの関数にScript Propertiesへの書込はない。認証値、共同編集招待URL、tokenは表示・転記しない。新規認証情報の作成、OAuthスコープ変更、既存Propertiesの更新は行わない。

ただし、隔離GASにこのV1認証経路が存在することは未確認。現行35ファイル一覧にはSpotifyAuth.gs等がなく、前回全文にも直接依存がなかった。認証ユーザー、tokenスコープ、試験リストの所有/追加権限、対象EPのJPでのis_playableは未確認。既存公開GASで汎用writerを実行して代替しない。

投稿承認を求める際は、実際に確認できた認証ユーザーと既存認証の実行先、token更新の要否、対象1URI、追加先ID、付随するコピー状態保存をまとめて提示する。権限不足ならスコープ拡張や別アカウントへ勝手に切り替えず停止する。token endpointの更新要求と、プレイリスト追加の1POSTは区別して報告する。

## 全文照合・READ_ONLYの現在地

- 現行隔離GASへ再接続し、35 .gs＋manifestの一覧を確認。LibraryV3Morning.gsがないことも確認した。
- LibraryV3.gsの全文clipboard取得を1回試したが、ブラウザー資格情報保護で拒否。省略表示の本文は全文ハッシュに使っていない。
- Driveの一括エクスポート名検索に結果はなかった。既存の10/17バックアップを10/18現行Headの代用にしない。
- 前回11:12の `previewLibraryV3Autonomy()` はREAD_ONLYで完了し、baseline.offset=6591 / complete=true / enabled=false / writes=0だった。この値を今回の再実測として転記しない。
- PR #230新コードは未反映のため、その実機READ_ONLYは未実施。初期登録・既存Propertiesは保持している。

必要な入力は現行Headの一括ZIP。取得方法は[前回記録の公式clasp一括取得](launch-readiness.md#全文取得の代替はこの一つだけ)一つに絞る。ZIP受領後に全ファイル名/UTF-8本文SHA-256を突合し、想定外差分で中断する。新コードの隔離反映が必要なら、許可するファイルと復旧本文を提示してから行う。今回のメッセージをオンラインコード保存の包括承認として扱わない。

## コピー台帳1件保存の準備：そのまま呼べない関数

|既存経路|確認できた副作用|今回そのまま使えない理由|
|---|---|---|
|libV3Append_|内部でlibV3Context_(true)を再取得し、LIB_V2_SHEET_IDへ接続。LIB_V3_LAST_IDをsetProperty。identity予約→51セルの新規行→VERIFIEDを保存|呼出元のContextだけコピーに差し替えても、本番接続先を再取得する。Properties変更も禁止されている|
|libV3Run_(true, morning)|最大5候補、cursor/failure/config Propertiesと履歴を更新|1件限定・Properties不変の試験ではない|
|libV3MorningSpotify_|標準Contextを再取得し、Spotify URLやplaylist:HOLD/VERIFIEDを台帳側に保存|試験リストを使っても、台帳側の状態書込先は自動的にはコピーにならない|
|scheduledLibraryV3Morning|Properties保存と再開トリガー作成/削除を含む|READ_ONLYや今回の1件試験の入口にはしない|

したがって、**既存関数をただ呼ぶだけのコピー試験は準備完了ではない**。本番の採番・排他・予約保護を外す変更もしない。

全文照合後に準備する最小差分は、コピー先を明示したContextをAppend内部の再検査・Spotify内部の再検査まで引き継ぎ、試験の採番予約をコピー側の永続状態で保持する経路。本番の既定経路は維持し、Properties更新の禁止を守る。通常のAppend、決定・除外・数式・重複・事前予約・事後照合を再利用する。単なるSheets手動追加を「GAS登録試験の合格」にしない。

コピーIDは未確定。元台帳や既存バックアップを試験の書込先にしない。試験専用の新しいコピーを選び、そのID・1件のGUID・対象行/列・状態/履歴の付随差分を確定するまで書込しない。現時点でコピーの作成も保存試験も行っていない。

## 次に進める条件

1. 現行Headの一括ZIPを取得し全文照合を完了する。
2. 照合済みコードでREAD_ONLYを確認する。新しいプレビューの反映が必要なら対象2ファイルの承認を先に得る。
3. コピー専用のContext・Properties不変・1件限定・中断再開をローカル試験し、対象GUID/コピーIDと差分を提示する。ここでは実保存しない。
4. 保存試験の許可後にコピーへ1件だけ保存し、再実行0追加を確認する。採番/予約/履歴を含めてコピー内だけ、Properties差分0を確認する。
5. Spotifyは別実行・別承認。対象EP、既存認証、許可リストID、1URI/最大1POST、コピー内の状態記録を提示し、承認後のみ実行する。不確実な成否はHOLDで止め、再送しない。

公開プレイリスト・本番台帳・既存Properties・トリガー・デプロイ・PRマージは、以上の試験承認に含めない。
