# Phase15 Lite 最新3件｜試験GAS追加ファイル・承認ゲート

司令塔指令 d3d79a4e86bf40f0db19e18aa575263cbfe41862 を全文確認。

## 追加するファイル（**ユーザーと司令塔の承認までは貼付禁止**）
対象：独立GAS `Phase15_Lite_READ_ONLY_TRIAL` (`1sn7SS8awam-hqcKspk4sEJ8gmc3zqjeo-TH6MeoEeRXsFhrKNwltJvxS`)。
1. `LiteLatestThree.gs`: GitHub上の同名ファイルの全文を新規ファイルとして追加。純粋な最新3件選定・照合関数 `liteLatestThreeScan`。
2. `LiteLatestThreeGas.gs`: GitHub上の同名ファイルの全文を新規ファイルとして追加。**新しい実行入口は `phase15LiteLatestThreeReadOnly`**。

**既存の成功済み `LiteCore.gs` と `LiteGas.gs` は変更・削除・上書きしない。** 旧Github `LiteGas.gs`（SpreadsheetApp版）も絶対に貼り付けない。今回の `LiteLatestThreeGas.gs` はREST GETによる2範囲読みと新規独立 `phase15LiteLatestThreeRss_` による公式RSS取得を内包し、既存実機関数 `phase15LiteFetchRss_` にも旧LAB関数 `phase15LiteFetchWithDeps` にも依存しない。undefined関数参照を回避。

## 依存・権限・試験
- `ScriptApp.getOAuthToken()`, `UrlFetchApp.fetch`, `XmlService.parse`, `console.log`, `liteLatestThreeScan`。
- manifestの `spreadsheets.readonly` と `script.external_request` スコープを確認。権限拡張（spreadsheets全権限）を求められたらSTOP。
- 表示は公式7番組の最新3件まで（最大21件）、登録済EP-ID/GUID/URL照合・判定不能。RSS XMLは処理前に必要数を解析。7番組以外は対象外。
- A/H取得元、A/G/I/J本番台帳のヘッダーを実際の値と照合し不一致ならSTOP。I/Jのヘッダーはオンラインの同一性を独立確認できていない。
- モックで新規2ファイルの結合を実行し、READ_ONLY REST GET2回 + RSS GET1回、選定1件、書込HTTP0を確認した。6番組はfixtureにソースがないためSOURCE_PENDING。これは**隔離JavaScript模擬検証**でありオンラインGAS実行ではない。
- OAuthや実XMLのバリエーション、6分制限、最大21件の実測照合は未検証。実機版既存LiteGas.gs原典との比較も未完。

## 司令塔承認後の手順案（未実行）
専用GASプロジェクトを開き、新規2ファイルを加える → 保存 → 権限/実行入口 `phase15LiteLatestThreeReadOnly` を検査 → **別の実行承認**後に1回だけREAD_ONLY手動実行 → ログで7番組の選定件数と最大21件の状態を確認。タイマー・トリガーは設置しない。既存本番GAS/COPYには絶対に入れない。

## 判定
`TWO_NEW_FILES_PREPARED / RSS_FUNCTION_SELF_CONTAINED / LAB_MOCK_PASS / INSTALL_NO_GO`。
本番EP-06632を保持。COPY同番号を本番へ転用しない。新規採番・台帳更新・GASオンライン変更・トリガー設置0。
