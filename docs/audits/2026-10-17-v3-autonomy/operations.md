# ユーザー向け操作手順

**今回のコードはGitHubだけ。隔離GASへの反映・以下の書込関数実行・トリガー設置はまだ承認されていない。** 反映後も自動起動しない。既存V1/V2や公開サービス本番には触らない。

## 承認・配置後に最初に行うこと

1. `previewLibraryV3Autonomy()` で状態を確認。最初はenabled=false、V3トリガー0。既存図書館トリガーがあれば勝手に停止せず中断する。
2. シート/運用キーのバックアップと書込承認後、**`prepareLibraryV3AutonomyAfterApproval()`**。既存方式の専用2タブと運用設定を準備する。台帳は変更せず、自動運転も無効のまま。
3. `previewLibraryV3AllColumns()` / `previewLibraryV3Progress()` / `previewLibraryV3()` / `previewLibraryV3Spotify()` / `previewLibraryV3AudioQueue()` で読取確認する。プレビューの再開位置は保存されない。Spotify APIを明示設定した場合、そのpreviewも最大5GETを使う可能性がある。
4. 個別の補完承認・少量試験後、**`startLibraryV3AfterApproval()`**。enabled/allowEnrichをtrue、新規追加allowNewはfalse。トリガーは設置しない。
5. `scheduledLibraryV3()` を手動で1回試す。原ID登録がなければ最大200件の状態保存だけから開始し、自動で分割再開する。6,591件の登録には最少34実行。ここでもまだトリガーは作らない。
6. 自動化の承認後、**`installLibraryV3TriggerAfterApproval()`**。V3の10分トリガーを最大1件作る。以後WORKを開き続ける必要はない。今回この操作は実施していない。

原ID登録完了後はRSS→Spotify調査→RSS→音源キュー→RSS→進捗表を繰り返す。原ID登録/状態/履歴保存も実シート書込なので、READ_ONLYと混同しない。

## 日常操作

|目的|関数/画面|
|---|---|
|全体の進捗・再開位置・次回期限・停止理由|`previewLibraryV3Autonomy()`|
|項目別の未検査/確認済み/情報なし/保留/再検査|`previewLibraryV3Progress()` と「図書館V3・進捗」|
|Spotify欠損の根拠確認|`previewLibraryV3Spotify()`（候補は最大5EP）|
|音源検査の次の候補|`previewLibraryV3AudioQueue()`（最大5URL。空でも全件完了とは限らない）|
|自動運転停止|**`stopLibraryV3AfterApproval()`**。V3のenabledだけfalse。他のトリガーを削除しない|
|再開|原因確認後 `startLibraryV3AfterApproval()`。原ID/予約/カーソルは消さず再開。新規追加は再びfalseになる|
|任意のSpotify API検証|`configureLibraryV3SpotifyAfterApproval(options)`（apiの真偽と、番組名→22文字show IDのshowIdsを指定）。別承認・既存認証との接続確認が必要|
|将来の新着自動追加|**別承認後のみ** `enableLibraryV3NewEpisodesAfterApproval()`。原ID完了・運転有効・leaseなしが必須。実行時点以降の新着だけを許可し、過去回は追加しない|

停止は実行中writerの強制中断ではない。Busyなら実行終了を待って再度停止する。トリガー自体は残るが、停止後は新しいtickがDISABLEDで終了する。

## エラー発生時

- まず `previewLibraryV3Autonomy()` と自動補完・実行履歴、GAS実行履歴を確認。カーソル/状態タブ/予約を消して再開しない。
- Spotify403/401: API調査だけ停止。RSSは継続。認証とshow mappingを人間が確認し、承認後にconfigure関数で再設定する。429/503の待機時刻は短縮しない。
- 通信/429/503: 保存された次回時刻まで待つ。同じ実行内でsleep/連打しない。
- AUXILIARY_PAUSED: 該当補助jobの原因を確認。Spotifyはconfigureで再確認できる。他の補助jobの解除は状態の限定修復を別レビューし、RSSや採番状態を巻き戻さない。
- unresolved_write_reservation: 実セル・予約targetHash・履歴を比較して人間確認。空欄だからと自動的に書き直さない。
- 原ID重複/ヘッダー不一致/監査履歴異常/連続エラーで停止: 有効化を繰り返さず、対象を特定して修復。今回のバックアップへ全シートを一括上書きしない。
- leaseだけ残った場合: 直近実行の終了を確認し8分の期限を待つ。enabled=trueなら次のtickが回収する。enabled=falseで手動起動が拒否される場合は、leaseの限定修復をレビューする。

## 正常な稼働・完了の基準

- baseline.complete=true、offsetが対象件数に到達。一意な原IDが登録されている。
- 対象feedすべてでcompletedAtが記録され、priority/reviewのoffsetが進んで一巡し、次回poll待ちへ移る。新着があれば再び取得/補完へ移る。
- 候補セルの保存後再実行で同じセルを上書きせず、新規EPも二重追加しない。実セル/履歴/項目状態が一致する。
- 進捗表が更新され、保留/情報なし/再検査を確認済みと混同しない。空欄0や全音源再生可能を完了条件にしない。
- Spotify調査の停止がRSS巡回を止めず、外部音源未接続を音源確認済みにしない。

これは継続運転の基準であり、情報が存在しない項目まで「図書館の全項目完成」とする基準ではない。音源HTTPの自動実行方式はユーザー選択が残る。
