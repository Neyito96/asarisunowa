# Phase15｜本番移行加速：指令受領・実シート再監査・安全ゲート（2026-10-28）
宛先：司令塔／補填・収蔵ロボ。指令：1cfd5aa98654ca7eb2

## 公式指令の確認
「COPYで同関数再実行0セル＋監査6件VERIFIED」「他writer停止と単一責任確認」の両方を本番の最大5行WRITEの前提とする。既存V/Wは不変。最初の5行に空欄候補がない場合はREAD_ONLYで次候補を探索。新規トリガー禁止。

## 今回直接確認したデータ
- COPY台帳 P15I_AUDIT A1:J7を読み、EP-00001 W/X/AT/AU/AV/AYの6件すべてstate=VERIFIED（6件）を確認。
- ただし同じp15iCopyTrialWriteの2回目実行ログは未提出。GASプロジェクトの現在のトリガー/他writer停止も外部ツールから直接検証できていない。COPY再実行は既存値を守る同一関数で一回だけ行いcounts全0を提出。
- 本番台帳のエピソード台帳 A2:BC21を独立READ_ONLYで確認。EP-00001〜00003はW既存値あり、X空欄。EP-00004はAW/AX空欄、EP-00005はAV/AW/AX空欄。従って最初の本番5行に更新候補が存在するが、出演者列にRSS原文から追加できるかは別途出典審査が必要。単なる空欄を更新可能数と見なさない。
- 公式取得経路のオンライン実機成功はユーザー提供13:23のRSS 8系統、計6518件、COPY1行6セルwriteとして確認済。公式JSONの今回実機成功なし。

## 本番対応の未達・実績区別
本番の今回の実書込: **0セル**。今時点で別プロジェクトwriter停止／COPY冪等性の二条件が未確認なため、独立したSheets API書込による実績の偽装やLockServiceを迂回する書込を行わなかった。
本番移行の次関数は一行のみ実行するp15iProductionSmallWriteだが、現行コードは5行処理・P15_PRODUCTION_APPROVED=YES・P15_OTHER_WRITERS_PAUSED=YES・P15_WRITES_ENABLED=YESのゲートが必要。司令塔の最大5行承認は条件付きで、スクリプト設定やwriter停止の証拠が必要。旧COPY GASに本番writeを許可したまま流さない。
本番GAS専用プロジェクトIDは未確認。COPY GAS https://script.google.com/home/projects/1roni6h_C9vKxtP_2I6jGgXKE2KJ1yRRhE3ZD1JsZ6XXRnT5RcndqyfJo/edit は既知だが、本番GASの代わりではない。

## 作業再開ゲート
1. COPY GASの関数 p15iCopyTrialWrite を1回だけ再実行し、counts全列0、holds0、対象EP-ID/GUIDの一致を確認。
2. 他書込者のトリガー一覧および手動実行状況をチェックし、運用上停止・単一所有者を証明。
3. 本番専用GASを特定し、コード/プロパティと差分確認。まず p15iProductionDryRun、本番最大5行write、その後本番A2:BC6再読込＆before/after照合。
4. 本番安定確認後に100行へ。713行目以降の大量W生成と既存W修正の混入を避ける。トリガーは未設置のまま。
