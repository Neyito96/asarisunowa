# 本番プレイリスト自動更新：06時通常＋15時ライト版（設計・未適用）

関連: [Issue #227](https://github.com/Neyito96/asarisunowa/issues/227) / [READ_ONLY原因調査](../no-mirai-20261017/README.md)

## 要件
- 朝06時台: 既存 `runAutoUpdateAutomationV1` を1回（日次）実行。現在の4時台から移動する設計。
- 15時台: 固定連載の**最新20件差分だけ**を走査する新しい公開ハンドラーを1回（日次）実行。初回補完、申請処理、テーマ、全履歴走査は実行しない。
- GASの `atHour(6)` / `atHour(15)` はその時間帯を指定するだけで、06:00/15:00ちょうどを保証しない。JSTタイムゾーンの実GAS設定を要確認。
- #9の配信は2026-10-17 06:35 JST、当日04:38の旧巡回後。新案では15時台のライト版で拾う想定。ただし認証付きSpotify API応答や本番の実行状況は未確認。
- タイトルは `ノーミライ` OR `農MUSIC` OR `猟LIFE`、番号・括弧・位置は問わない。既存Show IDを維持。
- 本番適用は**別途明示承認**が必要。

## 現行コードの重要箇所
`scripts/google-apps-script/AutoUpdateAutomationV1.js`:
- `installAutoUpdateAutomationDailyTriggerV1` は既存日次トリガーを削除して `atHour(4)` で再設置する**書き込み関数**。調査時に呼ばない。
- `runAutoUpdateAutomationV1` は申請活性化→初回補完→申請同期→テーマ→固定連載同期の順。
- `syncDailyManagedAutoPlaylistsV1_` は固定7ルールを巡回。各ルールの例外は捕捉し、結果にkeyを付ける。
- `syncRecentManagedAutoPlaylistV1_` はShow最新20件→ルール判定→既存プレイリストURI差分→個別追加→latestDate更新。**Spotifyとシートに書き込むため、READ_ONLYのつもりで直接実行しない**。
- `runAutoUpdateBackfillHourlyV1` は新規申請/初回補完専用であり、固定連載の新着巡回は代行しない。

## 提案するコード構造（未適用）
```javascript
const AUTO_UPDATE_V1_LIGHT_HANDLER_ = "runAutoUpdateManagedLightV1";

// トリガーから呼ぶ公開関数。READ_ONLYではない。
function runAutoUpdateManagedLightV1() {
  // 固定連載だけを巡回し、必要ならSpotifyへ追加する。
  // 実行重複を防ぐロックを共有し、各ルールの追加結果を記録する。
  return syncDailyManagedAutoPlaylistsV1_();
}
```

実装時は、通常巡回との排他制御を確定してから共有ロックを導入する。既存の `processPendingAutoUpdateRequestsV1` 等のロックの取得範囲を調査し、入れ子でデッドロックしないこと。二重実行・人間削除・停止ルールを必ずテストする。

新しい**トリガー設置用関数**（未適用）は日次06時台1本、ライト15時台1本を管理する。既存の日次・毎時・直後実行トリガーの扱いを先に実GASで確認し、既存の `installAutoUpdateAutomationTriggersV1` が4時台に戻さないよう移行手順を整える。重複する時間主導トリガーを作らない。削除・再設置の前に既存設定のバックアップを取る。

## 診断ログ
通常/ライト共通で以下を記録:
- runMode=DAILY or LIGHT / handler / JST開始時刻
- ruleKey / showId / 取得件数 / キーワード一致件数
- 既存URI件数 / 新規候補ID / 追加成功・失敗件数
- Spotify取得HTTP状態と例外分類
- 最新日付更新の成否

認証トークン・Authorizationヘッダー・個人情報・RSS本文全文は記録しない。HTTP200でもitemsが非配列なら失敗として扱う。

## 必須の安全テスト（未実行）
1. 06時通常・15時ライトが各1回だけ起動すること。
2. 15時ライトで初回補完/申請/テーマ/全件取得が呼ばれないこと。
3. 06時に存在しない#9が15時に存在するとき1回だけ追加されること。
4. 06時で追加済みなら15時に追加0件となること。
5. 2つのハンドラーが重なった場合、重複追加が起きないこと。
6. 人間削除・除外・停止済みエピソードを復活させないこと（**既存固定経路の保護不足を先に監査**）。
7. 403/429/503、HTTP200不正items、Spotify部分失敗を成功扱いしないこと。
8. 日付はSpotify追加成功後だけ更新すること。
9. 既存毎時初回補完・テーマ・他6固定ルールの動作を変えないこと。
10. テスト後に本番のトリガー/Properties/シート/Spotify/公開サイトが未変更であること。

## 運用上の判断
15時ライト版はノーミライだけでなく固定連載7ルールを対象にする想定。ただしAPI使用量、日次実行時間、追加上限10件、共有ロック、除外保護を検証してから確定する。固定ルールでなく申請由来のプレイリストも15時に巡回する案は別途要件定義が必要。

## 状態
**設計資料のみ。** 本番GASのコード・トリガー・Properties、Spotifyプレイリスト、Googleシート、公開サイト、図書館V3、PRマージは未変更。
