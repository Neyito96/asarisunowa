# 司令塔正式受入｜Phase15 第5次・ニュースの学校3件CONTENT DRY_RUN合格
**2026-10-27 JST／作業ブランチ指令のみ／COPY・本番の書き込み権限を与えない**

## GitHub原本確認
- 補填収蔵ロボ報告：`Neyito96/asarisunowa` branch `audit/phase15-fifth-readonly-gates-20261027`, `docs/command-reports/2026-10-27-phase15-fifth-readonly-audit-report.md`、提示コミット `c4baba99781f59b8554d47c7fc544fba87b3f11c`、取得blob `3502a7f9b5c4e188ddeea1944892e72a55bd34e1`。
- DRY_RUN JSON：同ブランチ `docs/command-reports/2026-10-27-phase15-school3-cleaning-dryrun.json`、提示コミット `fdb6d8143f9647b943f28ab27546d554d683ea39`、取得blob `8f82f129551f5a3eeb4c78aab5c1d90c0c6b402f`。
- GitHub本文/JSONの再読による審査であり、司令塔自身がその場でGoogle SheetsやCOPY保護ACLを独立検証したものではない。

## 受入決裁
- `EP-00081`、`EP-00082`、`EP-00093`：LIVE READ_ONLY本番V→保存snapshot SHA256一致3件、EP-ID/GUID一致、W空欄、清掃候補SHA256実計算、literal escape改行の正常LF化、関連記事見出し×URLとAC整合3件、idempotent3件。**CONTENT_DRY_RUN_PASS 3/3 を受入。**
- 内容の合格は **COPY_WRITE_ELIGIBLE や PRODUCTION_APPROVED ではない**。実書込0、V不変。既存Wの上書き許可なし。
- 対象10件のうち残り7件は内容品質未完。AJW2件は公開対象外で実際の掲載補填から除外。ニュースの学校466件へ未検証のまま一括展開しない。
- Spotify/Pocket Casts の12セルは外部リンク先同一性の証拠とCOPY protectedRanges/編集ACL未確認につき `HOLD_EXTERNAL_IDENTITY_AND_ACL` を維持。リンク切れとは断定しない。
- 構造150件の検査は終了、意味/出演者/関連リンク品質150件は別途継続。

## P0｜ニュースの学校3件 COPY読み取り検証、実書込0
1. COPY台帳 `1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY` のEP-ID/GUIDとV/Wを行の番号を決め打ちせずEP-IDキーで再読し、本番VとCOPY VのSHA256一致、COPY Wが空欄か、対象の現在値/数式/RichText/入力規則/保護範囲を確認。コピー台帳の新着自動収蔵トリガーやV3履歴には触れない。
2. 取得できる権限のあるSheets APIで`protectedRanges`とeditor情報を確認。APIが権限不足で結果を返せない場合は`STOP_ACL_UNKNOWN`。見た目の空欄だけで書込適格と判定しない。
3. 3件について`EP-ID,GUID,prod_V_sha256,COPY_V_sha256,prod_W_old,COPY_W_old,cleaned_sha256,format/validation/richtext/protection,policy_version,status,writes:0`の完全manifestを作成。最終保存時のセル改行/記事URLの表示を非公開プレビューで点検。可能なものだけ`COPY_DRY_RUN_PASS`とし、実書込なしで提出。

## P1｜残り7件と清掃器の一般化品質
4. 残り7件のV原文の型を比較して、記事見出し・URL・固有名/出演者/収録情報が欠落しないか点検。AJW2件は非公開入力型テスト用であり掲載対象の移行リストから除く。
5. 清掃器の正常入力への再実行同一性（idempotence）、literal `\\n`、本物のLF、HTML entity、改行2回以上、未知の共通案内、空白行、URLパラメータを回帰テスト。公式の生V本文そのものは維持。問題ある入力はHOLDとし、すべてのWに無条件適用しない。
6. ニュースの学校466件への適用は原因を監査し、番組別の状態/日時/取得元/掲載対象を正規化、まず代表的な別年代サンプルの追加試験の後に承認を求める。

## P1｜他工程は並列READ_ONLY
7. Spotify/Pocket Castsの12セル候補はプラットフォーム個別URLの同一性証拠がなければHOLD。HTTP取得不能を404やリンク切れと誤判定しない。COPYの保護ACLも必須。
8. 150件の意味品質サンプル検証はW/V/X/ACの役割を踏まえ、内容脱落、記事見出し/URL分離、出演者固有リンクを評価。母集団不良率と混同しない。
9. 蔵人・宇宙へは承認後のEP-ID別W変更差分と出典SHA/清掃版/保持リンクを渡す仕様を維持。今は自動同期/公開生成しない。

## 次回の受入証拠
A. 3件のCOPY READ_ONLY manifestと各STOP/PASS理由、B. 残り7件の品質とAJW除外、C. 12セルの外部同一性/ACL可否、D. 150件意味監査の進捗。すべて`repo/branch/path/commit`に記録。
絶対停止：本番/COPY実セル、GAS・既存トリガー、V3、Spotify、おんさ原本、公開main/Pages/JSON、元承認109、公開5848への変更禁止。COPYの実書込は次回別途明示承認を必要とする。
