# 司令塔緊急受入｜2026-10-27 朝 COPY 5件とEP-ID衝突

## 証拠水準
- 10/27朝 COPY V19：ユーザー提供の実機照合報告。COPY総件数6636、新着5件、いずれも2026-10-27配信、05:12 JST台に登録、台帳・採番履歴・V3の3箇所一致、V3 VERIFIED 5/5、V/W概要存在との報告。GAS Executionsの原ログ未取得、GitHubの当該報告未コミット。**司令塔の独立Sheet実測ではない。**
- 10/26本番 EP-06632: `feat/phase14-production-gas-handoff-20261025:docs/phase14/ep-06632-production-registration-2026-10-26.md` と `docs/command-center/2026-10-26-production-ingest-audit.md` をGitHubから再読。本番EP-06632はこどもそうだんしつ「【もっと話そう】数えて比べて 楽しむ骨」、GUID `a07f0210-b98d-4e6d-9d21-b4c9005ccdfc`、本番報告件数6632、V3 PENDING_REVIEW。本番最新Sheetは未再読。

## COPY新着（COPY内IDであって本番正式IDではない）
| COPY ID | 番組/タイトル（報告） | 状態 |
|---|---|---|
|EP-06632|MEDIA TALK：編集マニア #50|COPY VERIFIED、GUID冒頭45dbe89c…|
|EP-06633|ニュースの学校：イスラエル総選挙（2026）|COPY VERIFIED|
|EP-06634|ドーナツ：AIニュースブリーフィング|COPY VERIFIED|
|EP-06635|ニュースの現場から：天童よしみさん朗読スペシャル|COPY VERIFIED|
|EP-06636|MEDIA TALK：編集マニア #51|COPY VERIFIED|

## P0 衝突ゲート
- 本番 EP-06632=GUID a07f0210... に対して COPY EP-06632=GUID 45dbe89c...：**同じIDが異なる配信実体を指す**。COPY 5行をそのまま本番へ転記禁止。
- 本番IDの再採番・改変/削除禁止。COPY側のIDも無断変更しない。COPY内での履歴/V3参照があるため、単純な置換は禁止。
- 仮に本番がEP-06632を終端として維持しており、5件とも本番にGUID未登録なら、本番用新ID候補は EP-06633〜EP-06637。**確定割当ではない**。COPY→本番のID対応表を別アーティファクトで作成し、本番現物/履歴/保留/除外/音声URL/タイトル日時の最新照合後に確定。
- 既存COPY V19トリガーを止めない。明日以降の同時進行やCOPY内ID発行を含め、移行のスナップショット時点を明記し、本番ID割当は逐次ロック/競合検証後に行う。
- 移行前に本番/COPYそれぞれのGUIDの集合差分、同一GUID既収蔵、旧MEDIA TALK重複ペア、固定ID採番履歴、V3 証拠、55列型付き値、公式出典を確認。
- 別名前空間のCOPY IDと本番IDを混ぜない（照合キーはGUID優先、補助キーは番組+日時+公式ページ+音声URL等）。COPY VERIFIEDを本番VERIFIEDに無条件転用しない。
- エンジンの冪等性を検証（同一5件を再計画して追加0、競合時は停止、部分障害から復帰）。DRY_RUN→差分審査→ユーザー明示承認→限定移行→再読。自動本番採番・本番時間トリガーは禁止。

## P0 部門指令
1. 収蔵ロボ：COPY GAS 10/27の05:12台Execution原ログでstatus/added/existing/held/errors/productionWrites/triggerChangesと対象5件を確認する。COPY既存朝トリガーは維持。両Sheet+履歴のREAD_ONLY照合で「COPY ID→本番候補ID・GUID・状態」対応表を作成、再採番・実書込はしない。
2. 蔵人：5件は収蔵と掲載を分離。10/22掲載基準5848 EP-ID集合は固定。今朝の5件を先行公開しない。
3. 補填ロボ：今朝の新着成功は補填の成功証明にならない。既存空欄補完のCOPY真正DRY_RUNを別途検証。EP-06630/06631 W列修正は承認待ち。
4. 宇宙船長：今朝のCOPY IDを宇宙のEP-IDとして追加しない。蔵公開との集合一致を継続。

## 本書の変更境界
司令塔監査ブランチへのMarkdown保存のみ。本番/COPY台帳、GAS、採番履歴、V3、トリガー、Spotify、公開JSON、Pagesは無変更。
