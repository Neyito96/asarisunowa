# Phase 14｜新着収蔵の統合経路・2026-10-23

## 既存実装の確認

- **新着正式登録の候補経路:** `scripts/google-apps-script/LibraryOfficialRssEngine.gs` の `scheduledLibraryOfficialNew()`。RSS→Omny JSON→`material`→`newDecision`→Sheets `:batchUpdate` による台帳・採番履歴・状態の一括登録→再読込検証まで含む。EP-06592の成功方式を再利用する際はこの経路とPR #251の実装差分を照合する。
- **既存空欄補完の候補経路:** 同ファイルの `scheduledLibraryOfficialBackfill()`、およびコピー専用の `LibraryOfficialNative.backfill()`。公式照合・`plan` の共通ロジックを使用する。
- **使用禁止の未完成経路:** `LibraryOfficialNative.newScan()` は現在 `REGISTRATION_BLOCKED_NONATOMIC`。公式RSSの候補を調べるが、正式登録はしない。これを本番登録の完成実装とみなさない。

## 次の検証順序

1. PR #251でEP-06592が登録された正確な関数・入力・出力と `scheduledLibraryOfficialNew()` の差分を検証する。未照合のまま「統合完了」と宣言しない。
2. コピー環境で公式RSS・JSONの取得、重複GUID/UUID、既存ID予約、登録前後の再読込、途中失敗・再試行を検証する。
3. 既存6,591件の掲載判定と、新着EP-06592以降の未判定状態を分離する。新着も収蔵・補完の対象だが、公開対象とは自動判定しない。
4. READ_ONLY巡回と書き込み巡回のカーソルは別々に保持する。エラーは記録し、未処理の行を完了扱いにしない。
5. 実台帳、GAS、トリガーを変更する前に、実機でのコピー検証結果とユーザーの明示承認を得る。

## 未完了

PR #251とのコード差分照合、コピーGASでの一連の実機試験、タイマートリガーでの無人動作、本番適用は未完了。CI成功はこれらの代替ではない。
