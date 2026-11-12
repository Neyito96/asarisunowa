# V2新着収蔵ボット（Phase25→V2）引き継ぎ記録

最終更新: 2026-11-11 夜 JST（第4段階）/ PR #306（Draft）/ 判定: **PARTIAL**（P0・小バッチ・採番整合・別表保全はCOPYで実証。GAS実機・日次運転・P1の実書込は未完）

> 次の担当AIへ: このファイルと PR #306 のコードだけで再開できます。チャット履歴は不要です。

## 1. 全体像（第1段階＝基本収蔵だけを実装済み）
```
公式RSS ──(fetch-official-rss / p25v2FetchFeeds_)──> item ──(p25v2Classify_)──> CANDIDATE / ALREADY_INGESTED / METADATA_CHANGE / HOLD / BLOCK
                                                            │CANDIDATE（最大1件/回）
                                                            ▼
                     固定ID採番履歴「採番済」 → V2・統合台帳へ追記（掲載判定=未判定） → 読み戻し全列一致 → 採番履歴「登録完了」
```
第2段階（URL補完・概要清掃・出演者・関連記事）以降は別モジュールで後から実行する設計です。リンクや概要が取れなくても基本収蔵は止まりません。

## 2. 実装モジュールと役割
| ファイル | 役割 |
|---|---|
| `scripts/google-apps-script/P25V2IngestAdapter.js` | 中核（GAS/Node共通）。RSS解析 `p25v2ParseRss_`、V2見出し解決 `p25v2Schema_`、照合 `p25v2Classify_`、採番 `p25v2Numbering_`/`p25v2Allocate_`、行生成 `p25v2BuildRow_`、COPY検証 `p25v2AssertCopyTarget_`、収蔵 `p25v2Ingest_`、GAS入出力 `p25v2GasIo_`/`p25v2FetchFeeds_`、手動入口 `P25V2_INGEST_COPY` |
| `scripts/ledger-v2/v2-feeds.json` | 対象番組と公式RSS（V2「番組RSS」列の実測値）。番組追加はここに1行足す |
| `scripts/ledger-v2/fetch-official-rss.mjs` | 公式RSSを読取専用で取得（解析器は上の中核と同じコード） |
| `scripts/ledger-v2/post-rss-dump.mjs` | 取得結果を PR #306 のコメントへ分割投稿（概要原文は長さとハッシュのみ） |
| `.github/workflows/v2-rss-readonly.yml` | 上の2つを Actions で実行。**コミットメッセージに `[v2rss-run]` がある push だけ**で起動。concurrency で重複防止 |
| `scripts/ledger-v2/v2-ingest-dryrun.mjs` | 実RSS × V2スナップショットの READ_ONLY 判定 |
| `scripts/ledger-v2/p25v2-copy-real-trial.mjs` | COPY書込の計画（plan）と検証（verify）。GAS実機の代わりに Sheets API で書く場合の手順 |
| `scripts/ledger-v2/preflight-ingest.mjs` | 収蔵前チェック（GUID番組横断・（再）HOLD） |
| `tests/p25-v2-ingest.test.mjs`, `scripts/ledger-v2/preflight-ingest.test.mjs` | 回帰テスト |

再利用した既存資産: 許可ホスト（omny.fm / www.omnycontent.com / feeds.megaphone.fm）とフィード単位の失敗記録は `P25CopyAdapter.readSources`（PR #270）と同じ。採番正本は既存の `固定ID採番履歴` タブ。COPYの隔離（保護ID・COPY名・二重ID確認）は `P25CopyAdapter` の考え方を踏襲。Phase25本体（プレイリスト系）は変更していません。

## 3. 入力元と出力先
| 種別 | 対象 |
|---|---|
| 入力 | 公式RSS 7番組（`v2-feeds.json`）、V2・統合台帳（見出し名で解決）、固定ID採番履歴 |
| 出力（COPYのみ） | `V2・統合台帳` に1行追記、`固定ID採番履歴` に1行追記→状態更新 |
| 書込拒否（コードで固定） | V1完全保全 …J-8BA、V2作業用正本 …xedAbc、本番59列 …5-2FG4、旧GAS参照 …jmwQ |
| COPY | `【COPY試験】V2収蔵ボット P25V2 1件試験 2026-11-11（本番ではない）` …bnK1PY |

## 4. データ項目の対応表（RSS → V2・統合台帳）
| RSS | V2見出し | 備考 |
|---|---|---|
| （採番） | EP-ID / 代表EP-ID | 採番履歴の規則（§5） |
| 設定の番組名 | 番組 | `v2-feeds.json` |
| `<title>` | タイトル | CDATA・実体参照を復元 |
| `<pubDate>` | 配信日時 JST | `YYYY/M/D HH:mm`。形式外は BLOCK |
| `<guid>` | 公式GUID | 中のUUIDを小文字で採用 |
| `<link>` | 旧元ページURL | Omnyのみ。Megaphoneは空 |
| `<enclosure url>` | 音声URL | 到達・再生確認はしない（別工程） |
| `<itunes:duration>` | 再生時間 秒 | `hh:mm:ss` を秒に換算 |
| `<itunes:image>` | 画像URL | 回の画像が無ければ番組画像 |
| フィードURL | 番組RSS | |
| 固定値 | 掲載判定=未判定、判定根拠=「P25V2収蔵: 公式GUID新規・未審査」 | 公開されない |
| `<content:encoded>`/`<description>` | （保存先なし） | **V2に「概要原文」列が無い**ため未保存。item には保持（P1） |

空欄のまま入れる列: 公式JSON UUID・公式個別URL・Omny埋込URL・概要（清掃済）・出演者・関連記事URL・7サービスのリンク・文字起こし・所属ID ほか。後日補完（P1）。

