# 配信先URLの空き調査と補完（2026-11-20〜21・#427）

管理人指示（2026-11-20 23:40）「調査、補完計画、GAS実行まで一気通貫」。台帳への書込は**空欄にだけ**、書いた後に読み戻す。

| ファイル | 中身 |
|---|---|
| probe.json | 番組ごとの Apple 番組情報・フィード件数・空き回の抜き取り検索（読み取り専用・Actions） |
| find-show.json | SDGsを話そう の過去回の置き場所（Apple「SDGsを話そう アーカイブ」id6802972000・1092回／蔵899回が全て題名＋日付で対応） |
| apple-map-*.json | 空き回を iTunes Search で全件検索し、題名＋配信日（±2日）で1対1に対応した回だけの対応表 |
| fill-plan.json | GAS「P33_配信先補完_実行」が読む書込計画（空欄にだけ書く） |
| backup-pody-W-20261121.json | Pody 列（W）を書く前の全行の値 |

再現: `node scripts/library/platform-gap-probe.mjs probe|find-show|apple-map <番組>`（GitHub Actions「Platform gap probe」で実行）
