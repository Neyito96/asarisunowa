# 2026-10-22 — 図書館起点Spotify/複数キーワード試作

既存PR232/既存検索index・person/performer planner・REST adapterを再利用し、独立worktreeで実装。P0承認済み2ファイル/合成SHA/設定/triggerを変更せず、新PRなし。

Google Sheets READ_ONLY実測: ledger6591/unique6591/maxEP06591、Spotify episode URL形式6425、学校486。新設「図書館・宇宙 検索対象判定」はEP-ID判定0。ルール表は約5936暫定・個別未判定。未判定/人名未確認はエピソード検索に保持、投稿はHOLD。実データ「学校×気候」はEP00545/00858の2件、選択2件ともSCOPE_PENDING、writes/APIcalls0。

公開manifest HTTP200、version1df7cb5d103cfbfc、生成10/21 05:17Z、source6591/公開6466。最新GAS実行ログ/トリガーは未取得。Issue241最新記録にA/B/C実施結果なし、自動収蔵稼働は未確認。

公式Spotify資料でGET items最大50を確認し、既存PR232のadapterを50へ修正。既存writerはitems移行済み。当該403の認証付き応答がなく根本原因未確定。request別の無秘密診断、401/403/429の区分を実装。

AND/OR、番組/期間/公式出演者、関連記事、選択除外、保留、指定試験ID/最大1のhash承認、durable予約/lock、全件snapshot/投稿後読戻し/再実行0、新規非公開作成の別承認を実装。GAS READ_ONLY previewは同一検索coreから生成、既存libV3Context(false)を再利用し未配備。生成再現/副作用0含む49/49 PASS。CIを既存workflowへ追加。台帳・Spotify・認証・GAS・trigger・merge・公開の変更0。

ファイル入力の未公開Web試作を追加。ブラウザー配布取得が不完全でPlaywright起動できずスマホUIはHOLD。実Spotify試験は認証経路なし/確定候補なしで未実行。新規管理3タブは設計のみ、元本に作成しない。推奨はWeb投稿UI＋非公開管理タブ。詳細・試験結果・本番切替/停止/1URI復旧方針をdocs/library-first-playlists-2026-10-22.mdへ保存。

## 次段階：判定実反映・Spotify1話承認対象固定

PR250側で新設判定tab6591行/65910セルを27バッチ反映・全読戻し一致。他32tab値/数式不変。対象5848/対象外377/保留366、学校485対象＋1タイトル差分HOLD。出演者慎重4名は採用0、佐藤陽22候補HOLD。

EP00004/spotify:episode:6opJ4Ig4s7CTY9fRqGEHd2を実試験候補に固定。公式RSSとSpotify公開embedで題名/番組/UTC公開時刻完全一致・音声長差0.44秒を確認。指定testplaylist公開embedHTTP200、タイトルとID一致。認証APIの全件snapshot/権限とは区別する。planHash e147bc8ee91e390960baa3f74acb28b81f27c0c118777bd1d3af8ed4f441f2fe、最大1。実POST/再実行とも未実行、個別承認待ち。Spotify接続探索は該当なし、WORKに認証済み実行経路なし。RSS本番稼働・403根因は最新認証ログ未取得で未確定。承認対象・停止/復旧条件をdocs/spotify-one-episode-pilot-2026-10-22.mdへ保存。

## 1件投稿承認受領・Mac認証接続待ち

ユーザーがEP00004/固定URI/指定test先/最大1を明示承認。plan/hashは不変、承認receiptを更新。WORKからMacの既存認証は利用不能。09:50:08ZのローカルpreflightはAUTH_ROUTE_UNAVAILABLE、API0、POST0、実測件数/読戻し/replay/403はnull。認証の変更・token送付は依頼しない。

既存executor/client/永続journalを再利用する固定対象Mac入口library-v3-playlist-pilot.mjsを追加。所有/実scope確認、全件snapshot、HTTP時刻、非2xx直後停止、403成功禁止、最大POST1、読戻し後replay0、結果不明時再送禁止。新規12試験＋既存executor13試験=25/25 PASS（無通信）。実API試験は未実行。接続に必要な非秘密情報は、既存Spotify認証が動くMacファイルまたはGASプロジェクトの特定。新PR/merge/GAS/trigger/台帳/公開/Spotify実変更0。

## 本番の既存Spotify認証元を特定後の確認

ユーザー指定「朝リスの輪 プレイリスト投稿受付」のScript ID/過去Mac取得先を受領。repo0841c7cの関連8ファイルをREAD_ONLY確認しSHA保存。ユーザーtoken(cache/refresh)とアプリtoken(client_credentials)を区別。全件helper limit100、個別writerの403後forEach継続、readbackなし、V2のstate/一覧表更新副作用を確認。この経路を承認済み1件へ無条件流用しない。実GASのsecret/cache/scope/sourceは未取得。

cloud browserは指定編集URLからGoogle Developers紹介/ログインへ転送、DriveのApps Script MIME検索も該当なし。Macファイルにはアクセス不能。実API0/POST0、前後件数/読戻し/replay/403有無は未測定。既存25モック証拠を再利用し、実試験と区別。Macの既取得先を上書きしないclasp clone→8 SHA取得のREAD_ONLY手順を既存pilot文書へ追記。GAS配備/設定/trigger/Spotify/台帳/site変更0。