## 5. 判定ルール
**照合**（GUID = 公式GUID・公式JSON UUID・公式個別URL内のUUID。番組をまたいで照合）
| 判定 | 条件 | 書くか |
|---|---|---|
| ALREADY_INGESTED | 同GUID・同番組・同題（（再）と空白を除いて比較） | 書かない（再実行の正常系） |
| METADATA_CHANGE | 同GUID・同番組で題名だけ違う（入力の全GUIDが同じ1行を指す） | 書かない・記録のみ |
| BLOCK | 必須（番組・題・日時・GUID）欠落、日時形式違い、EP-ID既存、GUIDが別番組/複数行に既存、公式URL既存、入力内の重複 | 書かない |
| HOLD | 同番組同題、（再）・再配信・再放送の印 | 書かない（元配信の探索は未実装） |
| CANDIDATE | 上記以外 | 1回1件まで書く |

**採番**（正本 = `固定ID採番履歴` [GUID, 固定ID, 番組, タイトル, 状態, 採番日時, 登録完了日時, 台帳行番号, エラー・備考]）
1. 同GUIDが履歴にあれば、その番号を再利用（中断復旧）。その番号が台帳で別GUIDに使われていたら停止
2. 無ければ max(台帳のEP-ID, 履歴の固定ID, `reservedMaxEpNo`)+1。履歴に同じ番号があれば停止
3. 履歴に「採番済」→台帳に追記→読み戻し→履歴を「登録完了」（登録完了日時・台帳行番号）
4. 再実行時、台帳にあるのに履歴が「採番済」のままなら「登録完了」に修復

注意（実測）: 履歴の最大は EP-06640（10/28）。台帳には EP-06694 まであり、**EP-06641〜06694 は履歴に記録されていない**（既存の取込が履歴を更新していない）。そのため台帳と履歴の両方の最大値を見ています。

**書込前の安全確認**: 環境=COPY／指定IDと確認IDの一致／実際に開いたIDが一致／ファイル名にCOPY／シート名＝`V2・統合台帳`／スコープ＝`V2_INGEST_APPEND_ONLY`／書込フラグ／保護4IDでない／書込直前に台帳全体を読み直し、変化があれば停止／見出し34列の一致／追記位置＝最終行+1／読み戻しの全列一致（日時は値で比較）。GASではスクリプトロックで同時実行を1本に限定し、追記行には直上行の書式を写します。

## 6. 実行・再実行・復旧手順
**読取専用の実RSS判定**
1. コミットメッセージに `[v2rss-run]` を含めて PR #306 のブランチへ push → Actions `v2-rss-readonly` が公式RSSを取得し、PR #306 に `v2rss-dump:<run>:part-NN` を投稿
2. その部品を順に連結して `rss-items.json` にする
3. V2・統合台帳の `A1:H` と `I1:J` を values.get で JSON 化
4. `node scripts/ledger-v2/v2-ingest-dryrun.mjs AH.json IJ.json rss-items.json out.json`

**COPY 1件の収蔵（Sheets API 経由。GAS実機でも同じ順序）**
1. `node scripts/ledger-v2/p25v2-copy-real-trial.mjs plan <COPY A1:J> <採番履歴> <item> <履歴の次の空き行> <COPY ID> <COPY名>` → `plan.json`
2. plan の順に書く: 採番履歴（採番済）→ 台帳行
3. 台帳行を読み戻し、`verify` を実行（読み戻し一致・再実行で追加0・修復予定）
4. 修復予定（登録完了）を採番履歴へ書き、もう一度 `verify` → 修復予定なし・追加0

**GAS実機（未実施）**: COPY専用の新規GASプロジェクトに `P25V2IngestAdapter.js` だけを貼り、`P25V2_INGEST_COPY({environment:'COPY',targetSpreadsheetId:ID,expectedTargetId:ID,sheetName:'V2・統合台帳',scope:'V2_INGEST_APPEND_ONLY',write:true,feeds:<v2-feeds.jsonのfeeds>}, null, false)` → 結果確認 → 第3引数 `true`。トリガーは作らない。

**復旧**
| 状況 | 対処 |
|---|---|
| 採番済のまま停止（台帳未書込） | 再実行すると同じEP-IDで続きから書く |
| 台帳に書けたが履歴が採番済 | 再実行で自動修復（登録完了） |
| READBACK_MISMATCH | 停止。台帳行を目視し、正しければ再実行（ALREADY_INGESTED＋修復）。誤りなら COPY の当該行を空にして再実行 |
| LEDGER_CHANGED_SINCE_READ / LOCKED | 他の書込が終わってから再実行 |
| RSS 1本の失敗 | `feedErrors` に記録され、他の番組は続行 |
| ロールバック | COPY の `V2・統合台帳` 6557行目と `固定ID採番履歴` 79行目を空にする、または COPY ごとゴミ箱へ |

## 7. テスト実績
`node --test tests/p25-v2-ingest.test.mjs scripts/ledger-v2/preflight-ingest.test.mjs` → **24/24 PASS**
内容: V2見出し一致/列順入替/見出し違い・重複で停止、保護4ID拒否、COPY検証7種、READ_ONLY非書込、1件追記→読み戻し→再実行0、BLOCK/HOLD/METADATA_CHANGE、書込直前の行数変化・同行数の内容変化で停止（他担当の追加分）、読み戻し不一致で停止、RSS解析（CDATA・実体参照・JST・秒換算・番組画像・許可外ホスト拒否・不正XML）、RSS→収蔵の通し、採番（履歴最大+1・登録完了記録）、中断復旧（採番済の再利用・登録完了の修復）、採番衝突・履歴の二重GUIDで停止、日時の表示形式差を許容し値の違いは検出。

