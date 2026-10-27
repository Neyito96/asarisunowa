# Phase 15｜V18 06:15停止後のREAD_ONLY全件監査（2026-10-27 JST）

司令塔正式指令 `dc6bf6ee39872735d6864790fb2a185b885a3983`。本番/COPY/GAS/トリガー/Properties/公開への書込0。GitHub監査文書のみ新規追加。

## COPY完全照合
- COPY spreadsheet `1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY`。
- `エピソード台帳` 6636件、`図書館V3・項目状態` 6636件、`固定ID採番履歴` 72件をチャンクでLIVE READ_ONLY取得。
- 全72採番履歴は「登録完了」。RESERVED=0。
- 全6636 IDに1対1のledger / V3行が存在。両側のEP-ID重複0、相互欠落0、V3 JSON parse errors=0、V3 identity GUIDとledger G列の非空値同士の不一致0。
- V3 identity hashフィールドが空: **EP-06594 1件**。この存在と06:15タイムアウトとの因果関係は不明。全現行行のnative rowHash再計算は未実施。履歴が72件しかないことは通常の旧台帳行を異常判定する理由にならない。
- 新着5件 EP-06632〜06636 は ledger/V3/historyのID、GUID、登録完了状態、V3 proof値存在が一致。履歴作成時刻は2026-10-26T20:12:21〜20:12:52Zで午前5時の正常実行に属する。hashVerified=trueは05:11の既存実行ログに基づく。独立した現行55列native E.rowHash実算とは区別。
- 06:15の新規完成EPとRESERVED残存は現行表で未検出。ただしタイムアウト当時のbefore/after snapshot、行個別更新時刻やScriptPropertiesがないため既存列の部分書込、予約の一時存在、その後の修復を排除できない。分類: `partial_writes_confirmed=false` ではなく `partial_writes=UNKNOWN; incomplete_new_registration_not_found_in_scanned_fields`。

## 実コード由来の処理順
V19→V18のみ。V18は同一プロジェクトのScriptLockで排他するが他GAS writerを排他しない。8フィードのRSS全取得および各シート全件readの**後**に追加180秒タイマーを起動。max10新着。持続カーソルは提示V18本文に存在しない。RESERVED→台帳55列→V3 JSON hash証明→履歴登録完了の順。途中失敗は部分状態を残し得る。全公式RSSとオンライン E.rss のtimeout/retryは未取得。

## 停止位置ごとの安全な復旧提案（実施禁止）
| 停止位置 | READ_ONLY識別 | 修復案（別承認必須） |
|---|---|---|
| RESERVEDのみ | historyあり/ledgerなし/V3なし | 予約GUIDと公式RSSの同一性を確認。自動新採番を禁止し、同じ予約に対する補償手順を審査 |
| 台帳まで | history RESERVED / ledgerあり / V3なし | 台帳行の全55列・GUID・音声URL照合。行上書きせずV3作成だけを別審査 |
| V3まで | history RESERVED / ledgerあり / V3あり | native rowHash一致を再計算して確認後に履歴状態だけを修復（別承認） |
| 履歴完了 | 3者あり / ハッシュ一致 | 追加不要。再処理ではGUID/URLでskip |

## ランタイム再設計（LAB案）
エントリ開始時に全体期限を設け、RSS fetch前後、各feed、全件read開始、各予約直前にremaining budgetを確認。feedごとに処理数上限、確実な遅延停止と永続カーソル/checkpoint、RSS失敗と0件を区別、ログにphaseごとのduration/cursor/添加数を記録。Reservationの再読から始めるrepair state machineを明示し、単一writer、GUID+URL冪等性、他writerの停止の確認、予約採番の権威を本番に一本化。AppScriptの最大実行時間前に安全マージンを置く。コード改変・実行・trigger変更は未承認。

## 継続ゲート
COPY EP-06632はMEDIA TALK、本番EP-06632はこどもそうだんしつで衝突。COPYの番号を本番に採用しない。7番組公式RSS＋SDGsの10/27差集合はSOURCE_PENDING。本番新着writer実行経路と他プロジェクトは未確認。新着本番追加、GAS復旧、公開更新は別々の承認ゲート。既存W/COPY ACL、Spotify12セル、150件意味品質も別トラック。
