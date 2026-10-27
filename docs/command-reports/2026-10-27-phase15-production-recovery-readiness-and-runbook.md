# Phase15｜本番自動収蔵・復旧READ_ONLY手順書とGO/NO-GO（未実行）
2026-10-27 JST。司令塔指令 commit `7d80378ffd2d155a7bf01034a3d95791cae974d2` 全文確認。**本書は実行承認ではない。**

## 1. 実機監査の到達点
本番 Sheet `1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4` の `エピソード台帳` 最終行6633、末尾 EP-06632 `こどもそうだんしつ` GUID `a07f0210-b98d-4e6d-9d21-b4c9005ccdfc` は今回のLIVE READ_ONLY再取得で確認。採番履歴シートの存在も確認。ただし全履歴の最新末尾重複・予約照合は未完。
COPY `1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY` の EP-06632は`MEDIA TALK` GUID `45dbe89c-d322-4c18-864b-b4ea006173e3`。両者は別エピソード。COPY 5候補 EP-06632..06636は原生型ハッシュが5/5一致したが、これは本番登録許可ではない。過去の本番6632行全照合で5件GUID不在、ただし公式10/27未収蔵**総数は不明**。
GitHub default-branch search `phase14ProductionRss` 0件、`SpreadsheetApp.openById` は他のコードにヒットするがONLINE「朝ポキ｜本番ロボGAS」の実体との同一性を証明しない。プロジェクトトリガー表示0（過去の画面時点）。**production writer: WRITER_NOT_FOUND/NOT_VERIFIED**。COPYはオンラインV19→V18→`LibraryOfficialEngine` との関係確認済。

## 2. P0 writer/採番責任の証拠チェーン（READ_ONLY）
対象：「朝ポキ｜本番ロボGAS」、Apps Script editor。Ctrl/Cmd+F（プロジェクト検索があればそちら）で `openById(`, `appendRow(`, `setValues(`, `insertRows`, `固定ID採番履歴`, `エピソード台帳`, `図書館V3・項目状態`, `RSS`, `phase14Production`, `ScriptApp.newTrigger` を検索。候補ごとに実ファイル/関数/呼出入口/呼出先/本番Sheet ID（上記）/採番history write/ledger append/V3 write/実行モードを列記し、完全な経路が見つかるまで `WRITER_NOT_FOUND`。Shadow/READ_ONLY関数、単なるID文字列とwriterを混同しない。プロジェクトのトリガー画面で handler、所有者・他アカウントの可視性を記録。他プロジェクトにもwriterがあり得るため「この画面で0」≠全体0。
採番authorityを1つのGASプロジェクトに限定し、他writer・時間トリガー・手動起動を凍結/除外したことを別途実証する。 `LockService.getScriptLock()` は**異なるApps Scriptプロジェクト間で共有されない**。運用の単一writer、もしくは全writer共通の外部排他・状態管理が立証できなければNO-GO。単独スクリプト内では同一Lockと採番履歴で直列化。新しい正式EP-IDは承認まで `null`。本番既存 EP-06632を保護。

## 3. 最小安全修正仕様（LAB提案のみ）
- `FAST_RSS_SHADOW_V2`: 7公式番組×最新3をREAD_ONLY監視。登録範囲とは別。
- Full ingestion: 公式7番組の新着をGUIDと音声URL/公式URLで収集し、必要なら既存期間の未収蔵を遡及する。旧SDGsは方針決裁待ち、AJW/アルキキ/YouTube除外。RSS失敗は `SOURCE_PENDING`、ゼロと扱わずfeed単位の時刻/応答/件数/次カーソルを保存。
- Timer deadline = runner起動直後の単調時間起算。GAS 6分強制終了より余裕のある例：300秒のソフト停止、残り45秒以下なら**新たな登録を開始しない**。実行環境の制限はテストで確定する。fetch/parse/全台帳読込も全時間予算に含める。
- 取り込み候補はfeed別に進捗、失敗時は `SOURCE_PENDING` と継続候補を維持。`feed+GUID`と公式URLと音声URLに対して全履歴/ledger/V3重複検査。候補の存在を読んだ後、ロック取得後に再検査しなければ競合可能。GUID同一なのに内容が異なるときはSTOP。
- 新規採番は本番履歴内のMAX EP-IDから単一authorityで行い、reservedを記録してから台帳。COPY番号を絶対使わない。
- `RESERVED`→`LEDGER_WRITTEN`→`V3_VERIFIED`→`COMPLETED` 各ステップに再照合可能なproofを残す。過去の `RESERVED` 再開時は必ず履歴・実台帳・V3と照合して**同じGUID/同じ本番EP-ID**を再利用、未完の状態で新IDを再採番しない。途中失敗で可逆性が不明ならHOLD、人による確認。破壊的な自動ロールバックはしない。
- 受入値 native 55-cell `rowHash` とV3 proof、原GUID・URL、行番号と採番履歴を照合。全RSSの網羅を証明するまでは未収蔵総数を確定させない。