## 8. 実測（2026-11-11）
| 段階 | 結果 |
|---|---|
| 実RSS取得（Actions run 42979725616） | 7番組すべて HTTP 200。各40件・計280件。題名欠け0・GUID欠け0 |
| READ_ONLY判定（V2作業用 6,555行・公開6,033） | 収蔵済み243、題名変更6、BLOCK 5（同GUIDが複数行＝既存の重複群）、HOLD 0、**新規候補26** |
| 新規候補26件 | 本番59列にも無し（0/26）、削除・除外履歴は空、うち24件は LISTEN RSS でも実在を確認 → **過去の取りこぼし**（多くは10/11〜10/17配信）と判断。自動では入れていない |
| COPY収蔵（実在の回：ニュースの学校「人間国宝（2026）」11/11 04:00） | 採番履歴79行目に採番済 → 台帳6557行目に EP-06695 を追記 → 読み戻し（初回は日時表示差で不一致を検出し、修正後に一致）→ 既存6,556行A:J不変 → 再実行で追加0 → 履歴を登録完了に修復 → 再実行で追加0・修復0 |
| COPY全RSS再判定 | 収蔵済み244、新規候補25（1件減） |
| 公開件数 | 6,033のまま（未判定は公開されない） |

実測ファイル: `docs/release/2026-11-11-p25v2-real-rss-readonly.json`、`docs/release/2026-11-11-p25v2-copy-real-item-trial.json`（前回の合成1件試験: `…-copy-trial-result.json`。合成行はCOPYから消去済み）

## 9. 段階ごとの状況
| 段階 | 状況 |
|---|---|
| **第3段階の更新** | 下の §12 を参照（この表は第2段階時点） |
| P0 公式RSS取得 | ✅ 7番組（Actions経由。作業環境から公式RSSには直接届かない） |
| P0 READ_ONLY実データ試験 | ✅ |
| P0 安全な採番 | ✅ 正本の履歴を使用（履歴の欠落は §5 注意） |
| P0 V2収蔵アダプタ・二重登録防止・COPY再実行 | ✅（Sheets API 経由。GAS実機は未実施） |
| P1 概要原文の保全 | ❌ V2に列が無い（列追加は要承認） |
| P1 清掃済み概要 | ❌ 既存監査 `scripts/ledger-v2/audit-summary-cleaned.mjs`（PR #299）があるが清掃処理は未接続。清掃基準が未確定 |
| P1 出演者・関連記事 | ❌ 未着手 |
| P1 6サービスURL補完 | ❌ 未接続。既存 `LedgerFillRobot`（PR #299、LISTEN用・EP-ID+GUIDキー）を V2列名で使うのが次の一手 |
| P2 検索索引・公開集計・サイトデータ | ❌ 公開計数関数のみ（`p25v2PublicCount_`） |
| P3 日次自動実行 | ❌ 未設定（案: COPY専用GASで JST 6:10、1回1件） |
| P3 取りこぼし回収 | 🔶 26件を検出済み。収蔵は未実施 |
| 再配信の元配信探索 | ❌ HOLDに止めるだけ |

## 10. 未完事項
- [ ] GAS実機試験（COPY専用プロジェクト・OAuth承認）
- [ ] 1回の上限（`maxRows` 最大1）の引き上げと、取りこぼし26件の収蔵（要承認）
- [ ] V2に「概要原文」「清掃ルール版」「清掃日時」「各サービスの状態」列を追加するか（V2の列構成の変更は要承認）
- [ ] 採番履歴に EP-06641〜06694 が無い件の整理（既存取込の所在は本リポジトリに無く未確認）
- [ ] 同GUIDの重複群に当たる5件が BLOCK として毎回出る（害はないが記録が増える）
- [ ] `scripts/google-apps-script/` に `.claspignore` が無い。本番への clasp push で本アダプタが混入しないよう除外が必要
- [ ] METADATA_CHANGE 6件の内容確認

## 11. コミット
| SHA | 内容 |
|---|---|
| eb2b3f8 | アダプタ初版・preflight修正・テスト・合成試験スクリプト |
| 4047032 | 引き継ぎ記録初版・合成試験結果 |
| 3968a33 / 333f509 | （他担当）同じ行数でも内容が変わったら停止＋テスト |
| 53d0d29 | RSS解析・採番正本・中断復旧・題名変更検知・RSS取得ジョブ |
| cadd4db | RSS取得結果をPRコメントへ投稿 |
| 180bd84 | 日時の値比較・採番修復・実RSS判定・実在1件のCOPY収蔵・記録 |


