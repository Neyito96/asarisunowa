# 2026-10-26 13:42｜COPY最新5件の新着フォーマッター実機試験

ユーザー実行: `phase14NewEpisodeCopyFiveDryRun`、`status=READ_ONLY`, `inspected=5`, `writes=0`, `triggerChanges=0`。

| EP | W 概要抽出 | 出演者抽出 | 観察 |
|---|---|---|---|
| EP-06627 MEDIA TALK | CLEAN_CONFIDENT | CAST_CONFIDENT (中島晋也/奥山晶二郎/神田大介) | 実機の新規形式テスト合格 |
| EP-06628 ニュースの学校 | NEEDS_REVIEW | NO_EXPLICIT_SECTION | Megaphone、本文後に案内が連なる |
| EP-06629 報談 | NEEDS_REVIEW | NEEDS_REVIEW | Megaphone、平文1行内で【出演・スタッフ】が始まり、冨名腰隆/杢田光が埋め込まれている |
| EP-06630 ニュースの現場から | CLEAN_CONFIDENT | CAST_CONFIDENT (大木理恵子/望月愛実/宮沢賢一) | W に `&hellip;` が残存するためHTML実体参照デコードを追加すべき |
| EP-06631 ドーナツ | NEEDS_REVIEW | NEEDS_REVIEW | 本文が【番組内容】タグなし、出演者に `MC、音源編集` 複合役割、`菜緒都さん`を人物名として認識する必要 |

**統計**: 清掃・出演者両方成功2/5、保留3/5。コードによる成功は本文の正確さの人手精査を完全には代替しない。COPYの既存Wには5件すべてに広告/宣伝の残存疑いあり。

**次の変更目標**:
- 明示的【番組内容】なしの場合でも、宣伝などが始まる直前の確かな説明文段落だけを採用。
- Megaphone平文の【出演・スタッフ】直後に人名とMCが連続する場合の解析。
- 全角/読点区切りの複合役割、敬称「さん」の処理。
- `&hellip;` 等HTMLエンティティ。
- 不確実な原文を無理に削除・推測せず、`NEEDS_REVIEW` とする。
- 本番/GAS/COPYへの書き込み・採番は実機監査前に有効化しない。
