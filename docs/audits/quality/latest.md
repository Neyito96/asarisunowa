# 品質監査レポート（2026-11-19T22:18:30.430Z）

蔵の公開データ 6090件（snapshot 2026-11-19・版 a685240a2a6eeaa7）を、読み取りだけで監査。**未検証（UNVERIFIED）・確かめられない（BLOCKED）は正常として数えていない。**

## サービス別の URL 登録

| サービス | 登録 | 登録率 | 個別回の形でない |
|---|---|---|---|
| 朝日新聞公式 | 6011 / 6090 | 98.7% | 0 |
| Omny | 5887 / 6090 | 96.7% | 1 |
| Spotify | 6077 / 6090 | 99.8% | 0 |
| Apple Podcasts | 3649 / 6090 | 59.9% | 1 |
| Amazon Music | 259 / 6090 | 4.3% | 0 |
| Pocket Casts | 6090 / 6090 | 100% | 0 |
| YouTube | 0 / 6090 | 0% | 0 |
| LISTEN | 4995 / 6090 | 82% | 0 |
| Pody | 5072 / 6090 | 83.3% | 0 |
| stand.fm | 0 / 6090 | 0% | 0 |

## リンク先の疎通（今回の抜き取り）

| サービス | 確認数 | 正常（題名一致） | 異常 | 要確認（別の回の疑い） | 未検証 | 確かめられない |
|---|---|---|---|---|---|---|
| spotify | 12 | 11 | 1 | 0 | 0 | 0 |
| pocketcasts | 12 | 0 | 2 | 10 | 0 | 0 |
| omny | 12 | 0 | 0 | 0 | 12 | 0 |
| apple | 12 | 12 | 0 | 0 | 0 | 0 |
| listen | 12 | 12 | 0 | 0 | 0 | 0 |
| amazon | 12 | 0 | 0 | 0 | 0 | 12 |
| asahi | 12 | 0 | 0 | 0 | 0 | 12 |
| pody | 12 | 0 | 0 | 0 | 0 | 12 |


## 件数

- リンク切れ（確認済み）: 901
- 誤った回へのリンクの疑い: 13
- 概要欄の要確認: 32
- 出演者の要確認: 123
- 収蔵の要確認（重複・再生時間など）: 13
- 公開件数: PASS（6090件で一致）
- 宇宙と蔵の版: PASS（どちらも a685240a2a6eeaa7）

## 前回からの変化

- brokenLinks: +3
- descriptionIssues: 0
- castReview: 0
- publicEpisodes: 0

## 人の確認が要る上位案件

- EP-00686｜URL｜別の回と同じ URL｜EP-00093 と同じ: https://podcasts.apple.com/jp/podcast/%E6%B0%B4%E9%81%93%E6%96%99%E9%87%91/id1551595534?i=1000718717650&uo=4
- EP-00825｜URL｜別の回と同じ URL｜EP-00703 と同じ: https://podcasts.apple.com/jp/podcast/%E7%94%9F%E6%B4%BB%E4%BF%9D%E8%AD%B7/id1551595534?i=1000681771978&uo=4
- EP-03899｜URL｜別の回と同じ URL｜EP-03898 と同じ: https://podcasts.apple.com/jp/podcast/%E6%A5%BD%E5%B1%8B%E8%A3%8F-%E3%81%8A%E3%81%BE%E3%81%88%E3%81%AF%E8%AA%B0%E3%81%A0
- EP-05988｜spotify｜リンク切れ｜Spotify「Page not found」
- EP-04430｜pocketcasts｜別の回の疑い｜リンク先の題名「Error 403 | Pocket Casts」
- EP-04887｜pocketcasts｜別の回の疑い｜リンク先の題名「Error 403 | Pocket Casts」
- EP-05248｜pocketcasts｜別の回の疑い｜リンク先の題名「Error 403 | Pocket Casts」
- EP-05746｜pocketcasts｜リンク切れ｜HTTP 404
- EP-06296｜pocketcasts｜リンク切れ｜HTTP 404
- EP-00726｜pocketcasts｜別の回の疑い｜リンク先の題名「Error 403 | Pocket Casts」
- EP-01314｜pocketcasts｜別の回の疑い｜リンク先の題名「Error 403 | Pocket Casts」
- EP-01859｜pocketcasts｜別の回の疑い｜リンク先の題名「Error 403 | Pocket Casts」
- EP-02378｜pocketcasts｜別の回の疑い｜リンク先の題名「Error 403 | Pocket Casts」
- EP-02895｜pocketcasts｜別の回の疑い｜リンク先の題名「Error 403 | Pocket Casts」
- EP-03439｜pocketcasts｜別の回の疑い｜リンク先の題名「Error 403 | Pocket Casts」

## 問題の種類別

| 領域｜種類｜判定 | 件数 |
|---|---|
| URL｜配信先の移転｜FAIL | 898 |
| 出演者｜出演者欄に URL｜REVIEW | 120 |
| 概要欄｜概要欄が極端に短い｜REVIEW | 17 |
| 収蔵｜再生時間が0または空｜REVIEW | 13 |
| 概要欄｜概要欄が空｜REVIEW | 9 |
| 概要欄｜告知文・定型文の残留｜REVIEW | 6 |
| URL｜別の回と同じ URL｜FAIL | 3 |
| 出演者｜出演者が空｜REVIEW | 3 |
| URL｜個別回の形ではない｜REVIEW | 2 |
