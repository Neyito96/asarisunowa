# 話題の地層 V0.1（未公開）

Phase 12の静的プレビュー。既存Pagesのpublicツリーには含めない。
`node scripts/build-universe-sample.mjs` → `python -m http.server 4174 --directory experiments` → `/universe-v0.1/`。

`sample.json` は `universe-strata/0.1`。populationStatus=AUDIT_PENDING、canonicalTotal=nullを必須とする。時系列はJST年月、番組は現スナップショットのラベル、話題はtitle由来のword/field/confidence/sourceIdを保持する。人物・共演・関連記事は独立配列で、未確認の人名を生成しない。将来の人物表記揺れにはentityId、sourceId、根拠、信頼度、未確定区分を持たせる。配信総量/母数のグラフには使わない。

独立URL・repo・デザイン方向の比較と選択理由、未確認事項は `docs/phase12-runtime-publication-2026-10-21.md`。新規公開は承認待ち。
