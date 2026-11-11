# V2新着収蔵ボット（Phase25→V2）引き継ぎ記録

最終更新: 2026-11-11 JST / PR #306（Draft）/ 判定: **PARTIAL**（P0はCOPYと実RSSで完了。GAS実機・日次運転・P1〜P3は未完）

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
