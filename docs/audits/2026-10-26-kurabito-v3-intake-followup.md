# 蔵人 → 司令塔｜41件の個別判定・V3証拠監査 第2報（2026-10-26）

## 指令の受領
司令塔の `feat/phase14-production-gas-handoff-20261025:docs/command-center/2026-10-26-kurabito-41-audit-intake.md` を確認した。mainにはないため当該開発ブランチを一括マージしない。

## 個別判定表の所在
- 全41件のGUID、番組、配信日時、タイトル、判定理由：[`docs/audits/2026-10-26-kurabito-41-episode-preview.md`](./2026-10-26-kurabito-41-episode-preview.md)
- 既報PR #259、mainマージcommit `8438d5d905ac1e3a5dc1bc54cd3149552dd9c2a2`
- 今回はV3確認状態・重複旧IDとの対応を加えた追加報告。
- 旧2026-10-22判定5,848件は不変。41件は採用候補36、保留3、要調査2、対象外確定0という**暫定分類**のまま。

## 本番V3項目状態のREAD_ONLY監査
本番台帳「図書館V3・項目状態」`A6593:C6633` を実測。41行ともV3記録あり。
- identity VERIFIED：34件
- identity PENDING_REVIEW：7件（EP-06594、EP-06627〜06632）
- EP-06594：`REVIEWED_CURRENT_SNAPSHOT`、公式Megaphoneフィード `https://feeds.megaphone.fm/TASC5851398719` とタイトル・音声の同一性が既存V3記録では照合済み。**登録時の元ハッシュ欠落**につきPENDING_REVIEWを維持。
- EP-06632：`REVIEW_REQUIRED`、公式RSS GUID・Apple回との照合履歴あり。V3 `officialSourceRepair` にはRSS/JSON 200と空欄補充の記録があるが、native hashと元RSS生データ確認未了としてPENDING_REVIEW。
- EP-06627〜06631：`COPY_MIGRATED_CLEANED`、登録時証拠なし、PENDING_REVIEW。採用候補に分類されていても正式掲載不可。
- 残りの採用候補31件はV3 identity VERIFIED。登録時一次ソースがV3のregistrationEvidenceに紐づく。ただし公式ソースの**今回の再取得**はしていないので「証拠記録の確認」でありオンライン一次資料の現物再検証ではない。

## 41件V3状況・旧EP-ID対照
| EP-ID | 重複候補旧ID | 前回プレビュー分類 | V3 identity | 登録証拠ステータス | V3登録元区分 |
|---|---|---|---|---|---|
| EP-06592 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06593 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06594 | — | 要調査 | PENDING_REVIEW | REVIEWED_CURRENT_SNAPSHOT | official_megaphone_rss |
| EP-06595 | EP-03857 | 保留 | VERIFIED | VERIFIED | RSS_registered |
| EP-06596 | EP-03858 | 保留 | VERIFIED | VERIFIED | RSS_registered |
| EP-06597 | EP-03861 | 保留 | VERIFIED | VERIFIED | RSS_registered |
| EP-06598 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06599 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06600 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06601 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06602 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06603 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06604 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06605 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06606 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06607 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06608 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06609 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06610 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06611 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06612 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06613 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06614 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06615 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06616 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06617 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06618 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06619 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06620 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06621 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06622 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06623 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06624 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06625 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06626 | — | 採用候補 | VERIFIED | VERIFIED | RSS_registered |
| EP-06627 | — | 採用候補 | PENDING_REVIEW | なし | COPY_MIGRATED_CLEANED |
| EP-06628 | — | 採用候補 | PENDING_REVIEW | なし | COPY_MIGRATED_CLEANED |
| EP-06629 | — | 採用候補 | PENDING_REVIEW | なし | COPY_MIGRATED_CLEANED |
| EP-06630 | — | 採用候補 | PENDING_REVIEW | なし | COPY_MIGRATED_CLEANED |
| EP-06631 | — | 採用候補 | PENDING_REVIEW | なし | COPY_MIGRATED_CLEANED |
| EP-06632 | — | 要調査 | PENDING_REVIEW | REVIEW_REQUIRED | OFFICIAL_RSS_GUID_APPLE_CROSSCHECK |

## 収蔵ロボへのREAD_ONLY同一音源確認依頼
| 新EP-ID | 既存EP-ID | 同一タイトル・番組・配信日時 | 新側GUID |
|---|---|---|---|
| EP-06595 | EP-03857 | 一致 | `dd169c36-40c0-4cf4-9b1d-ac14008566ab` |
| EP-06596 | EP-03858 | 一致 | `1545b33c-84e9-4302-806a-ac1400858106` |
| EP-06597 | EP-03861 | 一致 | `3303d8d0-a941-488e-ab22-ac1700443eaa` |

収蔵ロボは旧・新の音声URL、公式ページURL、GUID、長さ、episode item情報をREAD_ONLY取得し比較すること。既存旧EP-IDはGUID空欄。新EP-ID側のV3にはofficial_rss_plus_jsonのVERIFIED証拠あり。URLが違っても同一音源の可能性があるため、長さ・音声実体の根拠を添え「同一／異なる／未確定」を判定し、旧ID優先の扱いを提案すること。**台帳書込、IDの採番変更、物理削除は禁止。**

## 要調査2件の一次資料
- EP-06594「PHPの脆弱性」：Apple Podcastsに番組「ニュースの学校」の同名回が掲載され、公開日時2026-10-22 19:00 UTC（JST 2026-10-23 04:00）、13分と確認。Appleの回ページ `https://podcasts.apple.com/sg/podcast/php%E3%81%AE%E8%84%86%E5%BC%B1%E6%80%A7-%E3%81%9C%E3%81%84%E3%81%98%E3%82%83%E3%81%8F%E3%81%9B%E3%81%84/id1551595534?i=1000797663334`。Megaphoneフィードの今回は取得エラー。V3登録時ハッシュ欠損は解消していない。
- EP-06632「数えて比べて　楽しむ骨」：本番V3 `registrationEvidence` に `https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/693cfdd6-f5a9-4308-9025-adb10164b5b1/podcast.rss` と `https://podcasts.apple.com/jp/podcast/id1592938106`、JST10/14 04:05相当の記録を確認。また `officialSourceRepair` で公式JSON HTTP200履歴を確認したが、今回Appleの**個別エピソードページ現物**とRSS生エントリを外部独立取得できていないので要調査を維持。

## おんささん5,461件
- 共同編集資料の7音声番組の行枠合計6,502との違いは未解消。
- `5,461` の集計式／対象範囲／重複除外・未公開除外ルールを記したセルはこれまでの調査で特定されていない。先に掲載した暫定URLユニーク数6,212も再現条件未検証。
- この段階で5,461を正本数として蔵・宇宙の基準に採用しない。原本READ_ONLYを厳守。

## 安全確認・司令塔へのゲート
- 更新は監査Markdownのみ。原本台帳、共同編集シート、V3状態、公式JSON、Pages、宇宙、Spotify、GASは一切変更しない。
- 公開対象5,848のEP-ID集合（`public/library/data/scope.json`）は不変。
- 重複3件の収蔵ロボ証拠、PENDING_REVIEW 7件の解決、公式ソース再検証、5,461件の集計定義が残課題。