## 12. 第3段階（2026-11-11 夕・司令塔 comment 6790190008）
### 12.1 追加・変更した仕組み
| 対象 | 内容 |
|---|---|
| 小バッチ（`p25v2Ingest_`） | 1回の上限 = min(設定 `maxRowsCap`〔既定1〕, 絶対上限 `P25V2_HARD_CAP_`=10)。候補は**配信日の古い順**に採番。順序は「採番済(一括)→書込直前の再検証→台帳追記(一括)→読み戻し→収蔵詳細→登録完了(一致分のみ)」。期限(`deadlineMs`)を過ぎていれば書かずに `PARTIAL_TIME` |
| チェックポイント・再開 | 台帳と採番履歴そのものがチェックポイント。途中で止まっても再実行で「採番済」の番号を再利用し、台帳にある分は ALREADY_INGESTED＋修復。読み戻しが一部だけ不一致なら一致分だけ登録完了にして `HALT_READBACK_MISMATCH` で停止 |
| 修復の範囲 | 採番履歴の状態が **「採番済」のものだけ**「登録完了」に修復。人が付けた「要確認」などは変えない（実データの EP-06632 で発見して修正） |
| READ_ONLY計画 | `planAll` で全候補の予定採番（再利用か新規か）を出す |
| 別表（V2本体34列は変更なし） | `V2・収蔵詳細`（1EP=1行。概要原文・SHA256・文字数・清掃状態/版/日時/結果・出典）、`V2・URL状態`（1EP×1サービス=1行の縦持ち。PR #281 の状態をそのまま記録） |
| 本番混入防止 | `scripts/google-apps-script/.claspignore` で `P25V2IngestAdapter.js`・`LedgerFillRobot.js` を本番 push から除外（テストで全GASファイルを検査）。入口 `P25V2_INGEST_COPY` は doGet/doPost が同居する（＝本番プロジェクト）・トリガーがある場合に停止。トリガー作成コードは無い（テストで検査） |
| GAS依存・権限 | 使用サービスは SpreadsheetApp / UrlFetchApp / LockService / ScriptApp / Utilities のみ、他ファイルの関数・本番設定に依存しない（テストで検査）。権限雛形: `gas/p25v2-copy/appsscript.json`（spreadsheets・script.external_request・script.scriptapp） |
| 採番監査 | `scripts/ledger-v2/numbering-audit.mjs`（READ_ONLY）。重複・GUID食い違い・他EPとのGUID共有・欠番・履歴の欠落と、COPY用の非破壊バックフィル行を出す |
| COPYバッチ道具 | `scripts/ledger-v2/p25v2-copy-batch.mjs`（plan/verify）。判定・採番・行生成はすべてアダプタ |
| 第2段階の接続口 | `scripts/ledger-v2/v2-enrich.mjs`: `toResolverInputs`（V2→PR #281 resolveOne 入力）、`toUrlStateRows`（PR #281 結果→URL状態表）、`planLinkFills`（VERIFIED かつ空欄だけ・既存と違えば HOLD・LedgerFillRobot互換マニフェスト）、`planSummaryCleaning`（原文は不変・清掃結果は別列・V2清掃済欄は空欄のときだけ・版が同じなら再実行しない）、`planCastAndRelated`（抽出関数を注入・確信度不足や既存値はHOLD）、`pendingWork`（EPごとの未補完一覧） |

### 12.2 列追加 vs 別表の比較（採用: 別表）
| 観点 | V2・統合台帳に列追加 | 別表（採用） |
|---|---|---|
| 既存34列・既存データ | 列が増える（途中に入れると全参照がずれる） | 変更なし |
| 公開FILTER（`V2・公開台帳` は列文字で参照） | 末尾追加なら影響なし、途中なら壊れる | 影響なし（COPYで 6,033 のまま確認） |
| 既存GAS・Phase25・監査スクリプト | 列順変更の影響を受ける | 影響なし（参照しない） |
| サービス追加 | 1社ごとに列が増える | 行が増えるだけ |
| 概要原文（長文） | 本体が重くなる | 別表に隔離 |
| 結合の手間 | 不要 | EP-ID で結合（`pendingWork` 等が実施） |

### 12.3 採番履歴の整合（READ_ONLY 監査 → COPYのみバックフィル）
- V2正本の履歴: 76件、最大 EP-06640。重複EP 0、重複GUID 0、台帳とのGUID食い違い 0、履歴にあって台帳に無いEP 0
- **欠番 0**（EP-00001〜06694 が連続。削除済み140件も番号を使用済みとして数える）
- 履歴に無いEP: 台帳 6,554件中 6,478件（履歴は 10/11 以降の一部しか記録していない）。指定範囲 **EP-06641〜06694 の54件** はすべて GUID 1件で一意・衝突なし・本番59列と一致
- 原因（推定）: 10/28 以降の取込経路（本リポジトリ外）が台帳には書いたが履歴を更新していない。**未確認**
- COPY の履歴 80〜133行に 54件を「登録完了・採番日時は不明・P25V2遡及記録」で追記 → 読み戻し不一致 0 → 再監査で範囲内の欠落 0・欠番 0
- 他EPとGUIDを共有する履歴 13件（既存の重複群。番組横断の再掲）は記録のみ
- **採番が安全な根拠**: 次の番号 = max(V2, 本番59列, 採番履歴, 削除済み一覧)+1 で、欠番を作らず、使用済みや削除済みの番号を再利用しない。同GUIDが履歴にあればその番号を再利用し、その番号が台帳で別GUIDに使われていたら停止。テスト（採番・中断復旧・衝突）と実データ監査（欠番0・衝突0）の両方で確認

### 12.4 取りこぼしのCOPY回収（段階実施）
- 対象は「今回の実RSS 280件中の新規候補26件」（**全期間の未収蔵総数ではない**）。うち1件は第2段階で収蔵済み（EP-06695）
- READ_ONLY再照合（最新のCOPY台帳・採番履歴・同GUID・（再）・同番組同題）: 候補25・HOLD 0・BLOCK 5・題名変更6、予定 EP-06696〜06720（`docs/release/2026-11-11-p25v2-recovery-plan-readonly.json`）
- **バッチ1（10件、EP-06696〜06705）をCOPYに収蔵**: 採番履歴134〜143行（採番済）→ 台帳6558〜6567行 → 読み戻し不一致0 → 収蔵詳細2〜11行 → 採番履歴を登録完了。既存6,557行のA:Jは不変、公開6,033のまま
- 収蔵後に再計画: 候補15・収蔵済み254、続きは EP-06706 から（番号の飛び・重複なし）。**残り15件は未投入**（段階回収のため。次回は同じ手順を実行するだけ）
- 概要原文: RSSの本文は公開PRに載せないため、COPYでは「原文未取得（長さ・ハッシュのみ確認）」として長さとSHA256だけ記録。GAS実機では原文そのものを収蔵詳細へ保存する
- 結果: `docs/release/2026-11-11-p25v2-copy-batch1-result.json`、`…-recovery-plan-after-batch1.json`、`…-numbering-audit-copy-after.json`

