# Phase 12 本番移行・最終受入審査 — 2026-10-22 JST

判定 **HOLD**。参照する正式ゲートはIssue #241 [6331185808](https://github.com/Neyito96/asarisunowa/issues/241#issuecomment-6331185808)。今回のコピー/本番書込、GAS配備、設定/トリガー、メール、Spotify、merge、Pages公開はすべて0。

## G1〜G7

|ゲート|判定|根拠・残件・必要な対応|
|---|---|---|
|G1 差分固定|HOLD|GitHub各base/head SHA・変更ファイル・GAS blob一覧を保存、現在mainへのローカル結合は競合0。ただし現在の実機ソース/manifest未取得。存在確認だけで一致とはしない。実機LibraryV3BaselineTrigger.gsは対象GitHubに同名ファイルなし、内容/同名関数競合を確認必須|
|G2 設定安全|HOLD|ユーザー実機報告のbaseline.complete=true/6591、disabled/allowNew=false、ALIB完了、確認所有者のトリガー0、RSS10本は根拠あり。通知未接続と他所有者/実行中の確認が残る。コピー入口の競合防止を修正・試験し、通知ガードは維持|
|G3 候補保全|PASS（記録時点）|最新取得元/台帳と11:17取得RSSの12候補をGUID/URL/番組/公開日時/除外・再配信・人手削除判定付きで保存。設定上12保留、登録承認を意味しない。実行直前に再取得・差分固定|
|G4 復旧設計|HOLD|停止/部分失敗/ID再利用禁止とコピー復旧設計あり。台帳・コピーbefore/afterのローカルXLSXはあるが、現在GASコード・設定・全所有者トリガーの検証済み永続バックアップ未確認。復旧可能と断定しない|
|G5 コピー実証|HOLD|以前の実コネクターコピー書込1件・再取得リプレイ0件・失敗復旧は証拠として保持。ただし既存V3のローカル実行＋Sheets限定outbox適用で、実GAS実行ではない。今回の新規コピー/書込の承認なし。再利用コピーには既にEP-06592があるため新規append試験に流用しない|
|G6 公開分離|PASS（設計/ローカル検証）|台帳登録とsnapshot PR、merge/Pages、Spotify、通知送信を別承認。詳細/検索/関連記事/HTTP確認を既存ブリッジが要求。実環境の権限/gate・公開受入は未実施|
|G7 最終判定|HOLD|本書と機械可読gates.jsonで未確認を保留。G1/G2/G4/G5未完了のため本番移行不可|

根拠は `docs/audits/2026-10-22-ingest/final-acceptance/`。独立の母集団監査や公開件数を変更しない。

## GitHubの固定点・依存順

|PR|base|確認したhead|
|---|---|---|
|#226（前提）|feature/rss-library-delta-readonly|245f5164ae450adede33cd5096495cc79cc93b86|
|#230|#226ブランチ|580523aa299a897fe9bcaeb91df6b5bf8004ff9e|
|#243|#230ブランチ|68ceb17610ed97857bbe427836dabe930db165b8|
|#247|#243ブランチ|02ad30f5153665b0edd86a169d86c8b7339ae697（今回修正後）|
|#244|main|c2c4a723ea6ad8a53ea8cd6405930cf6cbd8c86d|
|#248|#244ブランチ|9864e915b7a17257b5eb3f2a601a4e31da813e85（本審査追記の親）|

すべて未マージ。#226自体のbaseもmainではないため、#230を単独でmainへ載せたことにしない。最小反映単位は、#226以前の必要部分を確認したうえで#230→#243→#247（GAS）と#244→#248（公開）の2系統。#248 CIは#247をSHA固定し、最新版へ更新する。最終的なmerge/retargetは別途承認。

現在main `43b9023d7a0202a8bede056227e23b41693713e6` に#247、続いて#248をgit merge-treeと参照先を変更しないsynthetic commit objectで結合し、いずれも競合0。枝/main/リモートは変更していない。これはソース全体の本番適合性や今後のmainへの無競合を保証しない。

### 関数単位の必要差分

