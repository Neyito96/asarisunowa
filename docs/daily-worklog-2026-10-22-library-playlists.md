# 2026-10-22 — 図書館起点Spotify/複数キーワード試作

既存PR232/既存検索index・person/performer planner・REST adapterを再利用し、独立worktreeで実装。P0承認済み2ファイル/合成SHA/設定/triggerを変更せず、新PRなし。

Google Sheets READ_ONLY実測: ledger6591/unique6591/maxEP06591、Spotify episode URL形式6425、学校486。新設「図書館・宇宙 検索対象判定」はEP-ID判定0。ルール表は約5936暫定・個別未判定。未判定/人名未確認はエピソード検索に保持、投稿はHOLD。実データ「学校×気候」はEP00545/00858の2件、選択2件ともSCOPE_PENDING、writes/APIcalls0。

公開manifest HTTP200、version1df7cb5d103cfbfc、生成10/21 05:17Z、source6591/公開6466。最新GAS実行ログ/トリガーは未取得。Issue241最新記録にA/B/C実施結果なし、自動収蔵稼働は未確認。

公式Spotify資料でGET items最大50を確認し、既存PR232のadapterを50へ修正。既存writerはitems移行済み。当該403の認証付き応答がなく根本原因未確定。request別の無秘密診断、401/403/429の区分を実装。

AND/OR、番組/期間/公式出演者、関連記事、選択除外、保留、指定試験ID/最大1のhash承認、durable予約/lock、全件snapshot/投稿後読戻し/再実行0、新規非公開作成の別承認を実装。GAS READ_ONLY previewは同一検索coreから生成、既存libV3Context(false)を再利用し未配備。生成再現/副作用0含む49/49 PASS。CIを既存workflowへ追加。台帳・Spotify・認証・GAS・trigger・merge・公開の変更0。

ファイル入力の未公開Web試作を追加。ブラウザー配布取得が不完全でPlaywright起動できずスマホUIはHOLD。実Spotify試験は認証経路なし/確定候補なしで未実行。新規管理3タブは設計のみ、元本に作成しない。推奨はWeb投稿UI＋非公開管理タブ。詳細・試験結果・本番切替/停止/1URI復旧方針をdocs/library-first-playlists-2026-10-22.mdへ保存。