### LAB用疑似コード（実行禁止）
```text
start = monotonic_now(); deadline = start + SAFE_BUDGET
assert single_writer_authority_verified && production_target_verified
assert backup_restorable && explicit_registration_approval
for feed in enabled_official_feeds:
    if near(deadline): persist_checkpoint_and_stop()
    result = read_rss(feed)                 # failure: SOURCE_PENDING, not empty
    checkpoint.feed_status = observed_status
    for item in result.unprocessed_items:
        if near(deadline): persist_checkpoint_and_stop()
        with same_project_lock:
            recheck_GUID_URL_and_history()
            if conflict: FAIL_CLOSED
            if existing_completed: mark_seen_only; continue
            if existing_reserved: resume_that_same_EP_ID
            else: reserve_next_id_in_PRODUCTION_history_only
            append_or_verify_ledger_row()
            verify_native_55_cell_hash_and_V3_proof()
            mark_history_completed()
        persist_checkpoint_after_proof()
# never commit partially validated counts as complete
```
Checkpointの永続化先と書込主体、タイムリミット付き状態機械は**未実装**。これは実装案であり現行GASの能力ではない。

## 4. 復旧RUNBOOK（すべて現在は未実施）
1. 安全確保とREAD_ONLY棚卸し：本番・COPYの実ID、全writer・トリガー・所有者・ScriptProperties、全6,632台帳GUID/URL/最大IDと採番履歴/V3の予約残を再スナップショット。
2. 復旧可能バックアップ：採番履歴、台帳、V3、スクリプト版/設定、トリガー一覧を時点固定しハッシュと復元手順を保管。**実際の作成は別承認**。既存値を上書きしない。
3. LABのみで合成回帰：二重GUID、COPY ID衝突、タイムアウト/途中状態、XML 500/ネットワークエラー、競合二重実行、既存RESERVED再開、古い公式feed大量items、7 feed分岐、旧SDGs除外のテスト。
4. READ_ONLY shadow：7番組×最新3観測と全収蔵との差を別集計。全公式RSSの取得成功前は `SOURCE_PENDING`。
5. writer一本化・採番主権の実証：他writer/trigger排除、運用承認、責任者を指定し、複数project lock非共有を回避。
6. 別個のユーザー**登録承認**後のみ、既知COPY候補5件について公式GUIDの再検証・本番GUID/URL再検索・本番採番ID決定を行い限定1回で検証登録。5件の全日網羅と誤認しない。
7. 本番readback：55列native hash/V3 proof、採番完了/予約残、GUID/URL重複0、既存本番EP-06632不変を監査。エラーなら即停止し状態保持、再採番しない。
8. 別個のユーザー**GAS修正/トリガー承認**後のみ稼働化し、実際の1サイクル停止再開を監視。自動化の性能と6分内終了を証明する。
9. 別個のユーザー**公開承認**後のみ蔵/宇宙の掲載対象判定と公開に進む。

## 5. GO / NO-GO 判定
| gate | current status | necessary evidence to become VERIFIED |
|---|---|---|
| production_writer_source | **STOP** | ONLINE source filename + entry→call→ledger append proven |
| target_sheet | **PENDING** | writer `openById` equals 1lLg... and names A:BC/history/V3 |
| other_writer_excluded | **STOP** | all projects/accounts trigger writer scan and disable/segregation approval |
| EP-ID_authority | **STOP** | exactly one allocator/lock authority, history+ledger audit, collision quarantine |
| GUID_identity | **PENDING** | five known GUIDs confirm independent official source and absent from live prod rows |
| RSS_source_coverage | **STOP** | date-scoped official 7-feed XML complete GUID/pubDate and explicit old SDGs policy |
| time_budget | **STOP** | LAB runtime budget covers fetch/parse and before append; proof safe stop |
| resume_test | **STOP** | 6-minute synthetic interruption/retry + RESERVED integrity PASS |
| rollback_snapshot | **STOP** | restorable pre-write backups plus verified restore procedure |
| manual_approval | **STOP** | distinct registration, GAS/trigger, public update permissions |

Overall **NO-GO**. No production writes authorized. `KNOWN_COPY_CANDIDATES=5` and `TOTAL_OCT27_MISSING=UNKNOWN` distinctly recorded. All non-GitHub writes=0.
