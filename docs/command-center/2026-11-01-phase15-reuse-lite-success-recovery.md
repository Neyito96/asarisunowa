# Phase15 新着収蔵復旧｜過去成功方式再利用指令 (2026-11-01)
## 過去に実機成功した事実
2026-10-28 08:13 JST に試験専用 `phase15Latest3ReadOnlyTrial` は公式7番組×最新3件=21件を約24.8秒で読み取り、登録済11/未登録候補10/重複0/判定不能0を返した。GitHub docs/command-center/2026-10-28-phase15-lite-latest3-live21-acceptance.md。
ONE_GUID_TRIALはEP-06641登録の実績がある（詳細コードの復元と整合確認が必要）。
## 現在の原因
2026-10-31/11-01 p15AutonomousTick logs status OK, rss5/2, processed0, intake0。tickは数値intake=0で初期化し、fetchSources後に実行残時間80秒超の場合だけintake()呼出し。intake本体は常にオブジェクトを返すため両日とも呼出しがスキップされた。fetchSources遅延要因自体は未確定。
## 復旧の最短経路
1. 現存する旧Lite関数 `phase15Latest3ReadOnlyTrial` が本番GASにあるか確認。存在する場合、新規ファイル不要。READ_ONLYで検出21件方式が現在も動くか検証し、11/1最新候補をGUID単位で本番台帳のA/G、予約・除外・保留と照合。
2. 新着抽出経路だけLite方式で短縮（初回最大3件×7番組）。収蔵処理のGUID予約→append→readback→VERIFIEDは既存intakeを再利用。詳細メタデータ補填・配信URL巡回は別予算へ。これにより毎朝の新着登録を最優先する。
3. RSSの最新3件で拾えない過去配信があれば、10/31からの期間対象でページング・補完の別ゲートを設ける。7番組以外のRSSは対象漏れ調査。
4. 書込み前にCOPY/モックで試験、READ_ONLYの候補数・未登録GUID・予想採番・除外と保留、最新のP15_INTAKE RESERVED/VERIFIEDを照合し、明示承認後に上限10件の本番書き込み。
5. `tick` の診断ログに sourceElapsedMs, intakeRan, intakeSkipReason, candidateCount, added, held を持たせ、成功0件や意図しないスキップをOK扱いしない。既存のP15トリガーは1個のまま、二重Writer起動禁止。
本番GAS/本番台帳/トリガーの変更は現時点で行っていない。
