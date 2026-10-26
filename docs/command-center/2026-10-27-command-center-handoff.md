# 朝ポキの田｜司令塔 新チャット引き継ぎ・統括指令
**作成日：2026-10-27 JST／引継元：司令塔**  
**種別：運用引継ぎ文書・記録のみ（GAS、台帳、公開物には変更しない）**

## 0. 最重要
ユーザーは「朝ポキの蔵（図書館）」「収蔵ロボ」「補填ロボ」「朝ポキの宇宙」を司令塔が横断管理する構成で進めている。別チャットは直接通信しないため、GitHubの各branch＋path＋commitを指令・証拠・受入記録として用いる。口頭報告、GitHubコード保存、実機GAS成功、公開完了を混同しない。次チャットは以下原典を直接読み、その後GitHub最新差分を再確認する。

- 蔵／GAS主要repo: https://github.com/Neyito96/asarisunowa
- 宇宙repo: https://github.com/Neyito96/asarisu-universe
- 司令塔の収蔵系開発ブランチ: `Neyito96/asarisunowa:feat/phase14-production-gas-handoff-20261025`
- 宇宙の復旧ブランチ: `Neyito96/asarisu-universe:work/semantic-normalization-20261026`
- この文書は**asarisunowa の main**。今後は指令文書の所在を必ず repo/branch/path で記載する。

## 1. 収蔵基準、公開基準を分離
- 2026-10-22確定旧判定：台帳6,591件、掲載5,848件、対象外377件、保留366件。蔵と宇宙は同じ5,848件のEP-ID集合を使用。
- 2026-10-26収蔵ロボの記録：本番台帳6,632件、EP-06632まで。これは実機報告をGitHub記録で照合した数字であり、この引継ぎ時点でSheetsを独立再読した最新値ではない。
- 旧基準から増分41件（EP-06592〜06632）。EP-06632は配信日2026-10-14の遡及収蔵。**公開時の表示は配信日時順、ID/台帳行は不変**。
- 最新の公開済みGitHub mainの `public/library/data/manifest.json` は`total=5848`と確認済み（2026-10-26照合）。ライブPages実際の現在値は別途検証すること。
- 新41件の判定前に自動で `5848+41` を公開しない。

## 2. 蔵人：第3次監査
- PR #259: https://github.com/Neyito96/asarisunowa/pull/259 ; main `docs/audits/2026-10-26-kurabito-41-episode-preview.md`; 報告マージSHA `8438d5d905ac1e3a5dc1bc54cd3149552dd9c2a2`。
- PR #260: https://github.com/Neyito96/asarisunowa/pull/260 ; main `docs/audits/2026-10-26-kurabito-v3-intake-followup.md`; 報告マージSHA `c54449509f5603e3ace6a2b3e08a3da5cec71e06`。
- PR #261: https://github.com/Neyito96/asarisunowa/pull/261 ; 蔵人の報告・PR説明で31公開審査候補、V3保留5、重複保留3、要調査2。第3次の実際の個別ファイル/マージSHAは別途確認する。
- 41件内訳：36「採用候補」、3「重複保留」、2「要調査」。V3はVERIFIED 34件、PENDING_REVIEW 7件。
- 交差審査：**31件が次段階の公開審査候補であり、公開承認ではない**。5件のV3保留=EP-06627〜06631。重複3件=EP-06595→旧EP-03857、EP-06596→旧EP-03858、EP-06597→旧EP-03861（旧GUID空欄、音源一致未確定）。要調査2件=EP-06594（ニュースの学校）、EP-06632（遡及収蔵）。PENDING7=V3保留5+要調査2。
- 蔵人への次指令：31件の公式RSS/JSON・公式ページ存在、配信日時、旧IDとの非重複、掲載基準、V3証拠をEP別に確認。「正式採用提案/追加確認/見送り」と根拠を記録。掲載EP-IDの差分プレビューのみ作成、公開JSON/Pages/宇宙変更なし。
- おんさ共同編集資料12タブ。提供者の「5,461件」の計算定義が未確定。暫定6,502行枠や異なるURL6,212（再現未検証）と混同しない。共同編集原本はREAD_ONLY、資料の個人情報/全セルを公開GitHubに複製しない。
- 関連司令塔文書（収蔵系作業ブランチ）：`docs/command-center/2026-10-26-kurabito-third-review-31-gate.md`（commit `95f6ab6e`）。