- #230: 既存libV3Run_/libV3Append_とMorning/copy pilot等。Spotify処理は任意、GASの台帳/RSS helperが前提。
- #243: libV3Conflicts_、Morningの開始/設置/実行でALIB競合停止。
- #247: libV3Context_は管理51列だけで行hashを計算し、追加アーカイブ4列を保持。V3の検証済み補完後の登録証拠更新。previewLibraryV3AutonomyのconfiguredFeeds表示。今回saveLibraryV3CopyPilotAfterApprovalにも競合チェックを追加。
- #244/#248: stable READ_ONLY取得、preparePublication、既存export、verifyPublishedEpisodesと既存workflow。公開側でEP-IDを再採番しない。
- 通知: AutoUpdateNotification.js のnotifyAutoUpdateFailureSafely_→notifyAutoUpdateFailure_→buildAutoUpdateFailureNotificationMail_。MailApp等の実行権限は確認/承認対象。無送信builder試験は実機接続の証拠ではない。

実機clasp取得一式（.gs/.js）とappsscript.jsonを、既存ローカル作業を上書きしない専用ディレクトリで取得して比較する必要がある。`.clasp.json`、認証ファイル、Propertiesの秘密値はGit/チャットへ保存しない。Script ID/編集URLと取得時刻・取得者だけを運用台帳へ記録する。READ_ONLY取得に追加OAuthが必要なら勝手に認証変更しない。

`node scripts/check-library-release.mjs PRIVATE_CLASP_DIR V3_REPO PRIVATE_REPORT.json` はローカルだけで5対象ファイルのSHA/関数名とmanifest、取得ソースの重複関数を確認し、コードを実行しない。対象はCheckpoint/V3/Autonomy/Morning/通知。GitHubにないBaselineTriggerや他の実機固有ファイルはunmappedLiveFilesとして保持・確認し、勝手に削除しない。全プロジェクトを網羅した承認ツールではない。今回のgate-source-missing.jsonは実機未提供を記録するHOLDで、空の実機を観測したという意味ではない。

## 今回の安全修正とテスト

コピー専用writerは従来ALIB/図書館schedulerの存在をチェックしていなかった。ScriptLockだけでは別handlerの予約実行を防げない。既存saveLibraryV3CopyPilotAfterApprovalのlock取得後、ソース/コピー/RSS読取・予約前にlibV3Conflicts_とV3/Baseline/Morning/継続handlerを確認し、いずれかあれば例外停止する。トリガーやPropertiesは変更しない。同一プロジェクトのトリガーしか見えないため別所有者/別プロジェクト/手動実行は運用確認を併用する。

修正前は新規6試験が失敗、修正後は既存V3回帰158/158 PASS。関連（通知無送信、列、設定、収蔵・公開、ソース比較）19/19 PASS。ソース比較4試験はcaptureコードを実行しないこと、差分/欠損/重複でHOLD、target構文不正でFAILを検証した。CIの既存#248 workflowへ追加。過去のコピー試験は変更しない。

## G3の保全

候補表には12件すべてのGUID、番組、元個別URL、音声URL、RSS URL、公開日時、既存EP-ID、現在の判定理由と取得時刻を保存した。根拠は11:17〜11:20 JSTのライブ読取とユーザー実機設定報告。12件は本番未登録で、既存識別/削除/再配信警告/清掃HOLD0、設定保留12。旧URL/未知の同一話は既存ガードで検出できない場合があり、未識別再配信不存在の保証ではない。

未来newAfterによる通常運転と既知12件のバックフィルを分離する。過去日付をPropertiesへ手入力して一括登録しない。最初のコピー試験は既存copy pilotにGUIDを1件だけ指定する。本番には転用しない。

## G4バックアップ・停止・復旧と担当

