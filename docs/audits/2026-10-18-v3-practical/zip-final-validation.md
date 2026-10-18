# PR #230：添付ZIPによる最終検証

2026-10-18。入力はユーザー添付 `asarisu-gas-export-fixed(2).zip`。比較基準はPR #230の `72fdaa0`。オンラインへの保存、実シート書込、Properties変更、トリガー操作、Spotify投稿、デプロイ、マージは0。ZIPそのものや隔離側だけにある全ソースの再公開はしていない。

## 合格：36ファイルの全文照合

|PRとの関係|ファイル数|
|---|---:|
|バイト完全一致|2|
|CRLF/LFと外側空白だけを除けば一致|20|
|本文差あり|7|
|隔離側だけにある|7|
|合計|36（35スクリプト＋manifest）|

[全36ファイルの対応・SHA-256](zip-full-source-map.csv) / [依存・差分集計](zip-source-verification.json)。ZIP SHA-256: `521b4082fe46c02daaa0b451e2f9714a0b6727a169aaea2055fc61c467335035`。改行を除去して本文相違を隠す比較はせず、元バイトのhashも保存した。

本文差の7件はEP00061_DescriptionFix、Import1007SafeBatch、LibraryGuidReconciliationPreview、LibraryMetadataBackfillV1、LibraryMetadataBackfillV2Writer、LibraryV3、manifest。V1/V2の差は前回の対応表・既知差分を引き継ぎ、今回反映の対象にしない。部分ファイル・別名ファイルを一括で正本へ置き換えない。

隔離だけの7件はAP2_Engine / AP2_Tests / AP3_RealServices / AP4_LibraryAudit / AP4_LibrarySearch / LibraryV2MatchDiagnostic / LibraryV3BaselineTrigger。すべて保持する。

前回の全文バックアップ35ファイルに対して、34は完全一致。LibraryV3は初期登録handler `scheduledLibraryV3BaselineOnly` を衝突対象から外す既知変更だけ。追加のLibraryV3BaselineTriggerはそのhandlerを1回だけ定義し、完了/例外時に自分のトリガーを削除する。トップレベルから自動実行されない。既存17種類の重複関数名は前回と同じ。今回追加するMorningの関数名は現行ZIPとの衝突0。

## 未合格：実機反映とREAD_ONLY

最小の反映候補は次の2ファイル。反映後は36スクリプト＋manifest＝37ファイルとなり、**現在の他35ファイル（34スクリプト＋manifest）はバイト単位で不変**にする。

|オンライン名|操作|内容|
|---|---|---|
|LibraryV3.gs|更新|PR #230の新着・欠損監査と、コピー試験時だけの接続先引継ぎ。通常の採番・既存入口は維持|
|LibraryV3Morning.gs|追加|PR #230の朝ブリッジ、READ_ONLY診断、コピー1件試験。トップレベル実行なし|

[反映候補の全文差分](proposed-readonly-two-files.diff) / [全37ファイルの前後予定hash](proposed-readonly-file-hashes.csv)。新ファイル内のAfterApproval関数は追加されても呼ばない限り動かない。manifest・BaselineTrigger・CheckpointEngine・Autonomyは今回変更不要。

承認後の実機試験は `previewLibraryV3Morning()` → `previewLibraryV3MissingAudit()` → `previewLibraryV3()` を各1回まで。前2つはRSS/Spotifyを呼ばず、最後だけ公式RSSを1フィード読み取る。いずれも台帳・Properties・トリガーは変更しない。コピー保存・Spotify投稿・configure/install/scheduled/登録関数は呼ばない。

直前に全36ファイルのhashを今回ZIPと照合し、想定外差分なら保存前に中断。保存後は全37ファイルを再取得し、変更2件と他35件の不変を確認してからプレビューを実行する。全文読取接続が依然使えなければ、再エクスポートによる照合か本人による反映・ログ取得が必要になる。ブラウザー保護を回避して未確認のまま保存しない。

ロールバックは今回ZIPのLibraryV3本文へ戻し、新規Morningファイルだけを除去する。どちらも承認されたコード操作の範囲で実施し、再度全ファイルをhash照合。Propertiesやbaselineを復元/削除しない。

## 6,591件の初期登録の保護

ZIPにScript Propertiesは含まれない。offset=6591 / complete=trueは前回11:12の実機READ_ONLY結果であり、今回の再実測値として扱わない。今回の作業は実機Propertiesに接触しておらず、baseline関数も実行していない。

実機READ_ONLYの最初にbaselineとenabled=falseを再確認する。baseline/identity/採番をリセットせず、初期登録をやり直さない。新しいコピー試験はbaselineを読み取るだけで、初期登録完了と元台帳の行数が一致しなければ停止する。