### 12.5 第2段階の実データ試験（READ_ONLY・書込なし）
COPYの新着11件（EP-06695〜06705）: LISTEN の個別URLは LISTEN RSS の GUID 一致で **10件が VERIFIED**（列V、空欄のみ）、1件は未発見。他5サービスは未探索、詳細未作成1件、出演者・関連記事は全件未補完（`…-enrich-plan-copy.json`）

### 12.6 テスト
`node --test tests/p25-v2-ingest.test.mjs scripts/ledger-v2/preflight-ingest.test.mjs tests/v2-enrich.test.mjs` → **37/37 PASS**

### 12.7 未完事項（第3段階後）
- [ ] GAS実機試験（COPY専用プロジェクトに `P25V2IngestAdapter.js` だけを置き、`appsscript.json` 雛形の権限で手動実行）。**管理人の操作は、必要条件が揃った時点で最後に1回だけ**（今は依頼しない）
- [ ] 取りこぼし残り15件のCOPY回収（手順は §12.4 と同じ）／V2正本・本番への反映（未承認）
- [ ] 全期間の取りこぼし調査（今回はRSS各40件のみ）
- [ ] 第2段階の実書込: LISTEN 10件の補完（LedgerFillRobot で COPY）、他5サービスは PR #281 の実API経路が未検証（`ROUTES` すべて false）
- [ ] 清掃関数・出演者/関連記事の抽出関数の確定（基準未確定。PR #279/#299 の資産を注入する）
- [ ] 採番履歴の残り 6,424件の遡及記録（範囲外。要否は要判断）
- [ ] 本リポジトリ外にある既存の取込経路の所在確認（履歴を更新していない原因）
- [ ] 日次運転の設定（未承認）

### 12.8 第3段階のコミット
| SHA | 内容 |
|---|---|
| d939381 | 小バッチ・チェックポイント・別表・.claspignore・doGet検知 |
| 5ef8e26 | 修復範囲の限定・READ_ONLY全候補計画・採番監査・COPYバッチ道具・第2段階接続口・GAS依存/権限検査・実測記録 |


## 13. 第4段階（2026-11-11 夜・司令塔 comment 6790878868）
判定: **PARTIAL**（下表の「実施」は COPY …bnK1PY での実測。GAS実機・V2正本・本番は未実施）

| 項目 | 状況 | 実測 |
|---|---|---|
| 1. 残り15件のCOPY回収 | **DONE（COPY）** | 最新COPYで再判定（候補15・HOLD 0・BLOCK 5）→ バッチ2: 10件（EP-06706〜06715）、バッチ3: 5件（EP-06716〜06720）。各バッチで 採番済→台帳→読み戻し（不一致0）→収蔵詳細→登録完了。既存行 A:J 不変（V2正本由来6,556行・第3段階時点6,577行とも一致）。再実行: 候補0・収蔵済み269、公開 6,033 のまま。P25V2採番 26件すべて登録完了・採番済の残り0 |
| 2. 概要原文の実保全 | **PARTIAL** | 公式RSS→Actions→**封緘転送**（公開鍵暗号。GitHubには公開鍵と暗号文だけ）で 26件の原文を取得し、全件が既存の長さ・ハッシュと一致。COPY には **4件**（EP-06698/06704/06706/06708）の原文本文を保存し、読み戻しの全文SHA256が一致。残り21件は「未取得（長さ・ハッシュのみ）」のまま（書込量の節約のため。`planRawBackfill` で同じ手順で補える）。EP-06695 は収蔵詳細の行が無い（第2段階の収蔵が別表作成前）＝未作成 |
| 3. 概要清掃と構造化 | **PARTIAL** | 既存 `public/library/description-editor.mjs` の `editDescription` をそのまま使い、実データで見つかった取りこぼしだけを V2追加規則（`+v2rules-1`）で補った。COPY 4件に 清掃済み本文・関連記事（見出し＋URL、追跡パラメータ除去）・出演者候補・抽出保留・清掃版/日時/結果 を保存。原文は不変。同じ版での再実行は差分0。25件の試算: 清掃済24・要確認1（EP-06715: URLの無い関連記事行）。V2本体「概要（清掃済）」への投影は別工程（未実施） |
| 4. LISTEN 実補完 | **DONE（COPY）** | 4条件（EP-IDで行特定・公式GUID一致・V列空欄・読み戻し）で **10件** を V列へ補完、読み戻し11/11一致、他セル変化0。EP-06704 は LISTEN RSS に無く **照合保留**。`V2・URL状態` に11行（確認済み10・照合保留1）。再実行: 書込0・同一10 |
| 4'. 他5サービス | **BLOCKED（意図的）** | PR #281 の `ROUTES` はすべて未検証（false）。推測URLは作らない |
| 5. 自動運転の持続性 | **PARTIAL** | 工程は分離済み（RSS取得 / 小バッチ収蔵 / 原文の後日補完 / 清掃 / URL補完 / 未補完一覧）。トリガー・本番起動はしない。過去分の遡及取得（カーソル/期間分割）は未実装 |

### 13.1 追加・変更
- `scripts/ledger-v2/sealed-transfer.mjs` と `sealed-transfer.pub.pem`（`.gitignore` の `*.pem` を明示的に上書きして公開鍵だけをコミット）、対象GUID `sealed-guids.json`。workflow は本文入りの `rss-items.json` を成果物に出さない（**過去2回の実行で本文入りの成果物が公開状態だったため削除済み**）
- 秘密鍵は実行環境の中だけ（`/home/claude/work/keys`、コミットしない）。**セッションが終わると消える**ため、次回は `keygen` で鍵を作り直して公開鍵を差し替える（本番運用では GAS が RSS を直接取得するので封緘は不要）
- `V2・収蔵詳細` を17列に（末尾に 清掃済み本文 / 関連記事(抽出) / 出演者候補(抽出) / 抽出保留 / 原文取得方法）。**GASで新規作成する場合は17列で作る**（12列のままだと書込が範囲外になる。COPYで実際に発生）
- `v2-enrich.mjs`: `v2CleanSummary`（editDescription＋V2追加規則）、`planRawBackfill`（SHA256先頭一致・文字数一致・空欄の行だけ）
- `p25v2-copy-batch.mjs`: 収蔵詳細のSHA256を実際に計算

