# Phase15｜補填・収蔵ロボから司令塔へ：統合GAS実装・検証報告
日付：2026-10-28。正式指令 f8903679e4efe3d114f62c9638127273ebc35998
## 1. 実装成果（GitHub LAB）
[Phase15IntegratedProductionEngine.gs](https://github.com/Neyito96/asarisunowa/blob/lab/phase15-safe-ingest-engine-20261027/lab/phase15-safe-ingest/automation/Phase15IntegratedProductionEngine.gs)
最終コードコミット：d230ac0949b600a6b36459873267cf3a35fa0e32
- 実コード約20,148文字。独立名前空間 PHASE15_INTEGRATED。オンラインGASへの投入・デプロイ **未実施**。
- **Phase14の実証済コードを参照**：scripts/google-apps-script/Phase14BackfillFiveOfficialDryRun.gs（feat/phase14-production-gas-handoff-20261025）に示された公式Omny JSON `https://api.omny.fm/orgs/1e3bd144-9b57-451a-93cf-ac0e00e74446/clips/{GUID}` と、取得元一覧の7公式RSS（Omny/Megaphone）。Phase14独立実機試験（2026-10-26 22:24、docs/phase14/backfill-five-official-dryrun-results-2026-10-26-2224.md）では3件のOmny JSON HTTP 200・5件RSS照合成功を記録済。ただしこれは**今回の統合GAS自体のオンライン実行ではない**。
- 統合ローダ：公式RSSをUrlFetchApp/XmlServiceでGUID索引化、RSSにない過去Omnyエピソードを公式JSON（15件×分割fetchAll）で取得。JSONはGUID+タイトル+配信日時照合で許可、失敗理由は保留。
- 対象列：V原文をRSS description/JSON DescriptionHtmlそのまま空欄時のみ、W本文+収録日+記事見出し/実証済みタイトル・URL、AC関連記事URL索引、N/O/P画像/音声/再生秒数、X出演者全文、AT〜AX抽出名、AY出典。上書きするWは明示オプションが必要。既存Vと公式原文不一致は V_DIFF_OFFICIAL_PROTECT としてV/W/ACを保護。
- パーサ：HTML anchor hrefと表示題名、Unicode見出し【】/〖〗/［］、出演欄の後の関連記事、ニュースレター/イベント/宣伝の除外、LF保持。URL件数だけで対応付けしない。
- 実行：100行まで、LockService、EP-ID/GUID/現値再検査、式/データ検証ガード、書込前後の独立監査シート P15I_AUDIT（before/after/証拠）、再読込、COPY/PROD別PropertiesServiceカーソル、保持行の P15I_HOLD_QUEUE 記録とカーソル不動の再試行エントリ、列別更新件数。
- 安全：WRITE_ENABLED と PRODUCTION_APPROVED と OTHER_WRITERS_PAUSED の別ScriptPropertiesゲート。毎15分の本番トリガー設置関数はさらに QUALITY_GATE_PASSED が必要。**未設置**。プロジェクト外部の並列GAS writerをLockServiceだけでは抑止できないため、運用側停止確認が必須。
## 2. EP-00001〜00030の実データ検証（オンラインGASを使わないREAD_ONLY）
本番台帳のA2:AC31を取得し、**保存済みのGASファイルそのものをJavaScriptとして実行**して清掃器を検査。
- 30件照合／パーサ構造上の保留なし11件／関連記事に検証できるURLがない等の保留19件。
- Wに【出演・スタッフ】等の残存見出しが発生した件数 0。
- EP-00001、EP-00004、EP-00023：Vからの関連記事タイトルと各3 URLを保持し、現Wと一致。EP-00023の出演セクションの後の関連記事も残る。
- EP-00006〜00011の多くはVにURLがないため、AC/Wとの件数一致だけで新しい対応URLを推定せず保留。11件はあくまでパーサ構造合格で、公式原文照合を含む最終品質受入ではない。
- 追加6単体試験（出演者後関連記事、HTML anchor、URL未確定の保留、ニュースレター、途中宣伝、イベント見出し）全件合格。
補助証跡：[2026-10-28-integrated-engine-real30-test-results.json](https://github.com/Neyito96/asarisunowa/blob/lab/phase15-safe-ingest-engine-20261027/lab/phase15-safe-ingest/automation/2026-10-28-integrated-engine-real30-test-results.json)（初回保存時点の検査、改修後も11/19と6/6を再確認）。
## 3. 動作する統合エンジンのモック実行（実Google Sheetsには変更なし）
1. RSS GUID取得→公式生VとW・AC・N/O/P・X/AYを組み合わせたCOPY模擬write：EP-00001相当1GUID、初回8セル、再実行0セル、V原文文字列一致、Wの関連記事URL3本、監査8件。
2. Omny JSON GUID/タイトル/日付確認→COPY模擬write：EP-00006相当1GUID、初回N/O/P計3セル、再実行0セル。V公式原文不一致を検出し、V/Wの既存値保持、V_DIFF_OFFICIAL_PROTECT と RELATED_TITLE_MISSING_VERIFIED_URL を保留記録。監査3件。
いずれも UrlFetchApp／XmlService／SpreadsheetApp の**モック**。実オンラインGASや実公式HTTPアクセスでの成功件数ではない。
## 4. 実運用状態／未完了
| 指標 | 今回 |
|---|---:|
| 本番台帳新規補填 | **0セル** |
| 本番既存値品質修正 | **0セル** |
| 実COPYへの新規補填 | **0セル** |
| 今回の統合GAS実オンライン実行 | **0回** |
| 今回の統合GASによる実公式RSS/JSON GUID取得 | **0件** |
| 実GASカーソル保存 | **未実施** |
| 実GASトリガー設置 | **なし** |
| 713行目以降の大量処理 | **停止維持** |
オンラインApps Script実行・デプロイ権限を持つ接続手段がこの実行環境にはない。GitHub保存とモック実行は完了したが、指令の「公式GUID実取得→COPY書込→2回目0→本番小数行書込→再読込」は未達であり、**完成受入を主張しない**。
## 5. オンライン実機移行の安全な実行入口
対象は検査済みの一本化されたGASプロジェクト（既存V3本番プロジェクトを丸ごと上書きしない）。
最初は `p15iParserSmokeTests()`（READ_ONLY）、`p15iCopyDryRun()`、`p15iProductionDryRun()`。RSS/JSONの実取得ログ、GUID一致・保留理由を記録。
COPYだけ `P15_WRITES_ENABLED=YES` を設定して `p15iCopyWrite()`、再実行差分0と監査シート確認。本番は明示確認した後で別ゲート `P15_PRODUCTION_APPROVED=YES` と `P15_OTHER_WRITERS_PAUSED=YES` を設定し `p15iProductionSmallWrite()`、独立再読込。品質承認後に `P15_QUALITY_GATE_PASSED=YES` で `p15iInstallProductionTrigger()` を実施。必要なら `p15iPauseProductionTrigger()` で停止。現時点では上記実行をしていない。