## 3. 収蔵ロボ：Phase14公式RSS→新着登録
- 本番台帳Google Sheet: https://docs.google.com/spreadsheets/d/1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4/edit
- COPY Sheet: https://docs.google.com/spreadsheets/d/1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY/edit
- COPY GAS: https://script.google.com/home/projects/1roni6h_C9vKxtP_2I6jGgXKE2KJ1yRRhE3ZD1JsZ6XXRnT5RcndqyfJo/edit
- 本番GAS script ID `1Ywoelv_gnS6oJQz7CDbAn6PZaS4l2lty-XmhHJUdk9-K5PmvwAE79JJV`。
- 2026-10-26報告：EP-06627〜06631の5件を本番登録、さらにEP-06632を追加入庫・公式修復。本番6,632件。6件のV3は`PENDING_REVIEW`。GUID/固定ID整合は報告されているが、native55列ハッシュ・登録履歴の再検証未完了。
- EP-06632はCOPY未収蔵。**補填ロボによる新規採番禁止**。収蔵ロボがCOPYの採番/重複制御を管理。
- FAST_RSS_SHADOW_V2は7公式フィード最新3件ずつ検査、READ_ONLY。過去回収蔵漏れとGUIDキャッシュの古さに注意。
- COPY V19に朝の2トリガー約05:15/06:15 JSTがあるとの設置報告。**既存COPYトリガーは停止・変更しない**。10/27の実際の実行ログ確認は未済。本番自動トリガーと無人採番の導入は未承認。
- 蔵から依頼のMEDIA TALK重複3組は旧/新音声URL、長さ、GUID、公式ページ、音源実体をREAD_ONLYで比較し同一／異なる／未確定を判定。EP-ID変更/削除は禁止。
- 原本55列登録の汎用無人運転・ハッシュ安全性は完了とみなさない。
- 監査起点 `feat/phase14-production-gas-handoff-20261025:docs/command-center/2026-10-26-production-ingest-audit.md` (commit `f58eb3e1`)。

## 4. 補填ロボ：空欄補完と概要清掃
- READ_ONLYでEP-06627〜06632の55列棚卸し。値あり計159、空欄171（非適用を含む）。本番/COPY書込0。
- 重要：EP-06630のW列「清掃済み概要」に関連記事3件が欠落（V原文・AC記事URLは保持）。EP-06631のゲスト固有XリンクがWで欠落。既存W非空のため通常の空欄補填では**上書き禁止**。出典つき修正案を承認待ちとする。
- EP-06628の関連記事Wは保持されている。Megaphone対象にOmny JSONを強制しない。
- `scripts/google-apps-script/Phase14BackfillFiveOfficialDryRun.gs` をCOPY専用として作成済み、関数 `phase14BackfillFiveOfficialDryRun`。GitHubコード保存は**GASへの配置/手動実行成功を意味しない**。
- 実際の公式RSS/JSON取得を含むCOPY GAS真正DRY_RUNは2026-10-26報告時点で **NOT_RUN**。保護範囲全域は未検査。コードは数式・入力規則・RichTextリンクの確認を含むが、Protection自体の全列挙なし。
- 本番/COPY書込・ScriptProperties/トリガー変更は禁止。実機前後差分、HTTP/計画セル/保留理由を記録して再審査。
- `feat/phase14-production-gas-handoff-20261025:docs/command-center/2026-10-26-backfill-dryrun-code-review.md`（commit `af76f9a3`）。

