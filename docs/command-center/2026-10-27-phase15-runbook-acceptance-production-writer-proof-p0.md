# 司令塔｜Phase15 本番復旧RUNBOOK受入・writer実コード証明P0指令
2026-10-27 JST / READ_ONLY、GitHub監査保存のみ。

## 監査原本
`audit/phase15-production-recovery-runbook-20261027/docs/command-reports/2026-10-27-phase15-production-recovery-readiness-and-runbook.md` 提出コミット `46786749f7bd8d0e31935950fa0093af4768327f`、司令塔確認GitHub blob `b511c1f659a35cc54f7091449adaa2fa0bce1f5b`。RUNBOOK/GO-NOGO受入。実装や本番実行は未承認。
確認済：本番最終 EP-06632こどもそうだんしつ GUID a07f0210-b98d-4e6d-9d21-b4c9005ccdfc。COPY EP-06632 MEDIA TALK GUID 45dbe89c-d322-4c18-864b-b4ea006173e3で衝突。COPY5件native rowHash/V3整合5/5。対象本番GAS表示trigger0、COPY側2/06:15タイムアウト。正式writer未特定、RSS総未収蔵数SOURCE_PENDING、提案新EP-ID=null。

## 今回のP0（反復設計をやめる）
1. **本番オンライン** Apps Script `朝ポキ｜本番ロボGAS` のエディタでプロジェクト全体検索：`SpreadsheetApp.openById(`, `appendRow(`, `setValues(`, `エピソード台帳`, `固定ID採番履歴`, `図書館V3・項目状態`, `phase14Production`, `ScriptApp.newTrigger`。検索の結果、該当ファイル名/関数名と前後のコード、参照される具体的Spreadsheet IDをREAD_ONLYで記録。候補が多ければ、台帳の新規row appendをする関数に絞る。
2. writerの証拠条件：**entrypoint → called functions → production spreadsheet target → EP-ID allocation/history reservation → ledger write → V3 proof → completion**を原典コードで一貫して裏付ける。 `P14_PROD_LEDGER_ID`定数やREAD_ONLY shadow関数があるだけではwriter確認にならない。
3. 本番候補が見つからない場合、`WRITER_NOT_FOUND`のままとし、最後に確認したオンラインGASプロジェクト名、プロジェクト検索結果、存在した候補関数、足りない画面の一覧を一度で示す。ユーザーへは**最小の次の1操作だけ**を具体的に案内（Macブラウザでエディタ検索、実行不要）。検索失敗を全GAS不存在と断定しない。
4. 本番とは別のGASのwriter/トリガーの存在も調べる。異なるプロジェクトの`getScriptLock`は共有されない。全writer洗い出し前にEP-ID採番やtrigger追加をしない。
5. writerが確認できた場合のみ、本番台帳/採番履歴の既存GUID/IDと照合したNO-GO差分表を更新。現時点で新正式IDはnull、COPY EP-ID転記禁止。本番EP-06632既存行を保護。
6. 公式RSS7番組＋旧SDGs当日差集合のSOURCE_PENDINGは並行追跡。XMLが取得不能な場合、五つのCOPY候補不在と当日総数不明を維持。既に合格した5件のハッシュやRUNBOOKの繰返し作成は不要。
7. ソースを得たら「本番writer実証票」（関数名/ファイル名/入口/呼出関係/接続先/書込対象/採番履歴/V3、VERIFIED/PENDING）をGitHub監査ブランチ `docs/command-reports/`に保存しコミット報告。できればスクショで関数ソースを裏付けるが、credentialなどの秘密を公開しない。

## 禁止事項
本番/COPY台帳、V3、採番履歴、GASコード、トリガー、Properties、main、Pages、「朝ポキの蔵」「朝リス宇宙」への書込・実行は0件。バックアップ作成・本番1件登録・時間トリガー有効化・公開は別途ユーザー承認。今回のGO/NO-GOはNO-GOを維持。
