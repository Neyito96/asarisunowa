# 朝ポキの田｜司令塔指令：補填収蔵ロボ（統合運用）
**2026-10-27 JST／P0／指令と監査記録のみ**

## 0. 組織統合と責任境界
従来の「収蔵ロボ」と「補填ロボ」を**「補填収蔵ロボ」**に統合し、一つの担当チャット・GitHub報告系列で運用する。統合は担当窓口の統一であり、本番採番と既存セル変更の承認ゲートを廃止しない。

- 新着収蔵レーン：公式RSS/JSON検出→GUID/重複照合→固定EP-ID候補・55列登録計画→採番履歴/V3証拠。
- 補填レーン：公式一次資料から既存の**空欄のみ**補完。非空欄の清掃修正は差分提案と別途承認。
- 蔵人：掲載審査・公開対象EP-ID集合。宇宙船長：意味分類。統合ロボは掲載・宇宙公開をしない。
- 本番/COPYの名前空間を明示し、COPY IDを本番正式IDとみなさない。

## 1. 今日のCOPY 5件（ユーザー実機報告、未独立再読）
2026-10-27 05:12 JST台にCOPY 5件登録、COPY総件数6,636、5件ともV3 VERIFIED、台帳・履歴・V3照合済み、原文/清掃済み概要ありとの報告。GAS Executions生ログは未取得。補填レーンの稼働実績とは別。

|COPY ID|内容|
|---|---|
|EP-06632|MEDIA TALK：編集マニア #50|
|EP-06633|ニュースの学校：イスラエル総選挙（2026）|
|EP-06634|ドーナツ：AIニュースブリーフィング|
|EP-06635|ニュースの現場から：天童よしみさん朗読スペシャル|
|EP-06636|MEDIA TALK：編集マニア #51|

## 2. P0：EP-06632衝突の完全停止線
本番10/26登録 EP-06632 は「【もっと話そう】数えて比べて 楽しむ骨」（こどもそうだんしつ）、GUID `a07f0210-b98d-4e6d-9d21-b4c9005ccdfc`。COPY EP-06632 は別実体「編集マニア #50」、GUID冒頭 `45dbe89c`。

**COPYの5行をそのまま本番転記・EP-ID書換・再採番・削除・統合してはならない。**
本番件数6,632/末尾EP-06632は10/26報告時点の数字。最新本番の履歴、GUID、重複、予約・飛び番が未確認なので仮案EP-06633〜06637を確定しない。

## 3. P0：統合ロボに直ちに求めるREAD_ONLY監査
1. COPY GAS 10/27朝05:12台と05:15/06:15付近の**実行履歴**を取得。実行ID/関数名/状態/時刻/例外、added、existing、held、errors、productionWrites、triggerChangesを報告。取得不可は未確認と明示。
2. 本番/COPY最新台帳・固定ID採番履歴・V3をREAD_ONLYで再取得。COPY5件について `copy_ep_id, copy_guid, production_existing_id, proposed_production_id, source_url, title, published_at, decision, evidence, review_state` の対応表を作る。GUIDを主、番組・日時・公式ページ・音声URL等を補助に照合。
3. 本番のEP-06632とCOPYのEP-06632を変更せず、別名前空間のまま記録。5件すべてが本番未収蔵で、末尾IDがなお06632と証明できる場合に限り、EP-06633〜06637を仮採番候補として提示。移行には別途ユーザーの明示承認が必要。
4. 同じ入力で追加0件となる冪等性、GUID重複、競合採番、partial failureからの復旧をDRY_RUN設計で提示。COPY VERIFIED→本番VERIFIEDの自動昇格禁止。
5. 本番V3 PENDING_REVIEW 7件＝EP-06594、EP-06627〜06632について、登録時証拠とネイティブ55列ハッシュ仕様の一致を先に監査。現行ハッシュ計算だけでは原ハッシュ一致を証明できない。
6. MEDIA TALK重複疑義 EP-03857/06595、EP-03858/06596、EP-03861/06597 は公式itemid=新GUID、タイトル/日時/長さ一致の強い証拠を引き継ぎ、音源バイト一致未検証として保留。ID削除不可。

## 4. P0：補填レーンは独立して実証
1. `scripts/google-apps-script/Phase14BackfillFiveOfficialDryRun.gs` のCOPY専用関数 `phase14BackfillFiveOfficialDryRun` はGitHubコード保存済みだがGAS真正実行**NOT_RUN**。コード保存を成功報告にしない。
2. 実行するなら事前に既存トリガー/Properties/対象55列/採番履歴/V3を保全し、コピーGASへ対象関数のみ安全配置。変更対象セルは0、公式RSS/JSONのHTTPとsourceChecks/plans/holds、実行前後差分、例外を報告。既存COPY朝トリガーを絶対に停止・変更しない。
3. EP-06630 W概要で関連記事3件欠落、EP-06631 W概要でゲストの固有Xリンク欠落は既存非空欄。公式出典付き変更案を作成するのみ。承認なく上書き不可。
4. EP-06632の新規採番は補填処理の責務ではない。収蔵レーンで管理。

## 5. 提出物・GitHub記録ルール
- **A:** 10/27朝COPY Executionsの原ログ要約＋実行ID/時刻/例外
- **B:** 本番/COPY5件のGUIDベース照合表と衝突解消のDRY_RUN計画（実書込0）
- **C:** V3 7件ハッシュ仕様・登録証拠レビュー
- **D:** 補填COPY真正DRY_RUNの実機ログ（未実施ならNOT_RUN）
- **E:** MEDIA TALK重複3組の現在判断・停止条件
- 各報告は `repo / branch / path / commit` と検証レベル（報告のみ・GitHub確認・GAS実測・公開確認）を記載。GitHubへ保存できなかった場合は未コミットと明記し、代替として司令塔が監査ブランチに原報告と未保存理由を残す。

## 6. 絶対禁止
本番/COPY台帳、採番履歴、GAS、既存トリガー、ScriptProperties、Spotify、Pages/公開JSON、人間承認109件、旧掲載5,848件のEP-ID集合の無断変更。mainへの大規模一括マージ。正式公開・本番無人採番は別途審査・明示承認後。

関連の司令塔記録：`audit/command-center-resume-20261027:docs/command-center/2026-10-27-copy-five-id-collision-acceptance.md`（commit `bdf6f2d27f84742b523c8fd10f872e40d4152b1c`）。
