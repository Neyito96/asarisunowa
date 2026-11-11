# LISTEN K列 残件マニフェスト v2 — 結果・未完事項・再開手順（第50号）

作成: 2026-11-11 JST / 担当: Claude（開発実行役）/ 状態: **読取専用で生成のみ。本番書込・GAS配置・トリガー・マージは未実施。**

## 1. 結果（2026-11-11 11:50 JST 頃の本番台帳スナップショット）
| 項目 | 件数 |
|---|---:|
| 台帳行（EP-ID） | 6,694 |
| K列（LISTEN）記入済み → **上書きしない** | 3,918 |
| 有効EP（BD=対象 かつ 判定タブ=通常/日時差分 かつ 代表=自分）で K空欄 | 1,200 |
| **厳格マニフェスト（補填対象・確定）** | **888** |
| 別承認用レビュー（同一GUIDを非対象の他番組行と共有する代表行） | 119（厳格版に含めない） |

暫定値「約918件」→ **実数 888件**。差の主因は、旧候補にあったが今回の有効EP判定（BD列「掲載判定」）で保留/対象外/未判定となった行、および重複GUID行を厳格に除外したこと。

番組別（厳格888）: 現場433 / MEDIA TALK 364 / 学校66 / 報談19 / ドーナツ3 / スポンジ2 / こども1。

除外内訳: K記入済み3,918、SDGs行1,092（LISTEN配信なし。SDGs1095正本と1,092件すべてGUID一致を確認）、対象外293、保留168、未判定23、台帳内GUID重複282（うち119件はレビュー一覧へ）、RSS未一致25、HOLD5。

ロボットのDRY_RUN（スナップショット相手・書込なし）: 888件すべて WRITABLE、SKIP 0、読取API 72回、書込呼び出し 0回。

## 2. 成果物
- `scripts/ledger-fill-robot/build-manifest-v2.mjs` … 生成プログラム（EP-ID+GUIDキー・見出し名確認・SDGs1095優先・有効EPのみ）
- `docs/release/2026-11-11-listen-k-v2-manifest-b1.json` … 固定マニフェスト（888セル, runId `listen-k-v2-20261111-b1`, sha256 `68b5acd7a9c05285402f1ce6006e7afb9e25c21de8631fa0b05ce7d546d04de6`）。**行番号は含まない。**
- `docs/release/2026-11-11-listen-k-v2-manifest-report.json` … 件数・除外理由・EP-ID例・SDGs照合
- `docs/release/2026-11-11-listen-k-v2-review-shared-guid.json` … 別承認用レビュー119件（`REVIEW_ONLY_NOT_APPROVED`）
- `scripts/google-apps-script/LedgerFillRobot.js` … 追加: `keyPolicy:'EPID+GUID'` の検証、書込直前の行GUID再確認（`SKIP_GUID_MISMATCH`）、EP-ID基準の全行差分監査 `auditDiffByEp`
- `tests/ledger-fill-robot-v2.test.mjs` … 追加11件（重複・行移動・SDGs・見出し変更・固定sha等）。既存12件と合わせ **23/23 合格**

台帳本文（タイトル・概要等）はリポジトリに置いていない。マニフェストは EP-ID・GUID・LISTEN公開URL・番組名・RSS配信日のみ。

## 3. 判定ルール（v2）
1. 基本キー = EP-ID + GUID（J列 itemid / G列 外部ID。両方あって食い違えば HOLD）。行番号は使わない。
2. 有効EPのみ: BD「掲載判定」=対象、かつ「図書館・宇宙 検索対象判定」E=通常/日時差分、G代表EP-ID=自分。
3. SDGs1095 を SDGs番組の正本とする（S列UUID・M列itemid）。SDGs行は対象外。他番組行のGUIDがSDGs1095と衝突したら HOLD。
4. LISTEN RSS guid 完全一致（RSS内で一意）＋番組一致＋JST暦日±1日＋URL形状 `https://listen.style/p/xxxxxxxx/xxxxxxxx`。
5. 既存K非空・K既使用URL・RSS内URL重複・マニフェスト内URL重複は除外。HOLD 11件リストは従来どおり。
6. 列は見出し名で確認し、台帳V2で列順が変わったら `HEADER_MISMATCH` で停止。

## 4. 未完事項（承認待ち・未確認）
- [ ] **本番書込は未承認**（888件・レビュー119件とも）。書込はGASロボット経由のみ（Claude逐セル書込は再開しない＝第49号）。
- [ ] COPY台帳でのGAS実機試験（手順書: `docs/operations/2026-11-11-ledger-fill-robot-gas-setup.md`）。
- [ ] 「台帳V2」の正式な列構成は **未確認**。現時点は行番号非依存＋見出し確認で対応。
- [ ] RSS未一致25件（EP-00043等の古い現場回）は原因未確認。
- [ ] 第41号 再生可能性チェッカー設計（HTTP200≠再生可能）。
- [ ] マニフェストは11/11 11:50時点。書込時にロボットが EP-ID・GUID・空欄を再確認するが、日数が空いたら再生成を推奨。

## 5. 再開コマンド（誰でも同じ結果を再現できる）
入力はすべて読取専用で取得する。
1. 本番台帳を Sheets API `values.get` で取得し JSON 保存（台帳ID `1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4`）:
   - `エピソード台帳!A1:K6695` → `AK.json`
   - `エピソード台帳!BD1:BE6695` → `BDBE.json`（行数は A:K と同じにする）
   - `図書館・宇宙 検索対象判定!A1:G6700` → `scope.json`
   - `SDGs1095!A1:V1095` → `sdgs.json`
2. LISTEN RSS: PR #299 の最新 `lpa-dump:lpa-part-00〜12` コメント（2026-11-11T02:34Z 実行分）を順に連結して `lpa.json`（または `scripts/probe-listen-pody-amazon.mjs` を Actions で再実行。**[pody-run] 等のマーカーで重複起動しない**）。
3. 生成:
   ```
   node scripts/ledger-fill-robot/build-manifest-v2.mjs --ledger AK.json --judge BDBE.json --scope scope.json \
     --sdgs sdgs.json --rss lpa.json --out out/listen-k-v2.json --report out/listen-k-v2-report.json \
     --run-id listen-k-v2-YYYYMMDD --max 1000
   ```
   同じ入力なら同じ sha256 になる（固定マニフェスト）。
4. テスト: `node --test tests/ledger-fill-robot.test.mjs tests/ledger-fill-robot-v2.test.mjs`（23件）
5. 書込（承認後のみ）: GASで `runLedgerFillRobot(manifestJson, 'DRY_RUN')` → 結果確認 → 承認記録のうえ `'WRITE'` → 前後 A:K を取得して `auditDiffByEp(pre, post, manifest)` の `unexpected === 0` を確認。異常時は停止して報告。
