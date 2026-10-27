# 司令塔緊急受入｜Phase15 10/27新着・COPYと本番のEP-ID衝突／復旧前ゲート
2026-10-27 JST。**P0最優先。READ_ONLYのみ。本番・COPY・GAS・トリガー・公開書込禁止。**

## 確認した出典
- 補填収蔵ロボ報告 `audit/phase15-urgent-ingestion-gap-20261027/docs/command-reports/2026-10-27-phase15-urgent-ingestion-readonly-report.md` commit `51228e81df069b575dc91d65229bb06ed05eeca4`、GitHub blob `121f7115cfcb0d852361181cf1757490ec6b178c`。
- 候補JSON `docs/command-reports/2026-10-27-phase15-urgent-ingestion-candidates.json` commit `4dd98cfc2a6f8bb2b7acbcf62394c5a323fb44f2`、blob `391374fd4e4c6c1b109831b1821bf0fac6afc1b5`。
- 司令塔自身が10/27 15時頃に本番 `1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4` `エピソード台帳!A6626:J6633` をLIVE READ_ONLY確認し、EP-06632「こどもそうだんしつ」GUID `a07f0210-b98d-4e6d-9d21-b4c9005ccdfc` と10/27日配信末尾なしを確認済み。COPYデータの直接再読は今回司令塔ではなく補填ロボの監査に依拠。

## 受入結果・確定事項
- 本番最終ID `EP-06632` は10/14配信「こどもそうだんしつ」。
- COPY `EP-06632` は10/27配信「MEDIA TALK 編集マニア#50」、GUID `45dbe89c-d322-4c18-864b-b4ea006173e3`。**同じIDを異なるGUIDに使用する衝突1件を認定**。
- COPYの10/27新着候補5件はID `EP-06632, 06633, 06634, 06635, 06636`、番組は MEDIA TALK2、ニュースの学校1、ドーナツ1、ニュースの現場から1。COPY採番履歴には10/27 05:12頃の記録。これらは**新着候補**であり、公式RSS全対象番組の完全照合を経た確定未収蔵件数ではない。
- オンラインGASの有効トリガー・最後の実行ログ・ScriptProperties・実際の接続先は未確認。根因は**採番状態の分岐は確定、分岐に至ったコード/運用原因は未確定**。
- COPYのEP-06633〜06636のIDも次の本番IDとして無条件利用不可。EP-06632の本番既存行と固定ID採番履歴は変更禁止。

## P0-A｜本番全件との照合と公式RSS確認を最優先
1. COPY候補5件の`GUID,show,title,pubDate_JST,official_episode_url`を固定。対象本番台帳**全6632行**をA/B/C/D/G/I/Jに絞ってチャンクREAD_ONLY取得し、GUID・URL一致／重複／同一番組題名日時を照合。末尾だけを確認して未収蔵と断定しない。
2. 7対象番組の公式RSS（Omny/Megaphone）とSDGs別経路の2026/10/27配信分をREAD_ONLYで独立取得。RSSのUTC→JST変換、GUID/公式元URL、取得日時、成功失敗を記録。RSS取得不可はSOURCE_PENDINGであって0件ではない。
3. 候補毎の結果を`OFFICIAL_CONFIRMED_MISSING / ALREADY_IN_PRODUCTION / SOURCE_PENDING / DUPLICATE / EXCLUDED`に整理。元候補5件を超える新着があれば追加し、件数をそれぞれ確定/未確認に分ける。AJW/アルキキ/YouTubeは原則対象外。
4. 本番・COPYの採番履歴、GUID対ID、同一ID対複数GUID、予約/保留、追加時刻、公開蔵と宇宙の5848-ID集合を別管理。**新採番は提案段階でnull**、衝突表と安定したrekey/migration案を必ず別ファイルで作る。既存本番IDの変更・上書きはしない。

## P0-B｜本番GASの実行入口を調べる
5. GASオンラインのスクリプトID、本番/COPYへの接続先、関数入口、時間トリガーのenable、直近実行数の成功/失敗、実際のRSS巡回ログ、再開カーソル/ScriptProperties、LockService、採番履歴への書込先を**閲覧可能な範囲でREAD_ONLY**確認。現在のGitHubソースをオンラインGASのコードと同一と断定しない。
6. オンライン画面にこちらからアクセスできない場合、ユーザーがGASで「実行数」「トリガー」「プロジェクトの設定」を確認し得られた画面記録で不明点を潰すための**3画面チェック表**を作成。個人情報・認証トークンは保存しない。ユーザーに手動実行を求めない。
7. 検証できた根因と仮説、復旧時に変更すべき最小コード・接続先差分、再発防止の `single-writer` と `GUID-level idempotency`、採番ロックと直前再照合を計画。**仮説のままで本番処理を起動しない**。

## P0-C｜実収蔵は別の明示承認申請
8. 新着1件毎に`proposed_final_id(null until safe),source_GUID,source_url,official_verified,production_match,collision_status,rollback_plan,write_scope,approval_status`を記録。採番保護と本番最新状態、対象番組と掲載ゲートを全PASSにする。
9. 承認申請は「新着本番行の安全な追加」「新着自動収蔵GASの修正・時間トリガー有効化」「蔵/宇宙公開EP-ID集合の変更」を別々に提出。**この指令は実行許可ではない**。
10. 補填の既存W清掃CONTENT_PASS3件、学校4件QA候補、報談HOLD、COPY protectedRanges `STOP_ACL_UNKNOWN`、Spotify/Pocket Casts12セルHOLD、150件意味品質検査は別トラックで維持。新着新規行の衝突問題と既存空欄セルのCOPY書込ゲートは混同しない。

## 次回報告
**先に**当日公式RSSを7番組で照合した結果、候補5件の本番全行差集合、ID衝突の全件リスト、本番GAS/時間トリガー検証結果または画面確認手順を提出。GitHub `repo/branch/path/commit` を示し、本番/COPY/GAS/公開実書込0維持。
