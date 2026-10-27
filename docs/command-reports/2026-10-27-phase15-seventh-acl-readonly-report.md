# Phase15 第7次 READ_ONLY監査｜COPY ACL実査ゲート
**指令** `42eb0ee987eadcbaa6f2ab746852865a56554f4f`。**本番/COPY/GAS/公開環境writes=0。**

## P0 COPY保護範囲
COPY `1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY`、タブ `エピソード台帳`、sheetId `806280644`。
利用可能な `get_spreadsheet_metadata` はシート `properties` を返したが `protectedRanges` を含まない。ツールには任意 `fields` マスクを指定する機構なし。`get_spreadsheet_cells` の field mask はセル用のみで保護編集者ACLに適用不可。**ACL_UNKNOWN**（保護なしとは言わない）。
対象W82,W83,W94の `userEnteredValue` 未設定、`dataValidation` 未返却、`textFormatRuns` 未返却、`userEnteredFormat` は CLIP/Arial10pt。これらは保護ACLなしの証拠ではない。
3件のA:G / V:Wも再読しEP-ID/GUIDが所定の値、V文字列が存在しW空欄を再確認。過去報告のCOPYと本番V文字列一致の成果は継続承認事項。
**判定：CONTENT_PASS 3/3；CELL_STATE_VERIFIED（read時点）3/3；ACL_UNKNOWN 3/3；DRY_RUN_PASS_WRITES_ZERO 0/3。STOP_ACL_UNKNOWN、writes=0。**

## P1 残り5件の原文状態再読
本番/COPYで EP-00121, EP-00411, EP-00412, EP-00413, EP-00414 のV存在・W空欄を再読。ニュースの学校4件はそれぞれV長382、399、398、419。報談EP-00121はV長1470、関連記事らしきURL3件、出演ゲスト情報を含む長文。清掃器の改行と関連記事保全、ゲスト固有リンク及び収録文脈のsemantic PASSは未完、HOLD_CLEANING維持。
AJW EP-00160, EP-00161 は TEST_ONLY_EXCLUDED（掲載対象外）。

## P1 並列ゲート
Spotify/Pocket Casts 12セルは外部episode identity、ACLとも未確認でHOLD。150件構造検査は受入済、意味品質は未完。

## 保護ACLの次の非書込ルート
権限がある環境でSheets RESTのGET `spreadsheets/{id}?fields=spreadsheetId,sheets(properties(sheetId,title),protectedRanges(range,description,warningOnly,editors))` をREAD_ONLY実行。保護対象のrangeと編集者・warningOnlyの読み取りを記録。GASはコード変更も実行も禁止されているため現在は利用しない。実書込権限の有無とは別に司令塔・ユーザーの明示承認を必要とする。

## 不変条件
main/Pages/公開JSON、公開5848件、承認109件、元V、COPY、本番、おんさ原本、GAS/トリガーを変更しない。
