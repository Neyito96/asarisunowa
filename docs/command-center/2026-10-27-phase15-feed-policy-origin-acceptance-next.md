# 司令塔正式受入｜7番組×最新3件シャドー監視とV18収蔵の仕様分離・次工程
2026-10-27 JST｜設計審査/READ_ONLY限定。GAS、トリガー、Properties、本番/COPY/公開への実書込禁止。

## 原典と確認
報告 `audit/phase15-feed-policy-20261027/docs/command-reports/2026-10-27-phase15-feed-policy-7-vs-8-audit.md` 提出commit `4af1493414df4b31be4656c07e46119e1e35a2a7`、司令塔確認blob `5780cc789e637efb307a292792ac8c85ba907968`。司令塔は報告原本を直接取得したが、オンライン`LibraryOfficialEngine.rss`本文/公式RSS全件を自身で独立取得したわけではない。

## 受入判定
- `FAST_RSS_SHADOW_V2`は2026-10-27引継ぎ文書で「7公式フィードの最新3件ずつ」を検査する**READ_ONLYシャドー**と記載。正式収蔵へ3件上限を課す確定仕様という証明ではない。
- V19から呼ばれるV18は、COPY取得元一覧の8対象行（7番組＋旧SDGsアーカイブ）を処理する。旧SDGsは番組8つ目ではない。現行V18の可視ループは各番組3件に制限せず、rolling7日、最大10**成功新規登録行**を上限とする。RSSの実際の取得上限はcallee `LibraryOfficialEngine.rss`および配信RSSサーバーに依存し、未確認。
- 8対象：ニュースの現場から、MEDIA TALK、こどもそうだんしつ、スポンジ、ニュースの学校、ドーナツ、報談、旧SDGsアーカイブ。AJW/アルキキ/朝ポキTVはV18対象外。旧SDGsを通常自動収蔵対象に含めるかは別途承認。
- `SPEC_DRIFT_REVIEW`は「不一致を発見したが、シャドー対本番の役割の違いで説明できる」という精密判定に更新。**7×3を本番上限として黙って変更しない**。
- EP-06594は旧時点でoriginalRegistrationHashMissing、別途10/24 currentRowHashの記録あり。native 55列独立ハッシュ検算未完。10/27タイムアウトとの因果を断定しない。COPY台帳/V3 6636/6636、RESERVED0は受入済。既存本番EP-06632とCOPY EP-06632の異GUID衝突は未解消。

## 次工程P0：監視と全量収蔵の2層仕様を設計・LABで検証
1. 規範仕様案を2層に分ける：A) 7番組×最新3件の高速READ_ONLY新着監視（鮮度/存在確認）、B) 全新着を漏れなく正式台帳へ収蔵する収集/照合/登録・遡及補償レーン。3件は**登録上限でない**。
2. 7番組＋旧SDGsの最新取得元URL/GUID/日付を出典付きで確認。旧SDGsの保存原本1092件/アーカイブの重複・公開対象・当日新規発行可能性を明確にし、今後も8番目として巡回するかの採否比較を提示。AJW/アルキキ/YouTube除外優先を保つ。
3. オンライン`LibraryOfficialEngine.rss()`の関数本体・呼出元・feed設定・レスポンス最大件数・タイムアウト/リトライ・キャッシュ、日付ソート実態を取得できる範囲で照合し、`items_seen`と本当に全アイテムを受信したかを分ける。
4. LABのみで、1番組4件以上、全フィード14件、RSS7日超停滞、1フィード失敗、部分登録RESERVED、実行時間上限という回帰シナリオを実装せずとも明示的な合否表で検証。登録漏れは永続feed cursor＋補償回収で解消。現時点で本番収蔵成功とは言わない。
5. フィード別`feeds_checked/items_seen/latest3_checked/eligible_new/added/held/failed/remaining/oldest_unprocessed/cursor/time_ms`を区別し、7×3シャドーPASSでも収蔵完了PASSにならない報告体系を用意。
6. 全体タイムバジェットはRSS前に開始し、終了前に安全停止＋checkpoint、GUID/URL冪等、RESERVED復旧、単一writer、global EP-ID authority、他GASの同時writer排除の設計案を提出。

## P0：自動収蔵障害は未復旧
7. 本番6632行との10/27 COPY候補5件のGUID差集合は未検出5。7番組公式RSSおよびSDGs別経路の日付別完全差集合は未実行のまま：外部取得不能はSOURCE_PENDING。新着を本番へ登録する承認はしていない。
8. 本番側の正規writer/entrypoint・トリガー/Props/カーソルとCOPY writerの接続先を監査し、分岐の最小復旧差分を作る。EP-06632本番既存行の保全、COPY IDs EP-06632〜36のそのまま採用禁止。
9. 10/27新着5件とEP-06594について、native rowHash計算の元実装（55列正規化/serialization）を特定してから独立再計算。欠落した登録当時のproofを事後計算した現在hashで偽装・補完しない。
10. 既存W/COPYのACLは`STOP_ACL_UNKNOWN`、Spotify/Pocket Casts12セルはHOLD、150件意味品質監査は未完。これらを本番新着登録と混ぜない。

## 提出物
(a) 7番組×最新3件シャドーと全件収蔵の設計書、旧SDGs分岐の採否提案、
(b) `E.rss()`の取得限度/実装と取得元定義の証拠、
(c) 公式RSS 10/27の正確な候補と本番欠落差集合、
(d) hash計算再現状況、(e) 本番writerの安全な復旧差分と必要な承認項目。GitHub監査ブランチでcommit提出。
**今回の許可はGitHub内LAB提案とREAD_ONLYのみ。GASコード修正・実行、トリガー変更、新着本番登録、main/Pages/公開JSON変更は許可しない。**
