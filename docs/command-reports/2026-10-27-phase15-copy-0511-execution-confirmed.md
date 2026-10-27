# Phase15｜COPY 2026-10-27 05:11実行ログ直接証拠

ユーザー提示のApps Scriptログ（2026/10/27 05:13:00 JST）を転記・監査。追加実行なし。本番/COPY/GAS/トリガー書込0。

- mode: PHASE14_COPY_INGEST_RECENT_TEN_V18; feedCount 8; added 5; existing 25; held []; propertyWrites 0; triggerChanges 0; productionWrites 0; outOfWindow 6483; elapsedMs 38634。
- PHASE14_COPY_MORNING_V19 started 2026-10-26T20:11:15.458Z (JST 10/27 05:11:15)、finished 2026-10-26T20:13:00.417Z (JST 05:13:00)、status OK, added 5, existing 25, held []。
- 各追加の hashVerified=true。EP-06632 / GUID 45dbe89c-d322-4c18-864b-b4ea006173e3 / MEDIA TALK / row6633; EP-06633 / 48792904-ceb3-11f1-a2e6-7b1c2bd6e6eb / ニュースの学校 / row6634; EP-06634 / e474cda9-28f9-4881-9c4f-b4e8008301cf / ドーナツ / row6635; EP-06635 / ef74feab-7dc0-41ff-923c-b4e400b0ebe0 / ニュースの現場から / row6636; EP-06636 / f8405029-19db-4278-85d3-b4ea00617b16 / MEDIA TALK / row6637。
- 先行本番全6632行照合では5GUID全て未検出。COPYの該当5登録の実行者関数が05:11 runnerだったことをログから確定。
- **重要：本番EP-06632は10/14こどもそうだんしつの別GUID。COPY番号の転記禁止。**
- windowStart 2026-10-19T20:12:11.472Z, windowEnd 2026-10-26T20:12:11.472ZはJSTで10/20 05:12:11〜10/27 05:12:11。単に8フィード対象であることは全公式RSSの当日完全照合を証明しない。
- 06:15:43実行のタイムアウト詳細ログ未受領。タイムアウト時に部分書込したかは現時点で不明。
- 根因の分類: VERIFIED = COPY runnerが5件収蔵、productionWrites0、採番衝突。本番側のトリガー0画面は確認済。UNRESOLVED = 本番新着writer入口・他プロジェクトの定期処理、06:15の停止箇所、公式RSS全件総数、カーソル状態。
- 新着本番登録、GAS修復/トリガー、蔵・宇宙公開は別承認。今回すべて書込禁止。
