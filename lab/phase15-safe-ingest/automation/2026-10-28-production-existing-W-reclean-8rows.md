# Phase15 既存W列も上から順に品質再清掃
2026-10-28 user instruction. Production ledger 1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4 エピソード台帳, rows 5–12 EP-00004–EP-00011.
Source: existing V raw description, AC related URL column; exact GUID/ID read before write. W-only correction, V preserved. Re-read W5:W12 after update: all 8 matched expected. **8 existing W cells corrected, 0 newly blank W cells populated**.
Rules: remove 【番組内容】 label, 【出演・スタッフ】, 【出演】, 【出演者】, 【おねがい】, generic promos; keep substantive body, recording date, 【関連記事】 heading, titles, actual LF. The V source here uses literal escaped \\n, normalized to LF. Pair AC URLs by original order only if URL count equals article-title count; do not invent links.
EP-00004 row5: 3 article titles, 4 AC URLs — titles retained, URLs withheld pending source matching.
EP-00005 row6: no 【関連記事】, 【おすすめ】 generic promo omitted.
EP-00006 row7: 3 article titles, 3 AC URLs paired.
EP-00007 row8: 3/3 paired, election livestream announcement omitted.
EP-00008 row9: 5/5 paired.
EP-00009 row10: 3/3 paired.
EP-00010 row11: 3 titles, 1 AC URL — titles retained, URL withheld.
EP-00011 row12: 3 titles, 1 AC URL — titles retained, event announcement omitted, URLs withheld.
**Important**: even equal URL/title counts do not independently prove article URL semantic correspondence; source-specific validation remains advisable before treating pairings as fully verified. Need review and improve cleaner before automated 100/500 batch. Next review row 13. No triggers installed.