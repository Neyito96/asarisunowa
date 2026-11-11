# V2新着収蔵ボット（Phase25→V2）引き継ぎ記録 — 2026-11-11

判定: **PARTIAL**（COPYでの実証は全項目PASS。GAS実機への配置と日次運転は未実施＝承認と管理人操作が必要）

## 1. 既存経路の棚卸し（再利用元）
| 項目 | 実体 |
|---|---|
| Phase25 本体 | PR #270 `P25LibraryPipeline.js`（台帳→Spotifyプレイリスト）、`P25CopyAdapter.js`（COPY隔離・保護ID拒否） |
| Phase25 の新着検出 | `p25SourceAudit_`（公式RSSのguidが台帳に無い→SOURCE_MISSING）。**台帳へ書く関数は無い** |
| 本番台帳への日次新着取込 | 本リポジトリに**見当たらない**（台帳側の別GASの可能性・未確認）。実データでは EP-06687〜06694 が「未判定」で日次追加されている |
| 既存トリガー | `AutoUpdateAutomationV1.js`（毎日4時）・`PlaylistAutoThemeReview.js`（毎日5時）＝プレイリスト系。台帳収蔵のトリガーは未確認 |
| Phase25 の台帳参照 | `p25Index_`/`readLedger` は旧59列「エピソード台帳」の列番号固定（0,1,2,3,6,11,22,23）。**V2には未対応**（今回は変更せず、V2収蔵は別アダプタとして追加） |

## 2. 変更ファイル（PR #306、コミット eb2b3f8 ほか）
- `scripts/google-apps-script/P25V2IngestAdapter.js` … V2収蔵アダプタ（COPY専用・追記のみ・最大1行・見出し名で列を解決・保護IDへの書込拒否・読み戻し）
- `scripts/ledger-v2/preflight-ingest.mjs` … GUIDを番組横断で一意に扱う（他番組と同じGUID＝BLOCK）、（再）/再配信の印＝HOLD、題名比較では（再）を除いて照合
- `tests/p25-v2-ingest.test.mjs`（8件）、`scripts/ledger-v2/preflight-ingest.test.mjs`（2件追加、計7件）
- `scripts/ledger-v2/p25v2-copy-trial-A.mjs` / `-B.mjs` … COPY試験の再現用（台帳本文はコミットしない。読取JSONは `TRIAL_DIR` に置く）
- 結果: `docs/release/2026-11-11-p25v2-readonly-dryrun.json`、`docs/release/2026-11-11-p25v2-copy-trial-result.json`

判定規則:
- **BLOCK**: EP-ID・GUID（公式GUID/公式JSON UUID/公式個別URL内のitemid、番組横断）・公式URL（追跡パラメータを除去して比較）のいずれかが重複
- **HOLD**: 同番組・同題、または（再）の印あり
- **ALREADY_INGESTED**: 同GUID・同番組・同題。再実行時の正常系で、追加0件

新着は **掲載判定=未判定・代表EP-ID=自分** で追記する。V2・公開台帳のFILTER（対象かつ代表=自分）には入らない。削除は一切しない。

## 3. テスト
`node --test tests/p25-v2-ingest.test.mjs scripts/ledger-v2/preflight-ingest.test.mjs` → **15/15 PASS**

確認した内容: V2の実見出し34列と一致すること、列順を入れ替えても名前で解決できること、見出しの違い・重複で停止すること、保護4IDへの書込拒否（申告IDと実際に開いたIDの両方）、環境/ID二重確認/COPY名/シート名/スコープ/書込フラグの検証、READ_ONLYでは書かないこと、1件追記→読み戻し→再実行0、BLOCK/HOLDの判定、書込直前に台帳が変わっていたら停止、読み戻し不一致で停止。

## 4. 実測
| 段階 | 対象 | 結果 |
|---|---|---|
| READ_ONLYドライラン | V2作業用（…xedAbc）`V2・統合台帳` 6,555行・公開6,033 | LISTEN RSS 5,190項目＋合成1件 → CANDIDATE 1（合成）、BLOCK 5,190（題名なし。うち5,126はGUID既存）、書込0 |
| COPY作成 | `【COPY試験】V2収蔵ボット P25V2 1件試験 2026-11-11（本番ではない）`（…bnK1PY） | V2作業用とA:Jの内容ハッシュが一致（6,556行） |
| COPY書込 | 1行（6,557行目、EP-06695、合成・未判定） | **書込1件**、読み戻し34列一致、既存6,555行のA:Jは不変 |
| 再実行（同じ入力） | 同じCOPY | **追加0**（ALREADY_INGESTED 1）、追記呼出0 |
| 公開計数 | COPYの`V2・公開台帳` | 6,033のまま（合成行は出ない） |

