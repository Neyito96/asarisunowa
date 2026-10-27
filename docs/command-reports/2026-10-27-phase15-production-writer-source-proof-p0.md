# Phase15 本番writer実コード証明 P0 — 2026-10-27 JST

正式指令 commit 9890a0c34087123ade2d7bad12b46932534fb1ee 全文確認。調査対象はオンラインApps Script「朝ポキ｜本番ロボGAS」。

## 実証票
|項目|状態|証拠・不足|
|---|---|---|
| 対象GAS|KNOWN_BY_PRIOR_USER_SCREEN|「朝ポキ｜本番ロボGAS」。現在のオンラインエディタソースを直接取得する手段なし |
| writer entrypoint|WRITER_NOT_FOUND|GitHubコード検索 `phase14Production` は0件。オンラインコードとは別|
| call chain|PENDING|オンラインのentrypoint→登録処理の全文が必要|
| production openById|PENDING|既知の本番Sheet ID `1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4` を呼び出す実関数未確認|
| ledger row append|PENDING|`appendRow` / `setValues` の本番関数内コード未確認|
| allocation/history|PENDING|`固定ID採番履歴` RESERVED→登録完了の実装未確認|
| V3 proof|PENDING|`図書館V3・項目状態`へのハッシュ書込経路未確認|
| other writers|NOT_EXCLUDED|別スクリプト間でLockService.getScriptLock非共有。他writer一覧未取得|
| triggers|PRIOR_SCREEN_ONLY|本番画面0件、COPY2件という既存観測。全所有者/全プロジェクトの不在証明ではない|

GitHub default branchで `phase14Production` と `固定ID採番履歴` を検索し、writerソースの一致なし（0件）。GitHub上の不存在はオンラインGAS不存在の証拠ではない。正式writerの原典コード一式が欠けるため、**WRITER_NOT_FOUND / 本番NO-GO**。

## 最小の次のREAD_ONLY操作
Macで Apps Script「朝ポキ｜本番ロボGAS」を開く → エディタ左の虫眼鏡（プロジェクト検索）で `appendRow(` を1回検索。検索結果の**ファイル名・関数名・該当コード前後**が映るスクリーンショットを1枚共有。検索0件の場合は「0件」の画面を共有。コード実行・保存不要。次工程では得られた関数に対してだけ `openById` と採番履歴/V3への呼出を追跡し、余計な一般RUNBOOKは作らない。

## 安全境界
本番EP-06632（こどもそうだんしつ）を維持。COPY EP-06632（MEDIA TALK）とはGUID衝突し、COPYの5IDを本番転用しない。新正式EP-ID=null。既知のCOPY5候補と公式RSS全日未収蔵総数UNKNOWNを区別、SOURCE_PENDING。GAS/Sheets/triggers/Properties/main/Pagesへの書込・実行0件。GitHub監査ブランチのみ。
