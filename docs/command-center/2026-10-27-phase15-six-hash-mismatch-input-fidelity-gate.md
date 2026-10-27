# 司令塔｜Phase15 6件ハッシュ一次不一致の受入・入力忠実度監査指令
2026-10-27 JST｜READ_ONLY / GitHub監査文書のみ更新可。

## 出典と受入
提出 `audit/phase15-hash-sixrow-recalculation-20261027/docs/command-reports/2026-10-27-phase15-sixrow-hash-first-offline-results.md`、commit `158bbc638ab79012c8fecd7d1eb2971d0d68cff6`、司令塔直接確認blob `c10b3e8873c110d364b2193719c413112f31bf08`。
COPYのEP-06632〜06636、EP-06594計6件、Sheets APIの値をnull→空文字、末尾空欄を55列まで補う処理を行い、SHA256/UTF-8/base64urlで算出。計算値は保存証拠と0/6一致。ただし入力がオンラインApps Script`getValues()`の原生配列と同一か未確認。全件 `HOLD_INPUT_RECONSTRUCTION`、破損確定0件。標準検証ベクトル成功は暗号計算器の正常性だけを示す。
EP-06594の10/24 currentRowHashは過去スナップショットであり、現在55列の比較不一致を登録時改変の証拠にしない。

## 最優先 P0：55列入力の再現性を段階検証
1. オンラインV18/V3の`rowHash`、`v3RowHash`呼出部分を**READ_ONLY**で確認し、`getValues()`の範囲A:BC（55列）、対象行が書込前/直後/補填後のどの状態だったか、配列を`slice`/map/変換していないか記録。保存先のV3フィールドと実際のハッシュ関数を結ぶ。どの段階のハッシュかを最初に同定。
2. Sheets connectorの`FORMATTED_VALUE`/`UNFORMATTED_VALUE`とDateTime render options、Apps Script`getValues()`のJavaScript Date型差に注目。D列等の日時がISO UTCとしてJSON.stringify(Date)されるのか、文字列なのかを検証。タイムゾーン Asia/Tokyo・表示文字列・数値シリアルを混同しない。
3. 検査の順序：まず1件EP-06632に限り、正確な55要素入力を再構成して保存V3 hashとの照合を狙う。各列の`value type`とtimestamp正規化、空欄数・null/""・末尾要素、真偽/数値/文字列を列ごとに差分表化。丸めや任意の値の総当たりで偶然一致を探すのではなく、実コード・API仕様に裏付けされた候補だけを計算。
4. EP-06632の再構成ルールがコード根拠を持って確定した場合に限り、EP-06633〜06636へ水平展開する。EP-06594は10/24保存snapshotに一致する同時点の値が無ければ `HISTORICAL_SNAPSHOT_UNAVAILABLE` とし、元登録時証拠欠落を埋めない。
5. 保存hashと不一致の場合は入力未再現・日時変換・保存後編集・ハッシュ対象配列の別定義を区別し、具体的根拠が揃うまでHOLDのまま。ハッシュ/データ上書きなし。
6. 本番GAS writer入口の特定、公式RSS 10/27全番組XMLと本番との差集合は別P0として継続。RSS取得失敗はSOURCE_PENDINGであり新着0件と認定しない。

## 成果物
最初に **1件EP-06632の55列型差分表とハッシュ入力決定根拠** を保存。可能なら再現成功/失敗の検証結果、残り5件の展開計画と日時/履歴制約を提出。GitHub監査ブランチの `docs/command-reports/` に commit付きで提出。

## 安全
本番EP-06632保護、COPY側EP-06632〜06636を本番へ流用しない。GASコード編集/実行、trigger/Properties修正、COPY/本番台帳・V3・採番履歴への書込、公開変更を全て禁止。LABでのオフラインハッシュ計算とREAD_ONLY資料保存のみ。
