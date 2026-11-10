# 蔵・宇宙 共通分類辞書 v0（第13号 ①②）2026-11-10

## ① 資産の所在（Neyito96/asarisu-universe, branch work/semantic-normalization-20261026, 実読）
- 20主テーマ・103小テーマ: `data/semantic-normalized-draft/lab-taxonomy-proposal-20261027.json`（status=PROPOSAL_ONLY、全テーマ approved:false）。docs/semantic-taxonomy-proposal-20261026.md に20主テーマ辞書。`asarisu_universe_v012_taxonomy_draft.json` という名前のファイルはこのブランチでは未確認。
- 承認状態（混同禁止）:
  - human-approved-109.json: 109件 user_approved / locked。
  - legacy-recovered-from-381.json: 旧分類救出200件（assistant_reviewed 147, title_only 33, proposed 15, hold 5。人間承認ではない）。
  - semantic-recovery/shard-00〜18: 5,358件（provisional 5,257, title_only 68, assistant_reviewed 33）。
- **重要な発見**: 5,358件のうち「大分類/小分類」形式は約100件のみ。provisional 5,257件の main_theme は自由記述（話題名）で、20主テーマへの適用は未実施。draft の normalized_main_theme も同様に自由記述で、20分類の適用済みデータではない。
- 地図/星雲: test1024-map, oceanic-lab, geo-shards（未精査。③で接続）。

## ② 本PRの内容
- `public/library/taxonomy.mjs`: 20主テーマ・103小テーマにID・同義語・親子を付与。旧ラベル別名(`LEGACY_ALIASES`)。1文字語禁止、定型文/関連記事/朝日小学生新聞を除去、タイトル3倍加重、曖昧・証拠不足は HOLD、`locked` は上書きしない。
- `scripts/eval-taxonomy.mjs`、`tests/fixtures/taxonomy-labels.json`（ID+旧ラベル+由来のみ342件）、`tests/library-taxonomy.test.mjs`（6件）。
- 実測（342件、プレビュー5,945件の本文使用。正解=旧ラベルを20主テーマへ別名対応、単一ラベルのため複数テーマ該当は不利側）:

| | 判定付与率 | 正解 | 誤り | HOLD | 適合率 | 再現率 |
|---|---|---|---|---|---|---|
| Before(主題名の部分一致) | 15.2% | 37 | 15 | 290 | 71.2% | 10.8% |
| After(辞書) | 43.0% | 103 | 44 | 195 | 70.1% | 30.1% |

- 評価: 再現率は約2.8倍。適合率は横ばい(約70%)で、**自動確定には不足**。タグは「提案(provisional_auto)」止まり。誤りの多くは複数テーマ該当（経済×国際等）で、副テーマ対応が次課題。
- 未実施: 5,845件への全件適用、同義語の人間レビュー、小分類の判定、星雲UIへの接続。
