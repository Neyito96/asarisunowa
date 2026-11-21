# Phase 14｜COPY新着収蔵 実機受入記録（2026-10-24）

## 実機確認済み（ユーザー提供GASログ、コピー台帳読み戻し）

- 対象：COPY GAS `1roni6h_C9vKxtP_2I6jGgXKE2KJ1yRRhE3ZD1JsZ6XXRnT5RcndqyfJo`
- コピー台帳：`1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY`
- 本番台帳：`1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4`（未変更）
- 対象RSS：8本、直近7日間。アルキキ／AJW／朝ポキTVは除外。
- V16（過去データ誤登録）：EP-06595〜06597の3件は2020年MEDIA TALK。コピー台帳に要照合・要補完のノートを保存。V16関数は無効化。
- V17 1回目：EP-06598〜06600、3件追加、保留0。
- V17 2回目：EP-06601〜06603、3件追加、既存3、保留0。
- V17 3回目：EP-06604〜06606、3件追加、既存6、保留0。
- V18 1回目：EP-06607〜06616、10件追加、既存9、保留0。
- V18 2回目：EP-06617〜06624、8件追加、既存21、保留0。
- V18 再実行：`added:[]`、`held:[]`、`existing:29`。直近7日間の取得済みRSS候補は全29件登録済み判定。
- V17/V18の追加合計27件（コピー台帳）。EP-06594（別経路）とV16過去3件はこの27件に含めない。
- ログは毎回 `propertyWrites:0`、`triggerChanges:0`、`productionWrites:0`。登録行のハッシュ検証成功。
- コピー台帳のEP-06598〜06624は実際の読み戻しで確認（V3状態のVERIFIED含む）。
- 2026-10-24 20:27の最終V18ログ：`feedCount:8`、`existing:29`、`outOfWindow:6472`、`elapsedMs:1`（この値はRSS取得後の計測で、総実行時間ではない）。

## V19（GitHub実装、実機未検証）

- `phase14CopyMorningRunnerV19`：V18を呼び出して結果・失敗をログ化。
- `phase14CopyMorningTriggerStatusV19`：読み取り専用のトリガー確認。
- `phase14CopyInstallMorningTriggersV19`：ユーザーが明示的に手動実行した場合のみ、コピーGASプロジェクトID照合後、Asia/Tokyoで毎日05:15頃・06:15頃のトリガーを2本作成。GAS時刻は概算。
- `phase14CopyRemoveMorningTriggersV19`：V19のトリガーだけを削除。
- ソース貼付・保存、手動V19実行、トリガー設置、無人実行の受入は**まだ未実施**。
- 注意：V18はソフト締切180秒、RSS取得の時間は別。GASの実行時間上限・クォータ・ログ監視を実機で確認する。
- 注意：現状はRSS全候補を毎回読み直す。29件の再確認に約37秒（ユーザー実測）。規模拡大時は最適化検討。
- 注意：コピー台帳内の既存エピソードとの完全な意味重複照合、空欄補完（Engine B）、本番反映は未完了。実機受入と本番承認を混同しない。

## 次の受入手順

1. 最新ソースをCOPY GASの対象ファイルに貼付・保存（同名の二重ファイルに注意）。
2. `phase14CopyMorningTriggerStatusV19` を実行し、V19トリガーが0本と確認。
3. `phase14CopyMorningRunnerV19` を1回手動実行。候補に変更がなければ追加0、保留0、既存29を期待。
4. 実行ログ・コピー台帳を確認した後、ユーザーが承認した場合に限り `phase14CopyInstallMorningTriggersV19` を手動実行。
5. 翌朝の実行ログを確認し、異常時は `phase14CopyRemoveMorningTriggersV19` で停止。

## 参照

- Branch: `feat/phase14-official-gas`
- Source: `scripts/google-apps-script/LibraryOfficialRssEngine.gs`
- V18 commit: `e4dbc6dc61741754ff5488363ef1102a4093bbd1`
- V19 commit: `f3a05e50c75fccae292aadf922801fc0a0d5a558`


## 2026-10-24 20:39〜20:45 JST｜V19実機試験と時間トリガー設置

ユーザー提供のCOPY GAS実行ログにより、以下を確認。

1. 20:39:06 `phase14CopyMorningTriggerStatusV19` 実行完了：`{"mode":"PHASE14_COPY_TRIGGER_STATUS_V19","count":0,"handlers":[],"triggerChanges":0}`。設置前のV19トリガーは0本。
2. 20:40:12〜20:42:00 `phase14CopyMorningRunnerV19` 手動実行完了。内部V18ログは `feedCount:8`, `added:[]`, `held:[]`, `existing:29`, `propertyWrites:0`, `triggerChanges:0`, `productionWrites:0`, `outOfWindow:6472`。V19ログは `status:"OK"`, `added:0`, `existing:29`, `held:[]`, `productionWrites:0`, `triggerChanges:0`。開始 `2026-10-24T11:40:13.204Z`、終了 `2026-10-24T11:42:00.349Z`（約107秒）。
3. 20:45:17〜20:45:21 `phase14CopyInstallMorningTriggersV19` 手動実行完了：`{"mode":"PHASE14_COPY_TRIGGERS_INSTALLED_V19","count":2,"timezone":"Asia/Tokyo","hours":[5,6],"productionWrites":0}`。COPY専用の時間トリガー2本の設置が報告された。予定は毎朝05:15頃、06:15頃（GAS時刻は概算）。

**未確認**：設置後の `phase14CopyMorningTriggerStatusV19` 再実行（`count:2` の読み戻し）、翌2026-10-25朝の自動起動と実際の収蔵結果。設置成功ログを無人実行成功と取り違えない。

**本番への変更**：ユーザー提供ログ上は `productionWrites:0`。本番台帳への反映・公開・Spotify更新・Engine Bの空欄補完は実施していない。

**次回確認**：設置後のトリガー数2本、翌朝の「実行数」画面とログ、COPY台帳の新着追加数・保留数、二重登録の有無。問題時は `phase14CopyRemoveMorningTriggersV19` によるV19トリガーのみの解除を検討。
