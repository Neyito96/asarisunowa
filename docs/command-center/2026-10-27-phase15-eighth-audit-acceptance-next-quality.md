# 司令塔｜Phase15第8次READ_ONLY受入・清掃5件の意味品質ゲート
**2026-10-27 JST｜GitHub指令のみ。COPY/本番/GAS/公開への書込0を継続。**

## 原典確認
- 第8次報告: `audit/phase15-eighth-acl-alternative-clean5-20261027/docs/command-reports/2026-10-27-phase15-eighth-readonly-report.md`、提出commit `171d828f12c1f7f3415767fa0a7d78150dd69d09`、GitHub blob `65ea477ff7938bb9acb0c05976131d564a37246f`。
- 5件manifest: `docs/command-reports/2026-10-27-phase15-five-cleaning-dryrun.json`、提出commit `587fbf840e5a3dfb136fa93d0bca7977b7a55e7b`、blob `480cbdc66b3b432a23a12bb24467ec63f90664cd`。
司令塔はGitHub本文・manifestを直接確認。Google Sheetの独立実セル・ACLは司令塔側で再確認していない。

## 正式受入・未達区別
- EP-00411/00412/00413/00414（ニュースの学校）、EP-00121（報談）の計5件について、本番V live readbackとGitHub snapshot同一/UTF-8 SHA256、清掃候補hash、literal backslash-n→改行、記事URL**基底部**保全、idempotencyを5/5とした担当監査結果を受入。
- **5件とも`HOLD_SEMANTIC_REVIEW`、CONTENT_PASSとは認定しない。** 現行manifestの`headline_url_pairs`にある`headline`が**5件とも空文字列**。文章に記事見出しの文字列が残ることと見出しURLペアの構造保証は別。正しい題名とURLの組を明示的に検証し、実データのbefore/afterを匿名化・短い要約で記録。
- URL損失のraw literal `&nbsp;`混入による疑似不一致と実際の削除を分ける。URLの`?iref=omny`などのquery付き完全表示・href整合、人物固有リンク保持、X/AC分離列との重複と可視性を明示。
- EP-00121：ゲスト望月洋嗣、2026年10月8日収録の注記、司会/記者への個別リンク、関連記事3件、複数の番組案内URL。**広告定型と実用的な読者リンクを一律削除しない。** 短文ニュースの学校と独立した長文清掃ポリシーを検討。
- 前工程ニュースの学校EP-00081/82/93の3件はCONTENT_PASSを維持。対象公開補填候補8件中現在CONTENT_PASS3件/HOLD5件。AJW EP-00160/161は公開対象外・試験専用。
- COPY保護ACL未取得`STOP_ACL_UNKNOWN`。Spotify/Pocket Casts12セルは外部identityとACL未確認で全HOLD。150件の機械検査は完了、意味品質150件は未完。全実書込0。

## P0：5件の意味品質を詰めて機械可読manifestを再生成
1. ニュースの学校4件を先行し、V記事見出し文字列と記事URLの**完全な対応**を抽出。`headline`が空にならないよう抽出規則を修正し、原文と清掃後で順序・URLクエリ・文字列と表示が矛盾しないかテスト。リンクはX/ACに移動済みの場合、その所在と表示経路を証明。
2. 5件とも`review_status`は`CONTENT_PASS`または`HOLD`を理由付きで独立審査する。URL完全一致・正当なquery保持・広告URLの意図的除外を`preserved/deleted_as_promo/ambiguous`で列挙する。
3. EP-00121はゲスト固有名/プロフィールリンク・収録日時・記事見出し×URL3組・リスナー導線の保持要件を別途定義。長文型の清掃で文脈・人名・関連記事を消すならSTOP。
4. 実原文Vは不変。最新版V SHA256照合、改行やHTML entity、idempotency、candidate SHA256を再実証。10件試験のAJWは本番補填に混ぜない。
5. 文章品質PASSとなってもCOPY実書込許可にはならない。ACLとCOPY identity/readback/セル保護を独立ゲートで確認する。

## P0：ACL取得は別認証経路へ
6. 現行Sheets接続の再試行は不要。COPY ID `1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY`、tab ID `806280644`について、OAuth `spreadsheets.readonly`の主体からGET `https://sheets.googleapis.com/v4/spreadsheets/{COPY_ID}?fields=spreadsheetId,sheets(properties(sheetId,title),protectedRanges(range,description,warningOnly,editors,unprotectedRanges))` を呼ぶ**実行手順**を記録。ただし `unprotectedRanges` はProtectedRangeのフィールドではなく、タブのシート保護には`protectedRanges[].unprotectedRanges`の形で含める必要があるため、実際のGoogle API仕様に合わせたfields指定を採用。トークン/個人情報はGitHub公開に残さない。
7. 認証済み実行環境が未確保なら`ACL_UNKNOWN`のままにし、ユーザーがSheets UI「データ→シートと範囲を保護」で保護状態を閲覧する確認手順を案内できる資料を作る。画面確認は補助証拠、書込を伴わない。GASのコード変更・実行はこの指令で許可しない。
8. 保護情報が得られても、事前READ_ONLY真正DRY_RUNで最新EP-ID/GUID/Vhash/W空、数式・RichText・validation・sheet-level保護例外を独立チェックした後、**別途司令塔およびユーザーの明示承認**があるまで実書込0。

## P1：継続
- Spotify/Pocket Casts12セルのプラットフォーム上の同一エピソード証拠が不足。HTTP取得不能はリンク切れの証拠ではない。
- 150件意味品質：V/W/X/ACに本編要旨・ゲスト・見出し×URLが機械的に構造保持されるか+意味的品質の実査を別途完了し、層化標本の不良率を全台帳へ外挿しない。
- これらの成果はEP-ID/old-new SHA/清掃policyで蔵人・宇宙LABへ将来伝達。人間承認109・公開5848・元AI原本を変更しない。

## 次回提出
学校4件の正しい見出しURLペア/URL完全性とCONTENT_PASS/HOLD、報談1件の長文意味品質、ACL別経路の取得結果または実現不能理由、150件意味品質の進捗をrepo/branch/path/commit付きで提出。
**禁止：本番・COPY実セル、GAS・既存トリガー、おんさ共同編集、Spotify、main/Pages/公開JSON、採番・人間承認109・公開5848への変更。**