### 13.2 V2追加規則（`+v2rules-1`）で直した、既存整形の取りこぼし
| 現象（実データ） | 対処 |
|---|---|
| 出演・スタッフ欄の後の【おねがい】【朝ポキ情報】★案内まで出演者候補になる | 出演欄は【…】・★・共通案内の行で打ち切り、行内URLを除去 |
| ニュースの学校（Megaphone）で「ご意見・感想・リクエスト」「ほかにも多彩な番組を配信中」「Learn more about your ad choices」が本文に残る | 共通案内の行として除去 |
| 同じく本文中の記事見出し＋URLが本文に混ざる | 関連記事へ移す（見出しとURLが別行でも対応） |
| 「3人のトークは毎週月曜日に配信します」が途中で切れ「3人のトークは」が残る | 配信予定の文を文ごと除去 |

### 13.3 テスト
`node --test tests/p25-v2-ingest.test.mjs scripts/ledger-v2/preflight-ingest.test.mjs tests/v2-enrich.test.mjs` → **42/42 PASS**（封緘の往復と改ざん検出、清掃規則、原文補完の照合を追加）

### 13.4 未完事項
- [ ] 原文の残り21件と EP-06695 の収蔵詳細行（手順は同じ。GAS実機なら収蔵時に原文が入る）
- [ ] 清掃の要確認1件（EP-06715）の目視確認／清掃結果の V2本体「概要（清掃済）」への投影（別工程・未承認）
- [ ] 出演者候補は「候補」のまま（V2「出演者」列には書いていない）。同一人物判定・確信度の基準は未確定
- [ ] 他5サービスの実API経路の検証（PR #281）
- [ ] 過去の取りこぼしの遡及取得（カーソル/期間分割・予算上限・チェックポイント）
- [ ] GAS実機試験（COPY専用・権限雛形 `gas/p25v2-copy/appsscript.json`）。管理人の認証は最後に1回
- [ ] V2正本・本番への反映（未承認）

### 13.5 実測ファイル（本文は含まない）
`docs/release/2026-11-11-p25v2-stage4-verify.json`、`docs/release/2026-11-11-p25v2-stage4-clean-plan-summary.json`

## §14 第5段階（2026-11-11）結果 — COPY限定・本番/V2正本/GAS/main 不変・PR #306 Draft維持

| 項目 | 判定 | 実測 |
|---|---|---|
| P0 公開成果物の監査・再発防止 | DONE | artifact 117件中 v2-rss系 0件。対象4 runのログ・PRコメント613件で原文断片52個の一致0。git履歴213コミットは既存の公開サイトデータのみ一致（意図された公開物）。キャッシュは権限外で**未確認**。削除前に第三者が取得した写しは回収不能（残存リスク）。workflowは upload-artifact 撤去・`assertPublishable`（leak-guard）・`if: always()` 後始末。経緯: `2026-11-11-v2-rss-exposure-incident.md` |
| EP-06695 詳細行の復旧 | DONE | 収蔵詳細 27行目。原文630字、SHA256 2ddac8a1…dc8c 一致、v2rules-2 清掃、原文取得方法=公式RSS（封緘転送） |
| 原文保全（残り21件） | PARTIAL / BLOCKED（意図的） | COPYに原文を保持=5件（06695/06698/06704/06706/06708）。残り21件は長さ+SHA256のみ。約11万字をこのセッション経由で転記しない判断（クレジット節約・本文の経路最小化）。復号済み平文と秘密鍵は作業後に削除済み。**回収手順**: 独立COPY GAS が公式RSSを直接取得し `planRawBackfill`（SHA前方一致・長さ一致・空欄のみ）で埋める |
| 清掃（v2rules-2） | DONE（5件）/ 21件は原文待ち | 再実行差分0（detailUpdates 0・ledger 0）。関連記事は別欄JSON（source=概要原文）、出演者は候補JSON（source・confidence=候補（未確定））、人物の自動同定なし。原文は不変。EP-06715 は HOLD（RELATED_TEXT_WITHOUT_URL_REVIEW） |
| 本体「概要（清掃済）」への投影 | DONE（5件） | `planSummaryProjection`: 清掃済・原文SHA一致・EP-ID/GUID一致・空欄のみ。N6557:N6570 書込→A:AH読み戻しで対象5セルのみ変化、他は不変。保留0 |
| LISTEN | PARTIAL | EP-06704 は未発見（後日再探索）。06706〜06720 の未補完分は次段階（4条件照合のまま） |
| 他5サービス | BLOCKED | PR #281 の ROUTES が全て未検証(false)。推測URLは作らない。URL状態表で HOLD/NOT_FOUND を管理 |
| 遡及照合カーソル | DONE（コード・試験） | `nextScanWindows` / `advanceScanState`: 予算内・失敗時は進めない・完了停止・同状態から同計画 |
| 独立COPY GAS | DONE（模擬通し試験） | RSS直接取得→1件追記→原文を詳細表に保存→登録完了→再実行0→取得失敗時は書込0。ロック取得/解放、トリガー作成なし。OAuth承認は未依頼（最後に1回） |
| 完全性指標 | DONE | `integrityMetrics`。測定値: `docs/release/2026-11-11-p25v2-stage5-metrics.json`（総数6580・公開6033・未判定129・保留257・対象外161・詳細26行/原文5/ハッシュのみ21/清掃5）。サービス列・採番表は全行未読の部分測定（未確認と明記） |

