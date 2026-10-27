# Phase 15 第8次 READ_ONLY監査報告｜ACL代替経路と清掃5件
司令塔指令: `d439c915cf21f16835029486a5c4de0eed57592e`。
**本番/COPY/GAS/トリガー/公開実書込0。**

## 1. ACL代替確認方法（実行前計画）
現行Google Drive接続のget_spreadsheet_metadataではprotectedRanges/editorsのフィールドが返らないことが既知のため同一リクエストの再試行なし。ACLの実証は依然できず `STOP_ACL_UNKNOWN`。
A案（推奨）：COPYアクセス権のあるGoogle認証主体からGoogle Sheets API v4の `spreadsheets.get` をGETで呼ぶ。URL：
`https://sheets.googleapis.com/v4/spreadsheets/1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY?fields=spreadsheetId,sheets(properties(sheetId,title),protectedRanges(range,description,warningOnly,editors))`
OAuth scopeとして `https://www.googleapis.com/auth/spreadsheets.readonly` を持ち、その認証主体の権限で応答を読む。対象 sheetId=806280644、タブ=エピソード台帳。全体保護の範囲、非保護例外、warningOnly、editors/users/groups/domainUsersCanEdit の有無を調査。保護が返らない場合は principal、scope、fields mask と保護情報可視性を切り分け、保護なしと即断しない。権限や認証トークンをGitHubへ記録しない。GASの新規実行・配備禁止。
B案：COPYをブラウザで開き、「データ」→「シートと範囲を保護」のサイドバーでシート全体と保護範囲を一覧化。各保護の範囲/例外/編集可能者を閲覧しW82,W83,W94に適用されるか突合。記録は確認者/時刻/アカウント権限/対象範囲/例外/警告のみ/編集可能者（不要な個人メールは外部公開しない）。画面閲覧だけではAPIの完全実証に準じるとは限らず、曖昧ならSTOP。
権限を得た後もCOPY実書込には司令塔・ユーザーの別途明示承認が必須。

## 2. 清掃5件 DRY_RUN
JSON証拠: `docs/command-reports/2026-10-27-phase15-five-cleaning-dryrun.json`。
EP-00411/00412/00413/00414（ニュースの学校）、EP-00121（報談）の本番VをライブREAD_ONLYで再読してGitHubスナップショット原文との文字列一致5/5、SHA256実算5/5、W空欄5/5。候補WのSHA256記録5/5、literal backslash-n除去5/5、idempotency5/5、記事URL基底部保全（学校各1・報談3）5/5。
**レビュー上の留保:** URL検査は記事URLのクエリ・HTML entityを含む元表記の完全比較ではない。先行JSONの `loss_of_nonpromo_urls` は生URLに `&nbsp;` が含まれ誤検知するケースがある。ただし報談の出演者/ゲストリンク、番組固有の案内リンク、日付・肩書を単純な広告削除ルールが保持したかは独立意味監査が必要。`HOLD_SEMANTIC_REVIEW` 5件。特にEP-00121は長文を短文清掃器で消去してよい内容と広告の境界が不明瞭。記事見出しとURLの原文対応、ゲスト固有URL維持、収録日時に対する可読性を総合検証するまでCONTENT_PASS不可。
AJW EP-00160/EP-00161は `TEST_ONLY_EXCLUDED`（公開対象外）。466件一括適用禁止。

## 3. 未完タスク
- Spotify/Pocket Casts 12セル: platform episode identity + COPY ACL未確認、全HOLD、HTTP取得不可はリンク切れ認定としない。
- 150件: 機械構造検査は受入済み、150件すべての意味品質審査は未完。
- 公開5848件/人間承認109件/公開蔵と宇宙、V/W現値、GAS、COPY、本番、おんさ共同編集は不変。

## 4. 次の実行ゲート
1. ACL GETを認証主体を固定した権限ある経路でREAD_ONLY実行、保護有無ではなく対象セル適用を特定。
2. 学校4件は記事見出しと完全URL対応（query含む）を目視・機械併用で再判定。報談1件はゲストリンク・収録情報・告知の判定方針を独立に審議。
3. 内容PASS後にCOPY独立V SHA / W空欄 / ACL / 書式等の現値再読。司令塔別承認前に書込不可。
