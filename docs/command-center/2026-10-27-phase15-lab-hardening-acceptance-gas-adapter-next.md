# Phase 15｜LAB 7 RED→GREEN・16回帰受入／次工程GASアダプター実装指令
日付：2026-10-27　司令塔
対象成果：Neyito96/asarisunowa commit d54f697f1c3a64e51dd1717adc24e2020b188a4f、branch lab/phase15-safe-ingest-engine-20261027
司令塔は engine.js / adversarial.test.js / RED-GREEN-RESULTS.md の実ファイルを取得・静的確認した。RED7/7、GREEN7/7と回帰16/16は担当ロボの実行報告。司令塔による独立実行は未実施。

## 受入と留保
- GUID再照合、重複ID検出、V3合成proof、COMPLETED欠損、履歴URL不一致のfail closedをLAB実装として受入。
- 現状のproofはsynthetic文字列、stateはメモリ内、lockedは単一instance内のみ。sourcePendingと全feed網羅性はまだ未確定。コピーV18/V19本体とLibraryOfficialEngineの完全実機ソースもない。実GASへの差し替えは禁止。

## 次の具体的な実装（GitHub LABコードのみ）
1. GAS Adapterの**コード**を作成。既存LAB state-machineと実際のSheets/GAS I/Oを界面分離。まず `READ_ONLY` readerを用意：本番sheetId固定 `1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4` の `エピソード台帳` 55列を読み取り、EP-ID/GUID/URL、既存台帳の状態、V3証拠取得と衝突チェックをする。実機関数、タブ名、列定義は実コードで確認できた部分だけ実装し、不明箇所はTODOでなく明確なBLOCKED依存として停止する。productionへのシート書込なし。
2. node上で走るmock GAS `SpreadsheetApp` 等を注入し、読み取りと DRY_RUN の新着候補→採番シミュレーションを行う。実機コード取得前はオンラインへ接続したと偽らない。READ_ONLY側は `ScriptApp.getScriptId()`、許可される台帳とモードを固定し、write APIを明示的に禁止。
3. 55セルnative rowHash仕様について既知の `JSON.stringify(row)`→SHA-256→WebSafe Base64 と、日付/型変換/空欄の確定・未確認を分け、Node mock fixturesで具体的にテスト。可能なら5件で確認されたハッシュ方式を踏襲するが、未取得オンライン仕様を決めつけない。
4. 永続状態設計：予約→台帳→V3→完了、クラッシュ直後の再照合順序、競合writerがいたときのfail-closed。cross-project LockServiceの無効性を明記し、権威ある唯一writerおよび共有採番の立証までWRITE_MODEを実装してもdisabled-by-designとする。CAS/transactionの非原子性を隠さない。
5. 既存本番台帳に historyのない旧行があり得る。V3 proof欠損をすべて新規登録停止に直結させないために、現行台帳のcoverage証拠を先に調査し、OLD_LEGACY_VALID / V3_MISSING_HOLD / CONFLICT_STOPを設計。実証前に上書き禁止。
6. 公式RSSの各番組取得失敗は SOURCE_PENDING。7番組＋旧SDGs番組政策不明なら追加・採番不可。新規EP-06632転用禁止。
7. 成果：adapter.js（必要ならGAS用 .gs ソース草案）、fake-gas.test.js、README + 実行ログ・未接続/未検証ゲートをコミット。最低限DRY_RUNが候補のGUID/EP-ID/書込想定55列の差分を出し、writes=0を試験で検証。生の実データを含むログ/個人情報・URL認証情報はコミットしない。

## 絶対禁止
実オンラインGASへの貼付・実行・デプロイ、COPY/本番Sheets更新、trigger・Properties更新、production/main/Pages・朝リス宇宙更新。GitHub LAB branchへの追加のみ。
## 報告フォーマット
修正コミット、ファイルURL、再現可能なNode試験結果、オンラインソース未取得部分と次の唯一の人手操作（必要なら）を記載。抽象的なrunbookの追加だけでは未達とする。