## 接続の依存：隔離には7関数がない

全ソースの定義確認とローカル実行で、次の6直接依存と通知関数の不在が確定した。

- PlaylistAutoRules: getAutoPlaylistRuleByKey_ / getAutoPlaylistShowIds_ / matchesAutoPlaylistRule_
- SpotifyAuth: getSpotifyUserAccessToken
- PlaylistAutoSheetLink: assertAutoPlaylistSheetLinkBeforeWrite_
- AutoUpdateAutomationV1: isAutoUpdatePlaylistHumanDeletedV1_
- AutoUpdateNotification: notifyAutoUpdateFailureSafely_

このため、上記2ファイルだけで隔離のSpotify実投稿まで合格するとはしない。MorningのREAD_ONLYは不足名を返し、自動運転の有効化は依存不足で拒否する。V1認証・ルールを丸ごと無断コピーせず、認証値を取得/表示しない。実際の認証ユーザー・権限・試験リストの可視性は未検証。

## コピー台帳1件保存：コード準備済み、実保存は未実施

既存Context/新規判定/Append/予約/数式対策/状態保存を再利用し、通常経路に小さな任意引数を追加した。コピー試験だけは内部の再読取も指定コピーへ向け、採番はコピーの台帳＋永続予約にある最大IDから行う。元PropertiesのLIB_V3_LAST_IDは読むが更新しない。通常運転のカウンター処理は変更しない。

1. 本番台帳・既存バックアップとは別の新しいコピーを指定する。コピー作成も今回はしていない。
2. `previewLibraryV3CopyPilot({copySheetId, guid, feedUrl})` を実行。元台帳・コピー・公式RSSで候補の一意性、除外、baseline、見出し・状態・未変更のコピーを確認し、承認用planHashを返す。1フィードだけ取得し、書込/Properties/cache/Spotify呼出は0。入力を省略すれば開始できない。
3. コピーID・GUID・タイトル・配信日時・planHashを提示し、保存の承認を得る。
4. `saveLibraryV3CopyPilotAfterApproval({copySheetId, guid, feedUrl, approvedPlanHash})` を1回だけ実行。再取得した計画が違う場合は書込前に中断。コピーのidentity予約→新規1行51セル→検証済みidentity→実行履歴の順に保存する。
5. 再実行は確認済みの同一1件と履歴が揃う場合だけ0行。途中失敗、手動変更、履歴欠落、予約のままの行は保留し、暗黙に修復・再追加しない。元台帳・既存Propertiesの差分0を確認する。

一般の `libV3Run_` / 朝scheduler / `libV3MorningSpotify_` を1件試験の代用にしない。試験用Context以外にcopyPilotを渡しても拒否する。コピーの古い行や数式を変更せず、コピーの側車と新規行・履歴だけが変更対象となる。

## Spotifyは指定リストだけ、まだ承認要求しない

指定先は「リス田 自動更新テスト」`4FiVIwysKDtLqEXfkfhu2O` のみ。コピー試験の新しい入口はSpotifyを一切呼ばない。一般の朝runnerへ試験リストを登録したり、既存ルールを変更したりはしていない。

投稿前に、対象EP/URI・GUID・Show ID・タイトル・配信日、使用する既存V1認証の実行先と確認できたユーザー、必要ならaccess token更新/cacheの範囲、試験リストへの1URI/最大1POST、コピー内の状態記録をまとめて提示し、別途承認を得る。他リスト、元台帳、Properties、トリガーへの変更を含めない。現時点では対象EP・コピーID・認証の実機確認が未完了なので、投稿の包括承認は求めない。

## ローカル試験

**138/138 PASS**。コピー専用13試験を追加し、元Properties setter/delete・cache更新・トリガー操作を例外にしたモックで1件保存と0件再実行を確認。元台帳/既存Properties不変、コピーへの内部再読取、コピーの予約後失敗、計画変更、除外・重複・RSS障害、通知/朝制御の既存試験を含む。既存RSS **23 assertions PASS**。[試験ログ](zip-pilot-test-results.txt)。

ZIPの全35スクリプトにV3更新＋Morning追加を重ね、計36スクリプトを同じVMへロードするローカル検証も成功。初期化/プレビューで書込試行0、不足依存6・通知なしを確認した。[ローカル重ね合わせ結果](zip-overlay-readonly.json)。これは模擬baselineを使ったローカル試験で、実GASの実測ではない。

**次の承認対象は隔離GASの2ファイル反映と上記READ_ONLY 3関数だけ。** コピーの実保存・Spotify投稿・Properties変更・トリガー・公開本番は含めない。
