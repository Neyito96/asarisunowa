# 2026-10-26 16:39 高速RSS V2再実行成功

実機ログ: feeds=7, checked=21, available=5416, candidates=1, guidCacheCount=1374, rowsRead=0, errors=[], writes=0, idsAllocated=0, triggerChanges=0。16:39:58〜16:39:59、約1秒。

GUID増分キャッシュが再実行時に効くことを確認。同一の過去候補「【もっと話そう】数えて比べて 楽しむ骨」（GUID a07f0210-b98d-4e6d-9d21-b4c9005ccdfc）が引き続き候補として出る。これは新着ではないため、自動登録しない。今後は配信日と複数の識別項目で重複調査・保留判定を実施する必要がある。

注意: ScriptPropertiesに依存するGUID索引は本番台帳の手動更新・既存行のGUID変更を検知できない。正式採番直前には改めて完全な整合検証を行う。COPYトリガーは維持。