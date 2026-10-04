# 最新配信日：毎朝巡回・毎時補植の接続レビュー

対象：`AutoUpdateAutomationV1.js`。この文書はレビュー用であり、本番コードの接続・デプロイを意味しない。

## 毎朝 `syncRecentManagedAutoPlaylistV1_`

- `getAllSpotifyPlaylistItems_(rule.playlistId, token)` の戻り値を `existingItems` として保持し、URI集合を作る（現状は `new Set(getAll...map(...))`）。
- `missing.length === 0` の早期 return より前に、既存収録回を使って `reconcilePlaylistLatestDateFromSpotify_(rule.playlistId, token, existingItems)` を呼ぶ。Spotify追加が0件でも最新配信日を確認する。
- 追加成功時は、**追加前の** `existingItems` だけでは新規回が含まれない。追加成功後にプレイリストを再取得して照合するか、成功した追加回の実際の `release_date` と既存回の最大値を合わせてから単調増加ライターに渡す。再取得する場合は API 負荷と失敗時の通知を考慮する。
- `failedCount > 0` の既存エラー処理を維持。`rule.updateLatestDateOnAdd` に依存して連載の最新日が欠落しないようにする一方、固定ルール以外への意図しない書込拡大をレビューする。

## 毎時 `syncAutoUpdateSeedBootstrapV1_`

- `existingUris` を作るときの取得結果を `existingItems` に保持する。
- `addResult.failedCount > 0` の既存停止処理を維持。
- `remainingCount > 0` の早期 return **より前**に、追加成功分を含む実収録回から日付を照合する。古い回50件の補植で、既存の新しい配信日を巻き戻さない。
- `remainingCount === 0` の完了経路でも同じ照合を実施し、二重の書き込みはしない。
- 候補収集段階（`states.some(...complete !== true)`）は追加0件なので、日付確認の必要性と Spotify API 負荷を別途評価する。

## テストと承認ゲート

1. 毎朝：新規0件でも既存収録回の最新日が反映される。
2. 毎朝：追加成功後の新規回を含む最新日が反映される。失敗時は既存のエラー通知が維持される。
3. 毎時：残件あり・最大50件補植後でも日付を照合する。古い回のみなら日付は後退しない。
4. 毎時：補植完了時も照合し、追加0件なら日付を捏造しない。
5. 読取失敗時は既存値を維持し、書込失敗は呼出元に通知する。正確な playlist ID の行だけ更新する。
6. モックテスト・差分レビュー後、明示的な承認なしに `main` マージ、GAS push、トリガー変更、Spotify/Sheet 本番書込、デプロイをしない。

**現状：本体の接続未実装、上記テスト未実行。**
