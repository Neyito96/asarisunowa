# 司令塔｜Phase15 LAB 16/16一次受入・欠損状態への対抗試験と修正指令
2026-10-27 JST | **GitHub LABブランチでの修正・合成テストのみ許可**。本番/COPYのGAS・台帳・Properties・trigger・公開は変更禁止。

## 原本レビュー
branch `lab/phase15-safe-ingest-engine-20261027`, commit `63a9ea72877830aa4eff2abd478da4274fd1d663`。
`lab/phase15-safe-ingest/engine.js` blob `4307cec350167336482171ff0cf8bb6bc83b4857`
`lab/phase15-safe-ingest/test.js` blob `fe06844a9e0343087270af024fa4a9646321e755`
`lab/phase15-safe-ingest/README.md` blob `c17614ec544275caff6bfb3503ce847242ad1680`。
GitHubから3ファイルを司令塔が直接取得し静的レビュー。ローカルNode16件PASSは担当ロボ報告であり、司令塔自身による独立再実行ではない。元のオンラインV18/V19/LibraryOfficialEngine完全ソースとの同等性は未確定。LABはCommonJSメモリ上の合成エンジンでありGASに直接デプロイ不可。

## P0 発見された安全上の隙間
1. `run`内の`if(same&&!prior){checkpoint=i+1;continue}`はledgerが存在するだけでスキップし、V3・proof・履歴の整合性を確認しない。旧台帳に履歴のない正当な行があるためhistory欠落を一律STOPとはできないが、既存行の分類と不整合のHOLD/STOPの区別が要る。
2. `step()`は`h.state===COMPLETED`なら、ledger/V3不在でも十分な検証をせず成功として次へ進み得る。既存履歴COMPLETED＋欠損 ledger/V3 の合成テストを追加し、無条件スキップ禁止。
3. history側のGUID/ID重複、ledgerの重複ID/重複GUID、V3同ID多重・proof不一致、`item.url`と保存履歴URLの食い違いが複数存在する場合の挙動を明示し、矛盾はFAIL_CLOSED（既存行破壊なし）。
4. feed checkpointは配列indexだけで、RSSの新着追加・並び順変更後に誤スキップし得る。ソース側の順序不変を仮定せず、GUID集合/高水位等のより安全な再検査方式をLABで検証。実際の新着全件保証はソース網羅性未確定につき未保証。
5. `this.locked`は同一インスタンスのみ。異なるエンジンインスタンス/別GAS projectの排他でないので合成状態共有の競合ケースを追加し、単一writer確認なしでは全write pathが起動不能の制約を維持。
6. `proof='synthetic:'+guid+':'+id`は現行55列native rowHash証拠ではない。合成proofと本番検証proofをREADMEと試験レポートで明確に区別する。

## 修正・納品指令
7. 上記1〜5の再現テストを**修正前RED→修正後GREEN**で実装し、テストケース名・エラー発生と状態不変/保持が確認できるassertionsを明示する。テストハーネスがFAILを取り込むだけで終了コード0にならないよう回帰確認。テスト件数16は既存分の基準。件数だけの積み増しを目標にしない。
8. 合成新着1件4件/11件・途中RESERVED/LEDGER/V3/COMPLETED・6分前stopを保持しつつ、書込前の本番authority/他writer/既存競合確認と、checkpoint保存後再開による冪等性を証明。偽りの`COMPLETE`は返さない。
9. 修正は`lab/phase15-safe-ingest-engine-20261027`または新規LABブランチの`lab/phase15-safe-ingest/`内に限定。READMEへknown limitations、ログ/試験手順、オンラインコード不足と実GAS adapter未実装を明記。mainや本番へのPRマージ/デプロイは承認しない。
10. 生RSS 7番組＋旧SDGs全日比較`SOURCE_PENDING`、本番writer`NOT_VERIFIED`、本番EP-06632保護、COPYの同番号移植禁止を継続。

## 次報
コード差分・RED→GREENの具体的テスト結果・コミット・残るNO-GOゲートをGitHubで提示すること。抽象RUNBOOKだけの提出は受入対象としない。