書込は、アダプタ（Node実行）が算出・検証した行を、Sheets APIでCOPYの1行だけに書いた。読み戻しと再実行の判定もアダプタで行った。GAS実機（`P25V2_INGEST_COPY`）は未実行。

試験行は**実在しない合成の回**（GUID `00000000-…-c0b1e5711111`）。LISTENの個別ページは取得許可の範囲外で題名が取れなかったため、実在の回は使っていない。

参照元/書込先: 読取＝V2作業用 …xedAbc（書込なし）／書込＝COPY …bnK1PY のみ。V1（…J-8BA）・本番59列（…5-2FG4）・旧GAS参照（…jmwQ）・本番Spotify・本番GAS・mainは未変更。

## 5. 未完事項
- [ ] GAS実機試験: COPY専用の独立GASプロジェクトに `P25V2IngestAdapter.js` だけを置き、`P25V2_INGEST_COPY(config, items, false)`→`true` を手動実行する（OAuth承認が必要）
- [ ] 新着の取得元: 公式RSS（Omny/Megaphone）から title/guid/日時/公式URL/音声/概要 を item に変換する部分が未実装（`readSources` を再利用予定）。LISTEN RSSは題名が無いため使えない
- [ ] V2統合台帳には「概要原文」列が無い（清掃済のみ）。原文の保存先が未決定
- [ ] EP-ID採番の正本（`固定ID採番履歴`タブ）との整合は未確認。現状はV2の最大値+1（`reservedMaxEpNo` で下限を指定可能）
- [ ] 同じGUIDで題名だけ変わった回はBLOCK（書かない）になる。題名変更の扱いは要決定
- [ ] `scripts/google-apps-script/` に `.claspignore` が無い。本番へのclasp pushに本アダプタが混入しないよう除外が必要
- [ ] 本番59列台帳の日次取込ロジックの所在（未確認）

## 6. ロールバック
変更したのはCOPYだけ。`【COPY試験】…P25V2…` の `V2・統合台帳` 6,557行目（EP-06695）を削除するか、COPYファイルごとゴミ箱へ移す。他は変更なし。

## 7. 日次自動運転（設計案のみ・未設定）
- COPY専用GASで1日1回、JST 6:10に `P25V2_INGEST_COPY` を実行（既存の4時/5時のプレイリスト系と重ならない時刻）。1回最大1件から始め、PASSが7日続いたら最大10件へ（`maxRows` の上限1の変更は別承認）
- 毎回: 見出し検証→ドライラン→書込→読み戻し→結果を `P25V2_RUNS` タブへ1行記録。BLOCK/HOLDは書かずに件数だけ記録
- 本番（V2作業用やその後継）への切替・本番トリガーの作成は**別途明示承認**

## 8. 運用再開の条件
GAS実機でCOPY 1件→読み戻し→再実行0がPASS／取得元（公式RSS→item）の実装とテスト／`.claspignore` で本番混入を防止／EP-ID採番正本の決定／管理人の明示承認。

## 再現コマンド
```
node --test tests/p25-v2-ingest.test.mjs scripts/ledger-v2/preflight-ingest.test.mjs
# 読取JSON（values.get形式）を TRIAL_DIR に置く: tougou.json(A1:H) tougouIJ.json(I1:J) copyAJ.json(COPY A1:J) test-item.json
TRIAL_DIR=... node scripts/ledger-v2/p25v2-copy-trial-A.mjs    # 一致確認＋1行計画（pending-row.json）
# pending-row.json の行をCOPYの指定行へ書込（GASなら P25V2_INGEST_COPY）、書込後のCOPY A1:J を copyAJ_after.json に保存
TRIAL_DIR=... node scripts/ledger-v2/p25v2-copy-trial-B.mjs '<読み戻した行のJSON配列>'
```
