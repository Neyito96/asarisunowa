# 朝ポキの田｜新司令塔 航海再開監査・部門指令（2026-10-27 JST）

## 証拠水準と起点
- 引継正本: `asarisunowa:main:docs/command-center/2026-10-27-command-center-handoff.md`（直接全文確認）。
- 今回はGitHubの文書・PR・manifestを直接再取得した。GAS実行ログ、Google Sheets最新現物、ライブPages、音源実体は未実測。
- GitHub文書保存とGAS実機成功、公開承認は別物。ユーザー提示の6,632件は10/26実機報告値で10/27独立再読値ではない。

## 追加で確定した事実
- PR #259 merged=true、merge `8438d5d905ac1e3a5dc1bc54cd3149552dd9c2a2`
- PR #260 merged=true、merge `c54449509f5603e3ace6a2b3e08a3da5cec71e06`
- PR #261 merged=true、merge `fe936bee0d12697fb492a3bc8408ee1abc7ad289`。実ファイル `main:docs/audits/2026-10-26-kurabito-publication-v3-crosswalk.md`。
- `main:public/library/data/manifest.json` は total=5848、publicationScope adopted=5848、source=6591、scopeExcluded=377、scopeHeld=366、decisionDate=2026-10-22（GitHubファイル確認）。ライブ配信状態とは区別。
- 蔵人crosswalkでは31公開候補・5 V3要保留・3重複保留・2要調査で合計41。31は公開未承認。31件を足した仮数5879を本番件数と呼ばない。
- 宇宙 `work/semantic-normalization-20261026:docs/command-report-20261026-phase2-acceptance-followup.md` と `docs/semantic-taxonomy-proposal-20261026.md` を読取。旧分類記録5667/5848、未照合181。人間承認109固定、20主題は暫定。回収率≠正確性。
- 収蔵系 `feat/phase14-production-gas-handoff-20261025:docs/command-center/2026-10-26-production-ingest-audit.md`：6件V3 nativeハッシュ未検証、COPY V19 10/27朝実行ログ未取得。
- 同ブランチ `docs/command-center/2026-10-26-backfill-dryrun-code-review.md`：公式COPY DRY_RUNは実機NOT_RUN。

## 部門別指令（書き込み・公開許可ではない）
### P0 収蔵ロボ
1. 10/27 COPY V19の約05:15・06:15 JSTの実行履歴をREAD_ONLY取得。status、added、existing、held、errors、productionWrites、triggerChangesを記録。既存COPYトリガーは絶対に触らない。
2. EP-06627〜06632のnative55列現在値、行ハッシュ、V3、採番履歴、GUID、登録/修復ログを突合。証明不能ならPENDING_REVIEWのまま。
3. MEDIA TALK新EP-06595/06596/06597と旧EP-03857/03858/03861をGUID・公式URL・音声URL・長さ・音源実体でREAD_ONLY比較。「同一／異なる／未確定」を証拠付きで返す。EP-ID削除・変更禁止。
4. 遡及EP-06632を見落とす最新3件RSS窓の限界とキャッシュ鮮度を設計課題として維持。本番無人採番は禁止。

### P0 蔵人
1. 31件それぞれ公式ソース、配信日時、旧掲載基準、重複、V3証拠を記録し「正式採用提案／追加確認／見送り」に分類する。
2. 保留10件は別台帳。公開差分EP-IDリストをプレビューするだけ。本番D列と蔵/宇宙公開JSON・Pagesは変えない。
3. おんさ5,461の定義を母集団・対象外・重複別に確認。個人情報と全セルの公開GitHub複製禁止。

### P0 補填ロボ
1. `Phase14BackfillFiveOfficialDryRun.gs` のCOPY GAS配置と真正実行の実証を独立ログで判断。コード保存のみをPASSとしない。
2. 実行前後の台帳行/履歴/V3/トリガー/Properties差分・HTTP結果・候補セルと保留理由を残す。既存保護範囲全列挙未実装も記録する。
3. EP-06630の関連記事3件とEP-06631のゲストXリンクはW既存非空。公式出典付き差分案のみ作り、上書き承認待ち。EP-06632の新規採番は担当外。

### P0 宇宙船長
1. 181件を旧JSON/CSV/コミットからEP-IDで探索し、source_file/commit/statusの来歴を記録。見つからないものはUNRECOVERED、新AIならnew_ai_inferenceに完全分離。
2. 人間承認109件はロック。旧分類5667件と表示ブリッジ間の主題・小テーマ差分を監査。文学・美術110件、スポーツとEP-00531を優先。
3. 20主テーマ/約100小テーマは原本を維持した暫定辞書として検証。星雲は軽量JSON LABのみ。本番/main変更禁止。

## 横断受入・停止線
- 正式公開まで2026-10-22の5848 EP-IDを固定。蔵と宇宙のEP-ID集合一致を毎回チェックし、集合差分があれば中止。
- 原本台帳、GAS、Spotify、ScriptProperties、既存COPYトリガーを無断更新しない。PRの大規模一括マージをしない。
- 本番変更は対象差分、証拠、復旧方法、ユーザーの明示承認が揃うまで不許可。
- 次回司令塔が優先して受領すべき証拠は今朝のCOPY実機ログ、6件ハッシュ、31件個別採否、真正DRY_RUN、181件来歴。 
