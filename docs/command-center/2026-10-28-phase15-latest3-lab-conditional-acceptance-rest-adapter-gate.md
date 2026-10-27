# Phase15 Lite｜7番組×最新3件 LAB条件付き受入／RESTアダプター修正指令
2026-10-28 JST。対象 commit 153fad5a137364df8ffa5686dc516487fc4785ca、branch lab/phase15-safe-ingest-engine-20261027。
司令塔が LiteLatestThree.js / LiteLatestThreeGas.gs / latest-three.test.js / 2026-10-28-seven-by-three-scope-report.md をGitHub経由で取得し静的レビュー。合成7件PASSは担当ロボ報告、コミット済Node9件未実行。実際の21件結果未取得。

## 最優先の是正
現状 `LiteLatestThreeGas.gs` は `SpreadsheetApp.openById` に戻っている。この方式は実機で `spreadsheets.readonly` スコープ下では使用不可と判明（エラー: SpreadsheetApp.openById に https://www.googleapis.com/auth/spreadsheets が必要）。既に2026-10-28 07:26 JSTに成功した実機Liteは `Sheets REST v4/values` と `ScriptApp.getOAuthToken()` を `spreadsheets.readonly` で使用し、7 RSS計5426件/22秒、書込0。Google Sheets API高度なサービス追加済。オンライン実機版とGitHub原本は相違する。 **古いSpreadsheetApp版をオンラインへ貼らないこと**。
1. LABに新規の最新3件用`Sheets REST readonly` GASアダプターを実装（必要なら既存REST helperを共有）。A:J台帳のA EP-ID/G GUID/I/J URLおよび取得元A/H、見出し検査を読み取り専用Sheets REST values.getにする。変換された列が列名と正確に一致するか、リアルタイムの実装状況を未確認なら停止。OAuth scopesを広げない。読取が403なら拡権せず報告。
2. 依存する `phase15LiteFetchWithDeps` が既存のローカルGAS `LiteGas.gs` に既に存在するか、実機版との差分を再確認する。RSS parsing/time sourceは今朝成功した系を再利用する。
3. Node `node lab/phase15-safe-ingest/lite/latest-three.test.js` の全9件を実行し exit codeを報告。さらに既存 `adapter.mock.test.js`8件+`lite.test.js`13件の回帰を実行。GASアダプターREST I/O mockテスト（トークン・読取URL・列見出し・書込API不使用）追加。
4. エッジケース：RSSの日付不正が3件選定に影響する可能性、同一番組GUID重複、番組間重複と順序、URL疑義、EP-ID返却、XML元データからの選定。検出した問題はLABだけで修正し、全テストの結果提示。
5. READ_ONLYの本番台帳参照、7番組最新3件最大21件の表示限定。3,909件全件調査は不要。生RSS全件をダウンロードしても照合出力は最大21。
6. ソース、テスト、ローカル実行ログ、コミットを提出。実機Liteプロジェクトへの変更・再実行はユーザーと司令塔の別途承認があるまで禁止。本番GAS/COPY/Sheets/Properties/triggers/main/公開データには触れない。採番・収蔵はまだ禁止。
