# 司令塔受入｜補填収蔵ロボ 5件移行プランナー DRY_RUN（2026-10-27 JST）

## 原典・確認範囲
- `Neyito96/asarisunowa:feat/phase14-production-gas-handoff-20261025:docs/phase14/five-episode-migration-reproducible-dryrun-2026-10-27.md`（報告commit `8c47b9a72147`、GitHub blob `d5d882115760cbefa6ad9a3a6f9e0986af21bcde`）
- `Neyito96/asarisunowa:feat/phase14-production-gas-handoff-20261025:scripts/audit/phase14-five-migration-readonly-planner-20261027.mjs`（修正commit `8238e3c071a0`、GitHub blob `1cbc82c1128c950476e5b5902ceca33271c10ce5`）。
- 司令塔は両GitHub本文を直接取得して読取。Google Sheets最新現物の独立取得・Node試験・GAS実機試験は今回は実施せず、動作結果は担当監査報告の証拠水準として受け入れる。

## 受入範囲
- 本番6,632、末尾EP-06632、COPY5件GUIDの本番一致0は担当READ_ONLY報告。
- COPY EP-06632〜06636→本番ID **仮案**EP-06633〜06637。ID衝突のある本番EP-06632は保持、採番確定・本番転記は禁止。
- 純関数 `planMigration` と `precommitGate` は引数のスナップショット処理だけでGitHub保存コードに外部API/書込み処理なし。
- T1新規5件、T2仮想既存5件→追加0、T3競合ID→停止、T4部分成功1件→残4件、T5旧GUID空欄5257件の想定について、担当の**インメモリ模擬**試験を受入。実際の移行・GASのロック・復旧実機成功ではない。

## コードレビューによる重要な未充足条件
1. 非空GUIDの一致判定はあるが、旧GUID空欄5,257件のタイトル/日時/公式itemid/音声URLとの照合をプランナー内で行っていない。独立して補助重複ゲートを実装し、未確定ならHOLDすること。
2. `precommitGate` は渡された最新スナップショット内の候補ID/GUIDを調べる模擬ゲートであり、共通ロック獲得と原子的コミットではない。異なるGAS間のScriptLockは共通排他にならない。
3. `recoveryStages` はステージ名の配列のみ。永続化・リトライ・部分障害補償の実装ではない。
4. プランナー単体で形式/同一性/ソース信頼/登録時55列ハッシュと保護範囲まで確認できるわけではない。新COPY VERIFIEDを本番VERIFIEDに自動転記しない。
5. 修正後モジュールの自動テストランナーは未整備。入力スナップショットSHA/取得時刻、試験fixture、assert結果を固定し再現可能なCIを整えること。
6. `precommitGate` は存在するCOPY GUIDについて`EXISTING_OR_CONFLICT_GUID`を返すが、同一GUIDの既存本番IDを復元していない。対応履歴と真正な重複確定は別途照会すること。
7. 移行時の承認済み候補IDと直前再読時の採番候補を照合し、不一致なら停止。予約/飛び番/同時編集/他プロジェクトを含む重複と競合を検証すること。

## P0次指令｜補填収蔵ロボ
- 旧GUID空欄5,257件への補助重複照合をREAD_ONLYで設計・実施し、5候補ごとにタイトル・番組・配信日時・公式itemid・音声URL等と結果/証拠を記録。表記揺れ/再配信の疑義はHOLD。
- 複数GASが共有できる排他方式または単一採番窓口を設計し、全採番経路が同一ルールで停止/復旧できる根拠を提示。未実装のまま本番移行しない。
- 永続段階`PREPARED / ROW_WRITTEN / HISTORY_WRITTEN / V3_WRITTEN / VERIFIED`の安全な証跡と冪等復旧を設計。実機障害注入は安全な隔離環境で先行検証。
- T1〜T5と異常ケースのfixtureベース自動試験を保存し、テスト再現手順・スナップショットの取得時刻/ハッシュ・PASS/FAILをGitHub報告。
- 並行してCOPYの補填3セルProtection確認と本番PENDING7件の元登録時ハッシュ照合を継続。旧掲載5848集合と人間承認109件を維持。

## 明示的な停止線
本番登録、EP-ID確定、既存IDの改変/削除、COPY補填の書込み、GASトリガー/Properties改変、Spotify/公開JSON/Pages/宇宙main変更を認めない。本番移行には差分・リカバリ計画・真正実機検証・ユーザーの別途明示承認が必要。

このファイルの変更は司令塔監査ブランチへのMarkdown文書追加のみ。