## 5. 宇宙戦艦：分類資産復旧（2026-10-27引継時点最新）
宇宙repo: https://github.com/Neyito96/asarisu-universe  
復旧branch: `work/semantic-normalization-20261026`（**main未変更**）
- AI旧分類19シャード **5,358件**：`data/semantic-normalized-draft/shard-00.json`〜`shard-18.json`。
- 人間承認 **109件**：`data/semantic-normalized-draft/human-approved-109.json`（優先ロック。AI処理上書き禁止）。
- 追加救出の旧判断 **200件**：`data/semantic-normalized-draft/legacy-recovered-from-381.json`（ユーザー報告commit `9f33aa8`）。内訳assistant_reviewed147、proposed15、title_only33、hold5。**新AI推定ではない**、元status維持。もとのCSV310行中human_approved109＋今回200＝309行。残り1行は181件救出の計数へ勝手に入れない（必要ならEP-IDとCSV状態を照合）。
- 累計 **5,667/5,848件 = 約96.9%** の記録救出、未照合 **181件**。`data/semantic-normalized-draft/recovery-audit-20261026-phase2.json` に `unrecovered_ids` 181件記録（ユーザー報告commit `b33d92f`）。JSONキーの数値/配列長をGitHubから照合済み。回収率は**意味分類の精度や品質保証率ではない**。
- 報告 `docs/command-report-20261026-phase2-acceptance-followup.md`（ユーザー報告commit `c6e19c3`）と体系案 `docs/semantic-taxonomy-proposal-20261026.md`（同 `a4500ae`）を2026-10-27司令塔が読取照合。
- 20主テーマの辞書**案**あり、約100小テーマは未確定。原本main_themeを改変しない。
- 「本」文字部分一致による「日本」の文学・美術誤分類など表示ヒューリスティック事故が既知。スポーツ／文学・美術110件などの意味品質監査が残る。EP-00531は原本スポーツ系／表示国際外交の差を調査対象。
- 次：181件の旧分類資産探索（復旧と`new_ai_inference`を必ず分離）、5,667件の意味品質監査、109件保護、20主テーマ・小テーマ辞書検証、星雲LAB再構築（本番禁止）。
- 宇宙向け前回受入指令 `work/semantic-normalization-20261026:docs/command-center-acceptance-20261026-semantic-recovery.md`（commit `6f8a4225`）。
- 2026-10-22蔵公開5,848件とEP-ID集合は一致必須。新41件、審査候補31件の宇宙先行公開禁止。

## 6. 4部門・司令塔の責任境界
- 収蔵ロボ：公式RSS/JSON・GUID照合・固定EP-ID採番・新着55列収蔵・V3登録証拠。
- 補填ロボ：公式資料による**空欄のみ**補完、既存本文清掃の差分提案、COPY DRY_RUN実証。
- 蔵人：掲載判定、公開対象EP-ID集合、蔵のJSON/UI、宇宙との公開EP-ID同一性。
- 宇宙船長：意味分類原本/人間承認の保全、分類品質監査、テーマ体系、星雲UI LAB。
- 司令塔：担当分界、受入条件、横断矛盾解消、GitHub監査ログ、公開承認ゲート。**司令塔のGitHub報告だけで本番変更承認としない**。

## 7. 最優先チェックリスト（新チャット最初の工程）
1. GitHubの本書およびPR #259/#260/#261、宇宙のPhase2報告・JSONを再取得し、最新差分があれば更新。
2. 収蔵ロボ：10/27のCOPY自動トリガー実行ログの実測、MEDIA TALK重複3組、PENDING7件のnativeハッシュ照合。勝手に停止/改修しない。
3. 蔵人：31件の公開審査候補を正式採否の**提案**まで進める（公開しない）。未解決10件は別管理。
4. 補填ロボ：真正COPY GAS DRY_RUNの配置・実機実測（必要ならユーザーを一歩ずつ案内）。既存Wの修正は承認待ち。
5. 宇宙：181件探索、5,667件品質監査、人間承認109件固定、テーマ辞書検討、LAB限定。
6. おんさ5,461件の定義、蔵と宇宙のEP-ID集合一致、旧5,848スナップショットは横断課題。
7. 実施した調査・実機ログ・新たな指示・受入判断はGitHubに日付・repo/branch/path・commitで保存。大規模ブランチをmainへ一括mergeせず、指令文書はmainか参照branchを明示して共有。

## 8. 絶対停止線
原本台帳・採番履歴・V3状態の未承認変更、COPY既存トリガー停止、本番収蔵時間トリガー設置、本番自動採番、Spotify操作、公開JSON/Pages/宇宙の先行更新、人間承認109件の上書き、分類原本の破壊、無審査bulk mergeを行わない。GitHubの**監査文書追加**と、本番公開操作を区別。公開前は明示的なユーザー承認・差分検査・ロールバック準備を必須にする。

## 9. 引継ぎ時に確認済／未確認
- 確認済：GitHub主要報告ファイル、41件の蔵人個別台帳監査文書のmain内容、宇宙Phase2のJSON件数・181ID配列長、保存コードの主要処理。
- 未確認：2026-10-27現在の本番/COPY Google Sheet全件再取得、今朝のCOPYトリガー実行結果、GAS真正DRY_RUN、最新ライブPages、PR #261のマージSHAと第3次監査本文の最終ファイル、旧分類の181件の全候補再探索。
- 新チャットでは、報告を独立実測結果として書き換えず、確認できた証拠の水準を表示する。

以上。