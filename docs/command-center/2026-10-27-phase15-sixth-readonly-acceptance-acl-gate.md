# 司令塔受入｜Phase15第6次READ_ONLY：COPY3件照合とACL未確認ゲート
2026-10-27 JST / 指令書のみ。COPY・本番・GAS・公開環境への書込権限は与えない。

## GitHub実物確認
- 第6次報告 `audit/phase15-sixth-copy-readonly-20261027/docs/command-reports/2026-10-27-phase15-sixth-readonly-report.md`、提示commit `330c23a5219d03ea7e8d3d467a20adb34354a5a5`、blob `7543b6ed25706fc945831cba4e561deeb7421d47`
- 3件COPY manifest `docs/command-reports/2026-10-27-phase15-copy-school3-readonly-manifest.json`、提示commit `5e93b1c4`、blob `2920ee84aac126cb00c3d381566f46b94de2f302`
- 残7件 `docs/command-reports/2026-10-27-phase15-remaining7-review.json`、提示commit `10c1f478`、blob `a527718774a970969892dbd3b53ad8cee60c89b4`
司令塔はGitHub実物を直接取得。Google Sheetsセルや権限をこのターン独立再確認したわけではない。

## 決裁
- `EP-00081/00082/00093`：本番とCOPYのEP-ID/GUID/V原文が文字列として一致、本番既存Vの実算SHA256値を同一値のCOPYへ援用。**COPY VのSHA256を独立に再計算したわけではない**。両Wは空欄との報告。内容DRY_RUN合格3/3を継続受入。
- manifestでは`formula/validation/richtext = not returned`であり「該当設定が存在しない証明」ではない。COPY `protectedRanges`と編集者ACLはUNKNOWN。**WRITE_ELIGIBLE=0/3、STOP_ACL_UNKNOWN、writes=0**。
- 残7件：ニュースの学校`EP-00411/00412/00413/00414`4件、報談`EP-00121`1件はHOLD_CLEANING。AJW`EP-00160/00161`はTEST_ONLY_EXCLUDED。公開補填へ混ぜない。
- プラットフォームURL12セルは同一性/保護ACL未確認で引き続きHOLD。150件構造検査完了でも150件意味品質審査は未完。
- 人間承認109、公開5848、V原本/台帳、宇宙/蔵本番は不変。

## P0-A 保護ACLを読み取りで実証（実書込禁止）
1. 権限のあるGoogle Sheets API `spreadsheets.get` を利用し、COPYスプレッドシート`1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY` の対象タブ`エピソード台帳`の`sheets(properties(sheetId,title),protectedRanges(range,description,warningOnly,editors))`を読み取る。fieldsマスクに項目を含め、取得されないときは権限不足/APIスコープ/マスク問題を切り分ける。取得不能ならSTOPを維持。編集権限があっても書込許可の代わりにはならない。
2. もしアクセスできるツールが必要フィールドを返せない場合、無理にACLを推測しない。GASなら読み取りだけで`sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE/SHEET)`の対象範囲とeditor可否を確認する設計を示す。ただし**新規GASのデプロイやコード実行、トリガー変更は禁止**。必要なら「ユーザー操作で確認する具体的手順」のみ提案。
3. 3件のCOPY Wセルの最新値・formula・dataValidation・textFormatRuns/richtext、EP-ID/GUID、V原文を再読。既存トリガーや並行作業で状態が変わった場合はSTOP_STALE_SOURCE。COPYのV SHAは実算すれば別フィールドで記録し既存の導出値と区別する。
4. `ACL_CHECKED | ACL_UNKNOWN`、`CELL_STATE_VERIFIED | INCOMPLETE`、`CONTENT_PASS`の3軸で真正DRY_RUN manifestを作り、結果は`DRY_RUN_PASS_WRITES_ZERO`または停止理由とする。全条件が通過してもCOPYへの実書込には司令塔・ユーザーの**別途明示承認**が必要。

## P0-B 清掃品質残5件の安全な展開
- 4件ニュースの学校のliteral `\\n`、記事見出し+URL、共通告知の境界、5件目報談の長文・多重リンク・録音日時・ゲスト固有リンクを確認。元Vと記事/人物リンクを消さず、再実行同一性とSHA256、現行本番/COPY原文の一致を検証。
- AJW2件はテスト専用。既存掲載対象外の位置付けを変えない。466件全体への無監査自動適用は厳禁。

## P1 継続項目
- 12セルのSpotify/Pocket CastsはHTTPアクセス可否と個別エピソード同一性を分け、403/429等のアクセス困難をリンク切れ判定に用いない。
- 150件の意味監査ではV/W/X/ACで実際の記事見出し・関連URL、ゲストのリンク、内容要点を維持できるか検査し、不良/対象外/要確認/問題なしを区分。
- 承認後のW差分を蔵と宇宙LABへ渡す仕組みは維持するが、今は公開生成も自動再分類も実施しない。

## 次回提出
A. 3件ACL/セル詳細READ_ONLY実査とSTOPまたはPASS、B.残5件の可読品質レビュー、C.12セルidentity未解決と150件意味監査進捗、D.repo/branch/path/commit。実書込0維持。
