# 朝ポキの田｜司令塔統括監査 2026-10-26
対象：Phase14 本番新着収蔵 引き継ぎ報告
記録方針：原本/GAS/Spotify/COPYトリガーへの変更なし。GitHub作業記録だけ保存。

## 根拠と確認範囲
作業ブランチ `feat/phase14-production-gas-handoff-20261025` の下記記録・ソースを司令塔が読取確認：
- `docs/phase14/production-ingest-five-2026-10-26.md`
- `docs/phase14/fast-rss-shadow-v2-test-2026-10-26-1638.md`
- `docs/phase14/fast-rss-shadow-v2-second-run-2026-10-26-1639.md`
- `docs/phase14/ep-06632-production-registration-2026-10-26.md`
- `docs/phase14/ep-06632-official-source-repair-verified-2026-10-26.md`
- `scripts/google-apps-script/Phase14ProductionRssFastShadowV2.gs`
- `scripts/google-apps-script/Phase14ProductionRssShadowReadOnly.gs`
- `scripts/google-apps-script/Phase14RepairEP06632FromOfficial.gs`
- `scripts/google-apps-script/Phase14NewEpisodeFormatterV4ReadOnly.gs`

Google Sheetsの現時点の実データ、GASトリガーの現行値、10/27の自動実行結果は、今回直接独立検証していない。

## 照合結果
- 本番 EP-06627〜EP-06631 の5件登録：台帳、採番履歴、V3状態への登録・再読成功との実機記録。本番総数は当時6,631件。
- EP-06632 追加登録：2026/10/14配信のこどもそうだんしつ。GUID `a07f0210-b98d-4e6d-9d21-b4c9005ccdfc`。登録・再読報告後、本番台帳6,632件、最終ID EP-06632。
- EP-06632 公式修復：本番GASで公式RSS再取得、公式JSON HTTP200、概要原文・音声URL・画像・公式URL類を空欄のみ補完。W列清掃概要と関連記事URLの保持を記録。専用修復はEP-06632のID、GUID、行番号を固定した単発処理であり、汎用本番自動登録処理ではない。
- 高速RSS V2 16:38：feeds7, checked21, available5416, candidates1, rowsRead6631, writes0、約9秒。
- 高速RSS V2 16:39：feeds7, checked21, available5416, candidates1, rowsRead0, writes0、約1秒。RSS全フィードは依然取得・パースする。GUIDキャッシュは既存行の手動修正・削除を検出しないため、採番前の全件照合が必要。
- V3のEP-06627〜06632は全6件 `PENDING_REVIEW` のまま。現在行のnativeハッシュと登録履歴等の証拠を確認するまでVERIFIEDにしない。
- COPY V19の朝トリガーは停止・変更しない。10/27の成功は実行ログ確認まで未確定。本番自動トリガー未設定。

## 司令塔の注意・設計上の制約
1. **優先P0**：V3 6件についてREAD_ONLYで現在行、V3状態、採番履歴、登録・修復証拠の整合監査を行う。証拠不足なら保留。
2. **優先P0**：本番55列新着登録を一括設計し、公式RSS/JSON、清掃・出演者・関連記事、EP-ID/固定採番/V3状態を再読検証まで1つの安全な処理に統合。現行シャドーV2を検知段階として再利用し、不要な重複実装をしない。
3. **優先P0**：高速V2は公式7フィードの最新3件のみ検査。2026/10/14配信のEP-06632のような過去回漏れがあり得る。日付窓、継続カーソル、定期全量照合等の収蔵漏れ対策を別途設ける。
4. **優先P0**：GUIDキャッシュは全件安全証明ではない。自動採番直前に本番台帳のGUID/音声URL/タイトル＋日時/採番履歴/除外を最新状態で重複照合、必要なら保留。
5. **優先P1**：概要清掃は関連記事の見出し・URLを保存し、共通広告・宣伝を除去。EP-06630の関連記事は人間確認を待つ。
6. **優先P1**：閲覧表示は配信日時順、原本行番号・EP-IDは不変。蔵人は掲載判定済みEP-IDだけ公開。
7. **運用停止線**：本番GAS時間トリガー、自動採番、PR一括mergeをしない。COPYの既存トリガーを一切停止・変更しない。ソース変更は分離ブランチ／差分検証／明示承認。
8. **GitHubブランチ監査**：`main...feat/phase14-production-gas-handoff-20261025` は2026/10/26の照合時点で diverged、ahead134、behind22。一括マージ禁止。

## 次回に必要な証拠
- 10/27朝のCOPY V19実行ログ：status/added/existing/held/errors/productionWrites/triggerChanges とCOPY台帳の採番・重複・状態。
- 本番6件のnative 55列行ハッシュ・V3証拠・採番履歴のREAD_ONLY監査。
- 新規55列収蔵のDRY_RUN/再実行0件/障害注入/重複排除の結果。
- 統合報告は各担当のコミット・検証を参照し、会話上の未保存進捗を実証済みと取り違えない。

## 司令塔判定
シャドーV2の検知性能とEP-06632の限定修復は実機記録で確認。**本番完全自動収蔵の受入条件は未充足**。COPY継続、本番トリガー禁止、V3再検証と55列完全登録の開発を優先。