|対象|現在の証拠|実行前に必要なもの|確認担当|
|---|---|---|---|
|GASソース/manifest|GitHub SHAあり、実機全文なし|実機の永続バックアップ、全ファイルSHAと関数重複、対象プロジェクト一致|根津さん取得、WORK差分審査|
|Properties|ユーザー提供の安全な設定値/baseline|設定の変更前値、cursor/lease/lastIDの安全な項目。秘密値は元の安全な保管先で保持しGitに出さない|根津さん実機確認|
|トリガー/実行履歴|確認所有者の0件・ALIB10/21終了報告|全所有者/別project/進行中手動処理、handler/ID/確認時刻。勝手に停止しない|根津さん管理確認|
|台帳/除外/状態/履歴|11:17 native 6,591行、before/after timestamp一致、SHAあり|直前に再取得、変更0確認、永続バックアップと復元読取。全体上書き不可|WORK読取、根津さん承認|
|コピー|過去の専用コピーとbefore/after|今回は新しいコピーID・sharing/全タブ確認、元本と一致、planHash・範囲固定|WORK準備、根津さん承認|
|公開JSON|既存公開versionの観測記録・Git履歴|公開直前manifest/詳細/検索のSHA、正常版commitとPages実行ID|WORK確認、根津さん公開承認|

最後の台帳観測: 10/22 11:17 JST。実機設定のユーザー確認日: 10/22（正確な診断時刻未提供）。新しい実機全文・永続復旧確認時刻は未記入であり、埋めるまでG4 HOLD。

承認後の運用停止は既存stopLibraryV3MorningAfterApprovalとstopLibraryV3AfterApprovalで双方無効化し、処理中lease/終了を確認する。今回は停止操作すら実施しない。失敗時は追加書込を止め、予約/HOLDを保持してGUIDと行hashを読戻す。IDcounterを巻戻して再利用しない。削除済み履歴を消さない。

コピーの復旧も別途承認された自分の対象セルだけに限定する。値一致が崩れたら復元せずHOLD。過去に成功済みのコピーEP-06592を削除して新試験に使い回さない。公開済みJSONは正常版へのrevert/Pages再配信が独立承認、元本を古いXLSXで一括置換しない。

## 最初の1件の承認依頼（操作を分離）

**現在の申請 C1：専用検証コピーの作成1回だけ。**

- 元本 `1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4` をGoogle Driveのnative copyで全タブ複製。
- コピー名案「朝リスの田｜Phase12 G5 1件受入専用コピー 2026-10-22」。元本と別ID、共有状態を変更しない。作成後はメタデータと対象タブのREAD_ONLY比較だけ。
- セル書込/GAS配備/設定/トリガー/通知/Spotify/merge/Pagesはこの承認に含めない。作成後はそのコピーを保持する。不要時の削除も勝手に行わない。

**C2はまだ申請・実行しない：G1〜G4を満たし、C1の実コピーIDが確定してから最大1件書込を別申請。**

- 第一候補GUID `38da5e5a-96ce-4113-9c7e-b4db000e82d2`、「(大阪目線#6)共産が支援する町長がかじをとる町は 「天王山」の地、二分する選挙」、ニュースの現場から、JST 2026-10-11 04:00。
- 実行対象は承認した実機SHA/プロジェクトの `saveLibraryV3CopyPilotAfterApproval({copySheetId:ACTUAL_COPY_ID,guid:GUID,feedUrl:OFFICIAL_NEWS_RSS,approvedPlanHash:LIVE_PREVIEW_HASH})`。コピー専用関数、原本不可。現在は実機ソース一致未確認で呼ばない。GAS反映が必要なら、そのファイル差分/manifest不変更と復旧を先に別承認。
- 直前の既存previewからcopyID・GUID・タイトル/日付・RSS・全対象値・planHashを提示し、一致した承認だけを使用。過去のコピーのplanHashは使わない。採番は台帳/状態/既存counter最大+1で決定し固定予告しない。
- 現行6,591行/状態6,591行/履歴93行のままなら予定範囲はコピー台帳A6593:AY6593、状態A6593:C6593、履歴A94:J94。実際のreadbackで行数が変われば再計画・再承認。原本counter/Properties書込0、既存ID/GUID/音声不変更。新規話のGUID/音声は原RSSから追加される。
- 最大1件append、全51セル/状態/履歴を読戻し、同一GUID再実行追加0、失敗時停止を確認する。失敗注入/clearによる復旧試験も対象セルと手順を含めて別途明示承認する。1件追加の承認を全コピー一括復元の承認と解釈しない。

C3本番への1件登録、C4定期運転、C5公開JSON更新、C6merge/Pages、C7Spotify、C8メール送信はそれぞれ別承認。今はC1以外に承認を求めず、本番への最初の1件を実行できる状態とも報告しない。
