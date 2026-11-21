# Phase 14｜コピー台帳 6,591件の掲載判定・READ_ONLY 実機検証

更新: 2026-10-23。作業ブランチ: `feat/phase14-official-gas`。**本番書込・コピー台帳への実台帳書込・トリガー再登録は禁止**。

## 接続先
- コピー台帳: `1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY`
- 本番台帳（今回は変更禁止）: `1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4`
- GAS: `1roni6h_C9vKxtP_2I6jGgXKE2KJ1yRRhE3ZD1JsZ6XXRnT5RcndqyfJo`
- 修正ソース: `scripts/google-apps-script/LibraryOfficialNative.gs`（GAS側にはまだ未反映）

## 接続済みGoogle Sheetsで確認済み（GASでは未実行）
コピー台帳 `エピソード台帳!A2:A6592` と `図書館・宇宙 検索対象判定!A2:D6592` を読み取り照合:
- 台帳行数 6,591、判定行数 6,591、ユニークEP-ID 6,591、欠落0、重複0
- D列「宇宙検索対象」: 対象 5,848 / 対象外 377 / 保留 366
- 本番・コピーへの書き込み0

## GAS側で行う次の一回限りの検証
1. 上記修正ソースをコピーGASへ反映（既存コードはバックアップ）。`LibraryOfficialEngine` の依存コードを残す。
2. スクリプトプロパティ `LIB_OFFICIAL_NATIVE_CONFIG` を**READ_ONLY**で設定。既存の試験設定を控えてから変更する:
```json
{
  "sheetId": "1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY",
  "ledger": "エピソード台帳",
  "states": "図書館V3・項目状態",
  "scopeSheet": "図書館・宇宙 検索対象判定",
  "enabled": true,
  "write": false,
  "batchSize": 20,
  "budgetMs": 120000,
  "feeds": []
}
```
3. 関数 `verifyLibraryOfficialNativeScopeReadOnly` を**手動で1回**実行。期待値: `SCOPE_PREFLIGHT_READ_ONLY`, rows=6591, adopted=5848, excluded=377, held=366, writes=0, officialFetches=0。
4. この段階で `scheduledLibraryOfficialNativeBackfill` はまだ実行しない。前回fixture用カーソルのtargetと実台帳のtargetが異なるため `CURSOR_TARGET_CONFLICT` が予想される。専用の安全なカーソル初期化が必要。既存のカーソルを無断削除しない。
5. 時間トリガーは作成しない。新着エンジンも実行しない。

## 未解決
- 既存コピー台帳のチップ・保護・既存非空セルの保持証明が未完成。実台帳への `write:true` はコードが拒否する。
- 全件補完の失敗行を再試行する保留キュー、カーソルの安全な切替・復旧、状態シートとの整合を追加検証する。
- 新着登録は `REGISTRATION_BLOCKED_NONATOMIC`、EP-ID採番・登録未実装。
- SDGs 1,092件は公式JSONの別経路で扱い、RSS巡回の `feeds` には入れない。
