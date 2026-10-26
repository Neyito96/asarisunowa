# 2026-10-26 COPY DRY_RUN 事前スナップショット（READ_ONLY）

対象台帳: COPY。時点: 次の手動GAS実行前。範囲: エピソード台帳!A6628:BC6632, 図書館V3・項目状態!A6628:C6632, 固定ID採番履歴!A64:H69
ハッシュはJSON.stringify(UNFORMATTED_VALUEセル配列)をFNV-1a32で確認する軽量差分用チェックサム（暗号学的ハッシュではない）。

|EP-ID|台帳GUID|台帳checksum|V3 checksum|採番履歴checksum|
|---|---|---|---|---|
|EP-06627|08e40b40-d56b-4f22-be57-b4dc00603b13|96fce01e|9df523f1|27d92f94|
|EP-06628|24fc4a82-ceb4-11f1-8144-abc7c06c50b6|83de95d1|6bf12990|1dcb74f2|
|EP-06629|b0a84ffa-cebd-11f1-a5ab-17a6f304129c|e9747fc6|81bc29f3|c44f2a12|
|EP-06630|df9ffb68-6f44-45b1-9331-b4e2007caa71|b7c88c06|b97d3387|5244a8e4|
|EP-06631|f8906ca4-3861-4eb8-83b8-b4eb008e0422|9de2d4bf|916c3e39|bf8fd4a1|

GASトリガーの実際の前後件数とScriptPropertiesはGoogle Sheets APIから取得できないため未確認。後続の手動GASで画面・ログ確認が必要。既存環境に書き込みなし。