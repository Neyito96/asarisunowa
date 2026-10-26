# 2026-10-26 16:38 高速RSSシャドーV2実機試験

本番GASで `phase14ProductionRssFastShadowV2` を実行。ログは `feeds=7`, `checked=21`, `available=5416`, `candidates=1`, `guidCacheCount=1374`, `rowsRead=6631`, `errors=[]`, `writes=0`, `idsAllocated=0`, `triggerChanges=0`。16:38:39〜16:38:48の約9秒。

唯一の候補：こどもそうだんしつ「【もっと話そう】数えて比べて　楽しむ骨」、GUID `a07f0210-b98d-4e6d-9d21-b4c9005ccdfc`、公開日時 2026-10-13 19:05 UTC（JST 10/14 04:05）、出演者 松原由幸・大木理恵子・杢田光。新着ではなく、GUID未一致の過去回か別ID登録済みの可能性があり、採番前に重複確認が必要。

初回GUID索引作成で6631行読込、次回は増分読込の期待。二回目の実機結果は未確認。RSS全量は通信・XML解析しているため、21件のみに絞れたのは詳細検査であってダウンロード量ではない。COPYのトリガーは変更なし。