試験: P25V2関連 51件 PASS。リポジトリ全体では `tests/ui-components.test.mjs` が本変更前から失敗（本件と無関係）。

## §15 第6段階（2026-11-11）— 独立COPY専用GASを最優先・清掃は別工程・品質未検証の値を公開しない

### 区別（厳守）
| 区分 | 対象 |
|---|---|
| 実装済 | `gas/p25v2-copy/`（配布 `dist/P25V2CopyIngest.js`・`dist/appsscript.json`・`src/P25V2CopyMain.js`・`.clasp.json.example`・`README.md` 操作手順）。共有コードは `P25V2IngestAdapter.js`（5xx 1回再試行・`limit 0`=全件・収蔵時に清掃/出演者/関連記事を剥がす `p25v2StripUnverified_` を追加） |
| 模擬PASS | `tests/p25v2-copy-gas.test.mjs` 6件（配布ファイルそのものを実行: 点検→予行0書込→1件書込→検証OK→再実行0、保護ID/名前/ID食い違い/トリガーありで停止、5xx再試行/4xx非再試行、列不足停止、原文後日補完のSHA一致のみ・不一致HOLD・再実行0、ログに本文なし）。P25V2関連 計72件 PASS |
| **実機未実行** | OAuth 許可・COPY 実書込・readback・再実行0 は管理人操作待ち（README の8手順）。済んだとは扱わない |

### 清掃の品質（管理者指摘への対応）
- 状態を分離: `未処理 / 自動処理済・未検証 / 自動検査合格・目視未確認 / 品質確認済 / 要確認 / 不合格`。品質確認済は品質記録（`QUALITY_LOG_HEADERS`）に「目視」「検証者」「原文SHA256」「清掃版」が揃うときだけ。
- `planSummaryProjection` は品質確認済だけを投影（自動処理済・自動検査合格は投影しない）。`planSummaryCleaning` は品質確認済の行を新しい版で上書きしない。
- 第5段階で COPY に投影した5件（N6557:N6570）は**取り消して空欄に戻した**。収蔵詳細の5行の状態は「清掃済」→「自動処理済・未検証」（読み戻し確認済み）。
- 監査器 `summary-quality-audit.mjs`（SQA-1・原文だけを基準に、誤削除/部分削除/固有名詞消失/削除漏れ/出演者の本文混入/HTML残骸/URL・追跡パラメータ残り/記事URL消失/見出し結合ミス/出演者の欠落・混入/関連記事への宣伝混入/改行破壊 を分類。迷う行は採点しない）と、回帰fixture 9種（合成文）`tests/fixtures/summary-quality-fixtures.mjs`、試験 `tests/summary-quality-audit.test.mjs` 14件。
- fixture で見つかり直した清掃規則（v2rules-3）: CDATA が本文に残る／関連記事欄に宣伝・非記事リンクが混入（記事URLのみ採用、宣伝は除去、見出しなし非記事リンクは HOLD）／段落の改行が失われる。旧 `editDescription` 単独では fixture 9種中 8種で誤り（Megaphone 定型の削除漏れ・本文内URL・【まとめてわかる】記事URL消失・出演者欄への宣伝混入）。
- 既存V2の「概要（清掃済）」の実データ監査（約6,000件・層化）は**未実施**。理由: 比較基準の原文がワークスペースに無く、GitHub への本文転送は禁止。独立COPY GAS が原文を保全した後に、同じ監査器を GAS 側または封緘経路で実行する。参考: COPY の N6551・N6554 で既存値に宣伝文・追跡URL・見出し行の残存を目視確認（抜き取り2件であり誤り率ではない）。
- 品質未検証: 収蔵詳細26件すべて（原文あり5件は自動処理済・未検証、21件は原文未取得で判定不可）。

### 管理人に必要な操作（1回）
`gas/p25v2-copy/README.md` の「管理人の操作」1〜8（新規独立プロジェクト作成→権限ファイルと1ファイル貼付→CHECK で OAuth 許可→DRYRUN→WRITE_ONE→VERIFY→結果共有）。

## §16 GAS実機試験の前提（2026-11-11）— 実機は未実行
- 分岐: DRYRUN の CANDIDATE=0 なら WRITE_ONE/VERIFY は実行せず、`P25V2_5_BACKFILL_RAW` で既存21件の原文補完（1回最大10件）を実機試験の対象にする。架空の回は作らない。手順は `gas/p25v2-copy/README.md`。
- コード変更: CHECK は全件取得の時間（`fetchAllMs`・番組別 `ms`/`chars`）と公開数を報告、2分超は `CHECK_FETCH_TOO_SLOW`。WRITE_ONE は取得エラーがあれば書込0で `STOP_FEED_ERRORS`、追加0なら検証記録を作らない。VERIFY は書込記録なしで `NO_WRITE_TO_VERIFY`。BACKFILL は取得エラーで停止・4分超で停止、EP-ID/GUID が台帳と一致する行だけ、書込前に空欄を再確認、読み戻しで SHA256 と文字数一致、収蔵詳細17列の全セル比較で他セル不変（`otherCellsChanged`）、公開数の前後一致、再実行は `OK_NO_CHANGE`。
- 模擬PASS: `tests/p25v2-copy-gas.test.mjs` 8件（P25V2関連 計74件）。実機の測定値（取得時間・件数・埋めた件数・HOLD理由・差分0）は管理人の実行後にここへ追記する。

