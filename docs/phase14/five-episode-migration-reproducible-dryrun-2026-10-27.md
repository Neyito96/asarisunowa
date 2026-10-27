# 補填収蔵ロボ｜2026-10-27 P0 本番移行・再現可能READ_ONLY DRY_RUN

## 結論・証拠レベル
本番/ COPY Google Sheets実データ独立再読＋外部書込0の純関数模擬試験。**本番移行未実施、実行承認なし**。候補は提案にとどめる。実機GASへの配置もなし。
プランナー: `scripts/audit/phase14-five-migration-readonly-planner-20261027.mjs` (修正コミット `8238e3c071a0cecee452e42423c9efe4e8a51259`)。関数 `planMigration(productionRows,copyRows,historyRows,{expectedMax:6632})` と `precommitGate(...)`。インメモリデータ以外に副作用なし。
本番の旧行にはGUID空欄が5,257件あり、初版コードの「全行GUID必須」は誤りだった。修正版では空GUIDを重複判定から除外し、非空GUIDの重複とEP-IDの重複は停止扱い。空GUID旧行はタイトル/日時/公式itemid/音声URL等の別軸重複審査が必要で、GUID検査だけでは非重複確定しない。

## 最新照合
本番6,632行、末尾EP-06632。既存本番EP-06632はGUID `a07f0210-b98d-4e6d-9d21-b4c9005ccdfc`、COPY EP-06632は `45dbe89c-d322-4c18-864b-b4ea006173e3` と衝突継続。本番全行G列再読で新着5GUID一致0。末尾採番履歴に本番EP-06632「要確認（原文・音声URL未取得）」が存在。

|COPY ID|GUID|本番既存GUID一致|本番ID**仮案**|タイトル|公式ページ|配信日時JST|
|---|---|---|---|---|---|---|
|EP-06632|45dbe89c-d322-4c18-864b-b4ea006173e3|0|EP-06633|MEDIA TALK 編集マニア #50|https://omny.fm/shows/asahi/mania50|2026-10-27 04:00|
|EP-06633|48792904-ceb3-11f1-a2e6-7b1c2bd6e6eb|0|EP-06634|ニュースの学校 イスラエル総選挙（2026）|Megaphone公式RSS（COPY公式ページ列空）|2026-10-27 04:00|
|EP-06634|e474cda9-28f9-4881-9c4f-b4e8008301cf|0|EP-06635|ドーナツ AIニュースブリーフィング|https://omny.fm/shows/asahi/d20261027|2026-10-27 04:00|
|EP-06635|ef74feab-7dc0-41ff-923c-b4e400b0ebe0|0|EP-06636|ニュースの現場から 天童よしみさん朗読スペシャル|https://omny.fm/shows/asahi/okurimono-ty1|2026-10-27 04:00|
|EP-06636|f8405029-19db-4278-85d3-b4ea00617b16|0|EP-06637|MEDIA TALK 編集マニア #51|https://omny.fm/shows/asahi/51-2|2026-10-27 04:10|

5件ともCOPY台帳/履歴/V3は対応、COPY identity VERIFIED。これを本番VERIFIEDとしてコピーしてはならない。

## 書込0・テスト実測
実際のSheets READ_ONLY取得値を用いたインメモリ模擬試験：
- T1 正常系: 5件 `PROPOSE_ONLY`、候補EP-06633〜EP-06637、実書込0。
- T2 仮に全5件が登録済みのスナップショットに再実行: 5件 `EXISTING`、追加候補0（**仮想登録状態による模擬**。本番登録はしていない）。
- T3 仮に第三者がEP-06633を採番: `STOP_CONCURRENT_ID`（事前ゲート想定、仮想競合）。
- T4 仮に1件のみ本番に登録済み: 1件 `EXISTING`＋残り4件 `PROPOSE_ONLY`（部分失敗の模擬）。
- T5 空GUID旧行: 本番旧行で5,257件を検出。初版の全行必須条件は停止するため、修正版で空欄を許容。非空GUID一意性のみ検査。
重要: T2〜T4は実データを変更せずシミュレーションしたもので、GASの排他制御や失敗後の復旧機構の真正実機テストではない。コード変更後のモジュール自動テストランナーは未整備。

## 安全な将来実装の条件（本番実行不可）
ロック取得→本番最新55列/履歴/保留/予約/飛び番の再読→GUID全件照合＋旧空GUIDのtitle/date/itemid/audio補助重複チェック→現行終端・版一致→ID候補再計算→ユーザー承認済み固定対応表との差異があれば停止→承認済み行のみ限定登録→履歴とV3証拠の突合→最終再読。ロックは全ての採番ワーカーが共通の単一ロックを使う必要がある。別GAS間でScriptLockは共有されないので、単独のScriptLockでは並行採番防止にならない。
部分失敗時は `PREPARED / ROW_WRITTEN / HISTORY_WRITTEN / V3_WRITTEN / VERIFIED` の永続的ステージ記録を用い、再実行時はGUID/ID/台帳/履歴/V3を再照合して二重採番せず未完了分だけ継続。GAS+Sheetsに原子的トランザクションはない。復旧完了までは公開・次のID発行を保留。**このステージ記録機構は未実装。**

## 補填3セル保護検査（COPY）
EP-06628 P6629（再生時間）、EP-06629 N6630（画像URL）・P6630（再生時間）を `get_spreadsheet_cells` で再読。3セルとも値/数式/データ入力規則/文字書式ラン・chipRuns/リンク/ノートの返却なし。対象セルは空欄と整合。**シート/範囲Protection ACLは未取得、保護なし確定とは言えない**。補填の書込承認はなし。

## 並行作業 A/C/Dの状態
- COPY 10/27 05:12台の台帳5行と履歴/V3 VERIFIEDを直接確認。GAS Executionsの実行ID/Exception/added/existing/held/errors/productionWrites/triggerChangesは接続ツールから取得不可、未確認。トリガー変更・Properties変更なしの新しい独立検証も未完了。
- 本番PENDING7件はEP-06594とEP-06627〜06632。identityの原登録ハッシュ欄は空欄。EP-06594には後日のcurrentRowHash、EP-06627〜31には元COPY登録ハッシュと清掃後変更の注記が存在。**現在55列のハッシュでは原登録時の一致を証明できず、原本仕様/型/時刻が必要。native55ハッシュの本番GAS実測は未実施。**
- COPY補填真正DRY_RUNは10/26 22:24 JSTに手動実行済み。Omny JSON HTTP200×3、Megaphone JSON N/A×2、補完候補3セル、holds0、実行前後の対象15レコード変更0。データ実書込なし。出典 `docs/phase14/backfill-five-official-dryrun-results-2026-10-26-2224.md`。
- MEDIA TALK 3組は公式itemid一致とタイトル/日時/長さ一致、旧音源空欄によりバイト同一性未検証。削除・統合禁止。

## 停止線
本番/COPY台帳、採番履歴、V3、GAS、Properties、トリガー、Spotify、公開JSON、Pages、掲載5848件の集合は無変更。本成果物はGitHubコード・文書のみ。移行承認前に公式一次出典と実機GAS排他・部分失敗復旧のレビューが必要。
