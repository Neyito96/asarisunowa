# Phase14｜本番GAS切替仕様（2026-10-25）
状態: 実装設計／本番GAS未配備／本番トリガー未設置

## 正本
- 正式台帳: `1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4`（エピソード台帳 sheetId `806280644`、V3状態 sheetId `386352623`）
- COPY: `1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY`（実験専用）
- 正式台帳には EP-06593〜06626 の新規34行と対応するV3状態34行を2026-10-25に移行済み。既存約5,848件の公開判定は変更なし。
- 移行直前バックアップ: `12VSV0uqEhXtjTYzFlxTYyabr71fzIGVnQpi77Obvsvs`。

## 重要な未解決点
1. 本番の `固定ID採番履歴` に移行34件の登録証跡があるか未監査。登録履歴とV3状態の整合が取れるまで本番の採番処理を有効化しない。
2. COPY V19の `phase14CopyMorningRunnerV19` は `phase14CopyIngestRecentTenV18()` 呼び出しで、実装はCOPY ID・Script IDに依存。IDのみ置換するコピーは不許可。
3. `scheduledLibraryOfficialNew()` に `PRODUCTION_NATIVE_WRITER_NOT_APPROVED` の明示的拒否がある。解除だけで運転開始してはいけない。
4. 本番GASの既存トリガー、Script Properties、GASプロジェクトID、他の書込者、採番履歴、認可は未確認。
5. COPYではV19朝5時台・6時台の実行が確認済み。2026-10-25朝5:11はadded=2、朝6:15はadded=0、双方status=OK／productionWrites=0というユーザー提供のApps Scriptログあり。既存トリガーを放置して本番を動かすと二重稼働になるため、切り替えは単一の停止→切替→確認手順とする。

## 構成案
既存エンジンをソースの基盤として維持し、本番専用GASプロジェクトに配備する。新しいファイル名は `Phase14ProductionEntrypoints.gs` とする。いわゆる `コピー.gs` の無条件コピーは禁止。
- `phase14ProdReadinessReadOnly()`: Script ID・本番固定ID・55列ヘッダ・EP-ID末尾・G列GUID・V3証跡・採番履歴・プロジェクトトリガーを読むだけ。書込0。
- `phase14ProdIngestOnce()`: 明示的本番承認、許可済みGAS Script ID、状態整合、排他ロック、他書込者停止、全RSS取得成否、シリアライズした採番履歴を必須とする。既存V18のCOPY固定ID呼び出しは禁止。
- `phase14ProdBackfillOnce()`: B1/B2を同じ排他ロックで実行。初期状態はDRY_RUNのみ。本番補完のトリガーは新着稼働の検証後に別途設置。
- `phase14ProdTriggerStatusReadOnly()`: 既存トリガーを列挙するだけ。初期状態で自動設置するコードを置かない。

## 移行の受入ゲート
A. 本番・COPY・移行前BACKUPの台帳を照合し、既存6,592行無変更、追加34行のEP-ID/GUID/55列一致を検証する。
B. 本番V3状態と台帳のハッシュをGASと同じ関数で照合。採番履歴をGUIDとEP-IDで照合し、既存履歴を壊さず必要34件の証跡を復旧する。
C. 本番GASのScript IDと権限、Script Properties、時間トリガー、競合書込者をREAD_ONLY監査する。
D. 本番のDRY_RUNで新規登録候補なし／重複登録なしを確認。新着登録候補がある場合、公式RSSと全履歴に対する重複照合。
E. COPYのV19朝トリガーだけを停止し、次に本番の1回手動登録／再実行0件を検証し、最後に本番時間トリガーを設置する。失敗時は本番を停止し、COPYの再開は復旧判断後に限定。
F. B1・B2は新着の本番動作安定後に別受入とし、数式/リッチテキスト/入力規則を保護する。

## 非変更
この仕様書のGitHub保存以外の書込操作はしない。本番GAS／COPY GAS／各トリガー変更0。現在の本番台帳への新たな変更0。
