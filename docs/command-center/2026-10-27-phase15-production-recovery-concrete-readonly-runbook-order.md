# 司令塔正式指令｜Phase15 本番自動収蔵・復旧実行手順の具体化
2026-10-27 JST｜優先度P0｜READ_ONLYとGitHub LAB成果のみ許可

## 目的
COPYでは10/27新着5件の現行55列ハッシュとV3証拠が5/5一致し、台帳/V3の対応も確認された。一方、本番台帳は10/27分のCOPY候補5件を欠き、EP-06632がCOPY側の別GUIDと衝突している。本番GASの確認済みプロジェクトはトリガー0件、COPYは2件で、06:15実行は6分超過した。正式writer、配信当日全公式RSS、単一採番主体は未確定。目標は「人が毎朝操作せず、新着を重複なしに継続収蔵」。本番をまだ実行しない。

既存指令 `docs/command-center/2026-10-27-phase15-five-hash-pass-acceptance-production-recovery-plan.md` commit `4d7e3274e0196897faf7eb4584b40fd37cb2f679` の具体化。反復の一般論ではなく、**本番復旧実行手順書（まだ実行しない）とGO/NO_GO判定表**を納品する。

## P0-1 正式writer実装の実証
1. 本番オンラインGAS「朝ポキ｜本番ロボGAS」の新着登録関数をコード検索し、entrypoint→呼出先→openById→本番台帳append→採番履歴→V3をREAD_ONLYで図示。見つからなければ`WRITER_NOT_FOUND`とし、具体的な検索語・画面・必要なユーザー操作を1回分だけ提示。
2. COPY `phase14CopyMorningRunnerV19`・`phase14CopyIngestRecentTenV18` と異なる本番GASプロジェクトの同時writer候補を洗い出し、trigger所有者・二重起動可能性と`LockService.getScriptLock()`のスクリプト間非共有を明記。
3. 本番の固定ID採番履歴と全EP-ID/GUIDの末尾をREAD_ONLY再照合。既存本番EP-06632を保持し、COPY EP-06632〜06636はIDを転記しない。**新しい正式EP-IDは採番責任者と予約経路を確認できるまでnull**。

## P0-2 取りこぼしなく収蔵する安全設計
4. 7公式番組から各最新3件のREAD_ONLY高速監視と、正式収蔵の全新着回収を分離。旧SDGsアーカイブは別途採否決裁、AJW/アルキキ/YouTube除外。
5. RSS側HTTP失敗/キャッシュミスは`SOURCE_PENDING`、新着0件にはしない。オフィシャルRSSのGUID/pubDate/URLを採録できる取得経路を特定し、COPY既知5件と本番との差集合を提示。全8 URLのXMLが未取得なら**最低限の欠落既知5件と総数不明を分離**。
6. V18は全8 RSS itemを解析してから180秒期限を設定する既存弱点。RUNNER開始時からの安全な時間予算、feed別処理件数・所要時間、永続checkpoint、タイムアウト再開、GUID/URL重複排除、RESERVED→LEDGER→V3→COMPLETEDの部分状態回復、単一writer採番authorityを最小差分LAB仕様と疑似コードで示す。旧GASを無闇に全面書換えしない。
7. 固定ID衝突や公式確認不能が残る場合、本番書込はFAIL_CLOSED、エラー通知が必要。競合時は採番を進めず停止する。

## P0-3 本番復旧準備票と手順
8. **GO/NO_GO表**の必須欄： `production_writer_source`, `target_sheet`, `other_writer_excluded`, `EP-ID_authority`, `GUID_identity`, `RSS_source_coverage`, `time_budget`, `resume_test`, `rollback_snapshot`, `manual_approval`。各欄`VERIFIED/PENDING/STOP`を分けて証拠URLを付記。
9. 本番ロボの**導入手順（未実行）**を順番に書く：バックアップ・現在値スナップショット→LAB合成回帰→READ_ONLY shadow照合→COPY/本番同時writerの切離し確認→本番への限定5件登録の個別承認→1回限りの検証→ログ/ハッシュ/予約/重複監査→トリガー有効化の別承認→公開更新の別承認。未承認操作を暗黙に実行しない。
10. ユーザーにMac操作が必要なら、ブラウザ/Apps Scriptエディタの対象プロジェクトと検索語・押す場所だけを簡潔に示す。ターミナルや実行ボタンは要求しない。

## 納品
非公開GitHub監査ブランチに `docs/command-reports/2026-10-27-phase15-production-recovery-readiness-and-runbook.md` 相当の手順書・GO/NO_GO・未確定証拠一覧を保存しcommitを報告。まずwriter特定と採番を優先。ハッシュ5件は受入済みなので再計算を要求しない。

## 絶対禁止
本番/COPY台帳・採番履歴・V3・ScriptProperties書込、オンラインGASコード編集/実行、trigger追加/削除/変更、mainマージ、Pages/朝ポキの蔵/宇宙公開変更。収蔵・GAS稼働・公開はそれぞれ明示承認が必要。
