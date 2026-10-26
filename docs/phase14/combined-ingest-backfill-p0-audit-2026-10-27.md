# 2026-10-27 補填収蔵ロボ統合運用 P0 READ_ONLY監査

## 監査レベル
2026-10-27 JST、本番・COPYの台帳/固定ID採番履歴/V3をGoogle Sheets APIで再読。本番全6632行のGUID集合を独立走査。GitHub記録は下記のみ。GAS・Sheet・採番・トリガー・Properties・公開物への書込0。

## A 当朝COPY GAS Executions
実行履歴のExecution ID/関数/終了状態/例外とadded/existing/held/errors/productionWrites/triggerChangesの生ログは取得できず**未確認**。Sheetsで観察される登録証跡は2026-10-27 05:12:21〜05:12:52 JSTで、COPY新着5行（COPY EP-06632〜06636）について台帳、履歴（登録完了）、V3 VERIFIED一致。これは実行ログの代用ではなく実データ再読による独立検証。補填エンジン稼働は未確認。

## B 本番/COPY GUID照合
本番台帳のA2:G6633全6632件を走査し、新着5GUID全て一致0。末尾EP-06632、本番のID重複なし。採番履歴の末尾はEP-06632に「要確認（原文・音声URL未取得）」、GUID a07f0210-b98d-4e6d-9d21-b4c9005ccdfc。COPYのEP-06632とは別配信。

|copy_ep_id|copy_guid|production_existing_id|proposed_production_id|source_url|title|published_at JST|decision|evidence|review_state|
|---|---|---|---|---|---|---|---|---|---|
|EP-06632|45dbe89c-d322-4c18-864b-b4ea006173e3|none (GUID)|EP-06633 **候補**|https://omny.fm/shows/asahi/mania50|MEDIA TALK 編集マニア #50|2026-10-27 04:00|HOLD_APPROVAL|本番GUID0件,COPY採番履歴,V3|COPY VERIFIED; 本番未作成|
|EP-06633|48792904-ceb3-11f1-a2e6-7b1c2bd6e6eb|none (GUID)|EP-06634 **候補**|https://feeds.megaphone.fm/TASC5851398719|ニュースの学校 イスラエル総選挙（2026）|2026-10-27 04:00|HOLD_APPROVAL|本番GUID0件,COPY採番履歴,V3|COPY VERIFIED; 本番未作成|
|EP-06634|e474cda9-28f9-4881-9c4f-b4e8008301cf|none (GUID)|EP-06635 **候補**|https://omny.fm/shows/asahi/d20261027|ドーナツ AIニュースブリーフィング|2026-10-27 04:00|HOLD_APPROVAL|本番GUID0件,COPY採番履歴,V3|COPY VERIFIED; 本番未作成|
|EP-06635|ef74feab-7dc0-41ff-923c-b4e400b0ebe0|none (GUID)|EP-06636 **候補**|https://omny.fm/shows/asahi/okurimono-ty1|ニュースの現場から 天童よしみさん朗読スペシャル|2026-10-27 04:00|HOLD_APPROVAL|本番GUID0件,COPY採番履歴,V3|COPY VERIFIED; 本番未作成|
|EP-06636|f8405029-19db-4278-85d3-b4ea00617b16|none (GUID)|EP-06637 **候補**|https://omny.fm/shows/asahi/51-2|MEDIA TALK 編集マニア #51|2026-10-27 04:10|HOLD_APPROVAL|本番GUID0件,COPY採番履歴,V3|COPY VERIFIED; 本番未作成|

Megaphoneのsource_urlは番組の公式フィードURL（エピソード専用ページはCOPY J空欄）。COPY側音声URLは取得済み。仮IDは最終確定ではなく、事前に最新本番GUID/採番履歴を再取得し、排他ロックと予約・飛び番/ID衝突を再チェックする。

### 書込0のDRY_RUN移行設計
1. GUIDを主キーに本番と履歴/保留/旧重複候補を全件走査。GUIDあり→existingとして追加0、異GUIDで同一ID→CONFLICT停止。
2. source provenance、タイトル、日時、音声URL、公式ページ・55列の型と保護をチェック。COPY VERIFIEDは本番への自動昇格禁止。
3. 同一入力2回目は新規候補0件（idempotency期待値）。このテストの実行自体は未実施。DRY_RUN状態の候補を本番登録済みと見なさない。
4. 将来承認された登録時にはScriptLock等の排他、コミット直前の本番ID/履歴再読、台帳/V3/履歴の段階ごとの再開可能マーカーと部分失敗時の補償・照合を設計する。承認まで実書込禁止。

## C V3 PENDING_REVIEW 7件
EP-06594、EP-06627、EP-06628、EP-06629、EP-06630、EP-06631、EP-06632すべて本番V3 identity PENDING_REVIEW、identityの保存ハッシュ欄空欄を再確認。EP-06594はreviewedRegistrationEvidence.currentRowHashあるがoriginalRegistrationHash=null。EP-06627〜31は元COPYのoriginalCopyIdentity内にSHA-256系ハッシュと登録証跡が保管され、清掃後の本番行とは一致する保証なし。EP-06632には別途本番採番履歴で「要確認」の記録あり。原本ハッシュ計算仕様と登録時の行値・時点を再現しない限り、単純な現在55列ハッシュをもってVERIFIEDに変更しない。現行native55列ハッシュのGAS実測・原本との一致は未実施。

## D 補填COPY真正DRY_RUNの事実訂正
**2026-10-26 22:24:11〜22:24:34 JST にユーザーが手動実行済み、NOT_RUNではない**。実行ログ出典: docs/phase14/backfill-five-official-dryrun-results-2026-10-26-2224.md。Omny JSON HTTP200が3件、Megaphone JSON N/Aが2件、RSS照合5件、補完候補3セル (COPY EP-06628 P、EP-06629 N/P)、holds0、writes0。独立Sheets差分検証で対象台帳/V3/履歴の全15レコードが実行前後一致。COPYトリガー2件維持はユーザーの実行後目視申告。Properties前後・トリガー個別ID・GAS補填結果以外の変更については独立実証なし。補填による実書込は未実施。非空欄W列 EP-06630関連記事3件とEP-06631ゲストXリンクの清掃は差分案のみで承認待ち。

## E MEDIA TALK重複3組
旧EP-03857/新EP-06595、旧EP-03858/新EP-06596、旧EP-03861/新EP-06597。旧ページitemidと新GUID、タイトル/公開日時/再生時間一致で強い重複証拠。旧行音声URL空欄のため音声バイト一致未検証。ID削除・統合・無断変更は禁止。詳細 docs/phase14/duplicate-media-talk-pending-seven-readonly-2026-10-26.md。

## 停止線と運用
統合担当名「補填収蔵ロボ」。新着と補填は別の検証・承認レーン。本番/COPYは別名前空間。蔵人・宇宙船長への公開介入なし。10/22掲載5848件・109件人間承認・Spotify/Pages/JSON、台帳、GAS、トリガー、Propertiesには変更なし。GitHub Markdown監査報告のみ。
