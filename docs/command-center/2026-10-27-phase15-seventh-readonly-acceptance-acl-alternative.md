# 司令塔｜Phase15第7次READ_ONLY受入・ACL代替経路と清掃5件の並行指令
**2026-10-27 JST｜COPY/本番への書込0、GAS変更・実行0、公開更新0**

## 原典と受入
- `Neyito96/asarisunowa` branch `audit/phase15-seventh-acl-gate-20261027`、`docs/command-reports/2026-10-27-phase15-seventh-acl-readonly-report.md`、提出commit `18648930b93313415e45c2bd916328fd6706d64d`、確認blob `2c25c600e9ee157467703d0ac82db1ece6e00d96`。司令塔が直接GitHub本文を確認。
- COPYスプレッドシート `1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY`、タブ`エピソード台帳`、sheetId `806280644`。EP-00081/82/93のW82/W83/W94はセル値空欄、EP-ID/GUID/Vあり。数式、入力規則、RichTextは取得結果に該当フィールド未返却であり「設定が存在しない」と証明されたわけではない。
- CONTENT_PASS3/3、CELL_STATE_VERIFIED3/3、**ACL_UNKNOWN3/3、DRY_RUN全ゲートPASS0/3**。STOP_ACL_UNKNOWNを維持。COPYや本番へ書き込みなし。

## P0：ACL調査を「同一APIの再試行」から切り替える
1. 現行 `get_spreadsheet_metadata` は `protectedRanges` を取得できないと判明。これを毎回繰り返さない。スコープ・権限・実行主体を明記した**別の権限ある読み取り環境**で Google Sheets REST `GET https://sheets.googleapis.com/v4/spreadsheets/{COPY_ID}?fields=spreadsheetId,sheets(properties(sheetId,title),protectedRanges(range,description,warningOnly,editors))` の実行計画を立てる。資格情報をGitHubへ保存しない。新しいツールが使用可能な場合だけREAD_ONLYで実行し、応答のschema・rangeと対象W82/W83/W94への適用を精査。
2. 別環境が無ければ、**ユーザーがSheets画面の「データ→シートと範囲を保護」で該当タブ・範囲と編集可能者を閲覧する確認手順**を作る。目視の写真だけではAPIによる実証と同等とは扱わず、確認者・時点・対象保護・例外範囲を記録。権限がない、保護設定の一覧が不完全ならSTOP。
3. レスポンスが空集合でも、フィールドマスクが正しく適用されていたか、API principalがどの権限か、シート全体保護/例外範囲/warningOnlyを検証する。編集許可と司令塔の書込承認は別問題。**今回の指令は書込承認でない**。
4. 書込なしの`ACL_EVIDENCE_MANIFEST`を作り、証拠を得られなければ`ACL_UNKNOWN`のまま終了・要人手エスカレーションとする。

## P0並行：清掃5件を前進
5. ニュースの学校`EP-00411/00412/00413/00414`（V長382/399/398/419）と報談`EP-00121`（V長1470、関連記事URL複数、ゲスト情報）について最新V/GUID/WをREAD_ONLY、Vの実値SHA256と保存snapshot照合後、clean v2 previewを適用し、実改行、記事見出し×URL、ゲスト固有リンク、収録文脈保全、広告削除範囲、idempotency、candidate SHA256を検査。結果は `CONTENT_PASS | HOLD` で個別報告。長文の報談は短文型と独立の回帰検査。
6. `EP-00160/EP-00161`（AJW）は公開対象外、テストのみ。466件Megaphone全体への一括書込は禁止。

## P1：未完品質項目
7. Spotify/Pocket Casts12セルは外部プラットフォームの配信episode同一性未確認でHOLD。HTTPの取得失敗をリンク切れと判定しない。
8. 機械構造検査150件と意味品質150件を明確に分け、V/W/X/ACの要点・記事リンク・出演者・番組文脈に基づく未完の意味品質検査を進める。
9. W差分の蔵人・宇宙LABへの将来連携は出典、旧/新SHA256と保持リンクを付す。109件承認、公開5848件、既存AI原本を変更しない。

## 次回報告
A. ACLが取得できた/できない別経路の具体的証拠・停止理由、B. 清掃5件の候補ごとの品質結果、C. 12セル・150件の継続ステータス、D. GitHub repo/branch/path/commit。main/Pages、台帳本番/COPYセル、GAS/トリガー、Spotify、おんさ原本への実書込は禁止。
