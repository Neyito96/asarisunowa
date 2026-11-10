# 朝リスの田 高速V2 運転記録（2026-10-16）

## 正本と履歴
- Googleスプレッドシート「朝リスの田｜独立エピソード図書館・調査台帳 2026-10-10」ID: `1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4`。**現在のオンライン台帳が正本**。2026-10-10版スナップショットは参照用であり、上書きしない。
- 既存の「自動補完・実行履歴」と「図書館・進捗ダッシュボード」を維持。新規の監査表に置き換えない。
- 既存の「人間除外」「固定ID採番履歴」を尊重し、空欄のみ補完。RSS GUIDとSpotifyエピソードIDは別。

## 18:10 読み取り専用品質監査（実測）
- 全6591件。Spotify URL空欄166、音声URL空欄5555、概要原文空欄390、出演者空欄639、GUID空欄5317。
- URL存在は音源再生・Spotify採用可否を保証しない。概要原文の存在は清掃完了を意味しない。
- 18:11 音声先頭10件へのRangeリクエストは10/10でHTTP 206。全体の代表サンプルではない。
- 「北欧」テーマで検索に一致しても音源不在のページがあった。実際の不在件数が100未満というのは未検証の仮説。

## 18:14–18:20 統合V2運転・停止
- 18:14:36 `installLibraryV2UnifiedFast`: enabled=true, triggers=1, conflicts=[]。
- 18:15:48 / 18:16:45 / 18:18:28 に `scheduledLibraryV2UnifiedFast` が重複起動。
- 18:19:36 `stopLibraryV2UnifiedFast` 完了。先行処理は止めず、以後のトリガーを削除。
- 18:15:48開始分は203.182秒で完了、後続2本は約361秒でタイムアウト。
- 実行履歴シート: 18:17:58 GUID 10件10セル、18:18:42 V2メタデータ80件177セル、18:20:16 GUID 10件10セル。**合計197セルは履歴上の書込件数**。タイムアウト分の部分書込や台帳との整合性は未監査。
- ダッシュボードには直近20件の実行履歴を表示。日付がシリアル数値表示されるセルがあるため表示形式は要修正（データ値を改変しない）。

## 安全な再開の条件
1. GASで `previewLibraryV2UnifiedFast` を実行し enabled=false / triggers=0 を確認する。
2. 18:17–18:20の履歴3件について、更新EP-IDと台帳セルの現状を突き合わせる。タイムアウト分の部分書込を確認。
3. 統合コントローラーを修正: **全体排他制御**（下位のScriptLockと競合しない方式）、重複起動スキップ、時間予算、RSS重複取得削減、処理の分割。旧版は再インストールしない。
4. 修正版をGASへ反映後、読み取り専用→手動小規模テスト→単一トリガーで再開。
5. 出演者の根拠付き補完、概要欄の清掃、音声URL到達性、Spotify個別ID照合、プレイリスト採用ゲートは未完成。完了扱いしない。

## 図書館からSpotifyへの正しい処理順
初回投稿（シリーズ・出演者・テーマ）→図書館検索→出典・音源・Spotify IDの品質判定→照合済み候補のみSpotifyプレイリスト登録→RSS新着を図書館に差分追加して自動育成。問題のある候補は保留し、他の正常候補まで止めない。

## 関連コード
- `scripts/google-apps-script/LibraryV2ContentAudit.js`
- `scripts/google-apps-script/LibraryV2UnifiedFastAutomation.js`
- `scripts/google-apps-script/LibraryMetadataBackfillV2Writer.js`
- `scripts/google-apps-script/LibraryV2OmnyClipGuidPilotWriter.js`

この記録は運用ログであり、コードのGAS本番反映や運転再開を意味しない。