## §17 GAS作成・配置・実行の自動化の調査（2026-11-11）
| 手段 | 結果 |
|---|---|
| Google Drive コネクタで Apps Script プロジェクトを作成（`application/vnd.google-apps.script+json` の取り込み） | **不可**（実測: コネクタが「Google形式のファイルは外部形式の中身でしか作れない」と拒否）。他に作成手段なし |
| clasp（作業環境から） | **不可**。clasp は未導入で、npm の導入は通信設定で拒否。仮に導入できても管理人の Google ログイン（`clasp login`）が必要 |
| Apps Script API（projects.create / updateContent / scripts.run） | **不可**。作業環境に Google の認証情報が無い（gcloud 未ログイン）。利用には管理人が API を有効化し、OAuth で許可する必要がある。`scripts.run` には実行可能APIとしてのデプロイとGCPプロジェクト連携も要る |
| GitHub Actions + clasp | **採らない**。管理人の Google 更新トークンをリポジトリのシークレットに置く必要があり、漏れたときの被害が大きい |
| Claude in Chrome（管理人のChromeで script.google.com を操作） | **今回は不可**（拡張機能が未接続。管理人はスマホから操作中）。PCのChromeで拡張機能が使える場合は、新規作成・貼付・保存・関数の実行まで代行でき、管理人の操作は権限承認画面のクリックだけになる |
| GitHub から読み込んで実行するローダー | **採らない**（外部から取得したコードの実行は安全でない） |

結論: 現在の環境では作成・配置を代行できない。管理人の操作を最小化した手順は `gas/p25v2-copy/README.md`（作成→2ファイル貼付→各関数の実行→許可）。PC の Chrome で Claude in Chrome が接続されれば、許可のクリック以外を代行できる。

### §16 実機結果（2026-11-11 21:50〜21:55 JST・Claude in Chrome で操作、OAuth 許可は管理人本人）
- 独立プロジェクト: 「V2収蔵ボット COPY試験（P25V2・独立COPY専用）」 scriptId `1qVI_cmpGS1yz8iKJ1IvD8bWPSYP_xdcN-nLoMq-IdLyYauIClIQYWtqw`。配置物は b199be6 の `dist/` と SHA256 一致（P25V2CopyIngest.js b01e01dd…d6cb、appsscript.json 6cd9946a…fb34。保存後に再読込して照合）。トリガー 0。
- 経緯メモ: 1回目に既定関数 `P25V2_INGEST_COPY` の実行を誤って押したが、承認前の画面で取り消し、実行記録 0 件（何も動いていない）。
- `P25V2_1_CHECK` → **CHECK_OK**。対象 COPY（名前に【COPY試験】）、見出し 34/9/17、全件取得 7本 5,483件（ニュースの現場から 2,673・MEDIA TALK 1,770・こどもそうだんしつ 42・スポンジ 186・ニュースの学校 505・ドーナツ 83・報談 224、原文あり全件）、取得合計 5,778ms・約3,200万字、公開数 6033、取得エラー 0。実行全体 約20秒（6分上限に十分余裕）。
- `P25V2_2_DRYRUN` → 候補 **0**・HOLD 0・BLOCK 0・既収蔵 204・題名変更 6（EP-06692・EP-06667・EP-06638・EP-00061・EP-00066・EP-00067。GUID一致で題名だけ変化。台帳は書き換えず記録のみ）。→ 分岐B。
- `P25V2_5_BACKFILL_RAW` ×4（COPY 収蔵詳細のみ）:
  1回目 OK 10件（EP-06696/06697/06699/06700/06701/06702/06703/06705/06707/06709）19.9秒、
  2回目 OK 10件（EP-06710〜06719）23.9秒、3回目 OK 1件（EP-06720）11.8秒、
  4回目 **OK_NO_CHANGE**（追加0・差分0）11.7秒。全回 HOLD 0・他セル変化 0・公開数 6033→6033・取得エラー 0。
- 外部読み戻し（Sheets）: 収蔵詳細 26行すべてで SHA256 が64桁の全長になり、記録済みの前方16桁と一致。補完21行の状態は「未清掃」、第5段階の5行は「自動処理済・未検証」のまま。実行ログ（V2・実行ログ）4行に本文なし。
- 受入条件: GAS実機での動作 ✔（CHECK_OK・DRYRUN・BACKFILL OK）／エラー時停止 — 実機では異常が起きず未発生（停止動作は模擬試験で確認済み）／再実行で差分0 ✔（OK_NO_CHANGE）。WRITE_ONE・VERIFY は新着が無いため未実行（新着が出た日に実施）。
- 原文保全: 26件中26件（100%）。清掃・品質確認はこれから（別工程。未検証の清掃結果は台帳に入れない）。

## §18 V2作業用への新着一括収蔵（2026-11-12 実機）
- 実装: `gas/p25v2-copy/src/P25V2V2WorkingMain.js`（P25V2_V2_1_CHECK / 2_DRYRUN / 3_WRITE_BATCH / 4_VERIFY）。既存の収蔵処理・検証をそのまま使い、書込先だけ V2作業用。トリガーなし。
- 採番衝突防止: 実行ごとに V2・統合台帳／固定ID採番履歴／削除・除外履歴／エピソード台帳／COPY試験の最大番号を読み、それより後ろだけ新規採番。COPYで同じGUIDに振った番号は、V2作業用で未使用なら同番号を使う。
- ガード: V2作業用はID固定・名前「基本台帳 V2 作業用」・承認フラグ必須。他の保護ID（V1・本番59列・旧GAS）は従来どおり拒否。
- 実機結果（コミット 56396c8 配置、SHA256 一致）: DRYRUN 候補28件 → WRITE_BATCH 10+10+8=28件追加（EP-06695, 06698, 06700〜06725。全件COPYと同番号）→ 4回目 追加0・候補0（既収蔵204）→ VERIFY_OK（台帳1行・GUID一致・採番履歴登録完了・原文SHA256一致・EP-ID重複なし・採番済残りなし）。公開件数 6033 → 6033（新着は未判定のため非公開）。
- 外部読み戻し（Sheets）: 統合台帳 6557〜6584行・固定ID採番履歴・V2・収蔵詳細の28件すべて GUID 一致。
