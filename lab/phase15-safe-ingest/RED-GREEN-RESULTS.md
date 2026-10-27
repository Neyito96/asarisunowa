# Phase 15 LAB RED→GREEN 監査証拠（2026-10-27）
対象正式指令 commit `9e7008ae4b7feb451b4315e70820c09217b954f7`。対象 `lab/phase15-safe-ingest/` のみ。オンラインGASやSheetは変更していない。

## 修正前実行 RED
ローカルNode v22.16.0、旧 `engine.js` と同じ adversarial harness を組み合わせて実行。結果 **0 PASS / 7 FAIL**, exit code **1**。失敗ケース:
- 既存台帳あり・V3欠損→STOPせずスキップ
- history COMPLETED・台帳欠損→STOPせず
- history COMPLETED・V3欠損→STOPせず
- RSS並び替えで先頭へ新GUIDが加わった→登録件数2のまま
- history同ID重複→STOPせず
- V3 proof不一致→STOPせず
- history URL不一致→STOPせず

## 修正後実行 GREEN
- `node lab/phase15-safe-ingest/adversarial.test.js`: **7 PASS / 0 FAIL**, exit code 0。
- `node lab/phase15-safe-ingest/test.js`: **16 PASS / 0 FAIL**, exit code 0。基準テストの合成fixtureで既存COMPLETEDのV3/URL整合性を明示し、新ルールに合わせた。

## 実装の差分
- 重複EP-ID/GUID、history↔ledger、V3 proof、COMPLETED整合性をrun開始時および新規処理直後に検査し、矛盾ならSTOP。
- ledgerありhistoryなしの旧行は、V3 proofがそろった場合に限り安全に既存扱い。それ以外は STOP/HOLD。
- 各feedの配列indexは再開位置として使わず、観測できた全GUIDを毎回再検査。順序変更での新着スキップを防止。
- history URL変更、同一ID衝突を fail closed にし、矛盾時は当該checkpointを進めない。
- 合成メモリ上の予約/台帳/V3/完了状態と中断後再開は維持。

## 未解消の実機ゲート
実際の複数GAS writer間ロック、共有永続checkpoint/atomic transaction、登録時55列native SHA256、公式RSSの網羅性、オンライン本番writer、ユーザー本番承認は未証明。完全な外部排他を模擬できていない。**本番NO-GO**。本番EP-06632保護、COPY ID転用禁止。GAS/Sheets/Properties/triggers/公開への書込0。
