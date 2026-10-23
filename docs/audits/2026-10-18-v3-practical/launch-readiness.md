> **ZIP受領後の現在の検証・承認対象は[こちら](zip-final-validation.md)。** 古い項目の未取得理由は履歴であり、再取得依頼ではない。

# PR #230 最終仕上げ：実運転は未合格

2026-10-18。PR #230の実装を再利用。今回のGASコード差分はLibraryV3Morning.jsとLibraryV3.jsのみ。33/35ファイルの全面機能監査、母集団比較、古い概要清掃は再実施していない。オンラインコード保存・Properties変更・トリガー操作・シート書込・Spotify投稿・デプロイ・マージはすべて0。

## 合格／未合格

|検証|結果|根拠|
|---|---|---|
|既存V2/V3・V1保護・朝ブリッジ・コピー試験のローカル検証|合格|138/138、既存RSS 23 assertions。zip-pilot-test-results.txt参照|
|現行隔離GASの既存READ_ONLY制御確認|合格|previewLibraryV3Autonomy：実行開始11:12:20、完了11:12:21（画面表示、秒精度）。offset=6591/complete=true、enabled=false、writes=0|
|現行35スクリプト＋manifestの全文差分|合格|添付ZIP36ファイルを全文照合。全hash・対応表・反映候補差分を記録|
|PR #230新コードの実GAS READ_ONLY|未合格|LibraryV3Morning.gsが現行一覧にない。承認なしに反映していない|
|コピー台帳への新着1件保存／再実行0件|未合格|実書込承認前。モックでは合格。試験先と1件のGUIDを確定してから実施|
|承認されたSpotify試験リストへの1件投稿／再実行0件|未合格|試験リストIDは4FiVIwysKDtLqEXfkfhu2Oに確定。対象EP・認証・書込承認は未確定。実APIの権限・playabilityは未検証|
|本番自動運転開始|未合格|上記の実機ゲートが残る。トリガーは設置していない|

[実測JSON](launch-readiness.json) / [テスト結果](launch-test-results.txt) / [運用・復旧](operations.md)。実行詳細画面の読み取りも保護で止まったため、正確な小数秒の実行時間は未確認。RSS/Spotify呼出0は制御プレビューの静的呼出経路による確認であり、ネットワーク計測値ではない。ログのtriggers=0はscheduledLibraryV3の件数であり、プロジェクト全トリガー件数ではない。

## 現行全文の取得・照合完了（ZIP受領後の更新）

ユーザー添付 `asarisu-gas-export-fixed(2).zip` の35スクリプト＋manifest、合計36ファイルを全文照合した。ZIP SHA-256は `521b4082fe46c02daaa0b451e2f9714a0b6727a169aaea2055fc61c467335035`。再エクスポートは不要。

PR #230の72fdaa0との比較は完全一致2・改行/外側空白のみ20・本文差7・隔離側のみ7。前回全文バックアップの35ファイルに対して34は完全一致、LibraryV3の初期登録トリガー除外だけ変更、BaselineTriggerが1ファイル追加。既知の初期登録用変更と一致し、無関係な本文変更は検出していない。

[36ファイルの対応・全文hash](zip-full-source-map.csv) / [依存・差分集計](zip-source-verification.json) / [反映候補2ファイルの差分](proposed-readonly-two-files.diff) / [37ファイルの反映後予定hash](proposed-readonly-file-hashes.csv)。ZIPにはPropertiesが含まれず、6,591件の状態は前回11:12のREAD_ONLY実測を引き継ぐ。今回新たにPropertiesを書き換えたり初期登録を実行したりしていない。

## V1とV3の最短接続と保護

同じGAS内で `RSS → V3の既存Plan/Append → 台帳 → V1のルール・OAuth → 1ページ単位の確認 → 1件POST`。新規HTTP公開口、認証再実装、外部サーバーは不要。

|直接依存|GitHub定義|
|---|---|
|getAutoPlaylistRuleByKey_ / getAutoPlaylistShowIds_ / matchesAutoPlaylistRule_|PlaylistAutoRules.js|
|getSpotifyUserAccessToken|SpotifyAuth.js（既存token cache / refreshを維持）|
|assertAutoPlaylistSheetLinkBeforeWrite_|PlaylistAutoSheetLink.js（既存SPREADSHEET_ID/getSheetLoose等も必要）|
|isAutoUpdatePlaylistHumanDeletedV1_|AutoUpdateAutomationV1.js（既存削除Propertiesを読む）|
|notifyAutoUpdateFailureSafely_|AutoUpdateNotification.js（既存宛先・6時間重複抑止を再利用）|

ルールのspeaker/no-mirai等の間接依存も同じプロジェクトに必要。今回、直接依存確認から漏れていたgetAutoPlaylistShowIds_を追加し、READ_ONLYプレビューに不足名・通知helper有無を返す。関数の存在確認だけで認証・ルール・間接依存の実機合格とはしない。隔離35ファイル一覧にこれらV1主要ファイルはなく、既存全文snapshotにも直接依存はなかった。今回の全文ZIPと重ね合わせVMで、直接依存6関数・通知関数の不在を確認した。

運用先の候補は、既存V1が動くプロジェクトへV3の4モジュール（CheckpointEngine / LibraryV3 / LibraryV3Autonomy / LibraryV3Morning）と既存V1の2箇所のファイル差分（AutoUpdateAutomationV1 / PlaylistAutoWrite）を選択反映する経路。既に一致するモジュールは反映不要。実際の対象ファイル集合は現行本文照合後に固定する。隔離へV1ファイルを無差別にコピーする案は採らない。本番側のLIB_V2_SHEET_ID定義、対象シート、既存Propertiesとのキー衝突、V3状態シートは反映前に検証する。6,591件のbaseline/採番/削除除外・既存OAuthはリセットしない。既存baselineキーの置き換えも包括承認に含めない。

V1の委譲フック4箇所はPR #230既存実装のまま維持。委譲リストは旧V1でskip/書込拒否。停止中も旧V1へ勝手に戻さない。V3はPOST前に全ページの会員確認、snapshot再確認、台帳再照合、削除確認、永続HOLD予約を行い、成否不明なら再送しない。別プロジェクトのwriter/別所有者のトリガーは同じロックでは守れないため、運転所有者と委譲対象を限定する。

## 毎分トリガーを廃止した差分

- 日次6時台に1本。実仕事が残る間だけ5分後の一回限りの再開を最大1本予約。平常時の常時1,440回/日を廃止。
- HTTPの前に再開予約を作成。強制終了後も8分leaseが失効すれば再開。6時台の未完了は09時まで処理し、以降は翌朝へ保持する。
- 一巡完了で再開予約を取り消し、完了済みフィードの30分ごとの再取得を廃止。昨日の未完了を終えた場合、当日分を次tickで開始する。
- 未完了巡回・Spotifyキューの下限日時を固定。日をまたいだことや72時間経過だけで未処理項目を落とさない。
- 朝ワーカーの予約予算20分/日。開始前に6分を予約し、正常終了で実経過へ精算。強制終了時は予約を残す。残予算6分未満なら翌日へ。GAS全体/V1の他消費分は別途あり、総quota保証ではない。
- RSS恒久HTTP停止・制御2回失敗・再開予約異常は朝を停止してV1通知。Spotifyの403や補助障害はSpotifyだけ停止してRSSを継続。429/503は既存Retry-Afterを維持。通知失敗でも停止を解除しない。通知helper不在なら有効化を拒否する。

これらは**コード・モックで合格**。実際の時刻発火・メール送達・実API所要時間は未試験。GAS公式の[quota](https://developers.google.com/apps-script/guides/services/quotas) / [時刻トリガー](https://developers.google.com/apps-script/reference/script/clock-trigger-builder)を確認した。毎回正確に5分後の発火を保証せず、atHour(6)も6:00指定ではない。

## 次の承認を一括で行うための順番

1. 一括ZIPの取得・全文照合は完了。オンライン反映の直前にも36ファイルのhashが今回のZIPと一致することを確認し、想定外差分なら止める。5,439件比較や古い清掃はこのゲートに含めない。
2. **コード反映の承認:** 隔離のLibraryV3.gs更新＋LibraryV3Morning.gs追加。反映前後で全ファイル名/本文ハッシュを比較し、許可した2ファイル以外の変化なら中断。V1依存は無断追加せず、不足表示を確認する。新コードREAD_ONLYはpreviewLibraryV3MissingAudit / previewLibraryV3Morning、既存previewLibraryV3も1フィードだけ。Propertiesやトリガーを触らない。
3. **保存試験の承認:** 元台帳・既存バックアップを保持し、試験専用の新しいコピーを作り、選定済みGUIDの新着1件だけを既存Append経路で保存。試験用GAS/コピー先定数を固定し、元台帳を指すまま実行しない。採番予約・項目状態・履歴等の付随書込もコピーに限定する。試験用Propertiesと元の運用Propertiesを混同しない。再実行0追加、値と数式の前後差分を確認して終了。承認前に汎用朝schedulerを起動して1件試験の代用にしない（最大5候補を処理するため）。
4. **Spotify試験の別承認:** 試験リストURL、既存ルールキー、1件のEP/URIを指定する。台帳保存試験とは別実行。既存V1認証を使える承認済み実行先で、既存ページ検査→予約→1POSTを実行する。付随する試験状態保存と必要なOAuth token更新/cacheの範囲も明記する。本番リスト、他のEP、新着全体への書込は含めない。再実行0投稿を確認し、不確実ならHOLDのまま終了する。
5. **本番起動の承認:** 実機ゲート合格後、照合済み対象ファイル・実行先・新着開始日時・許可ルールを固定。変更するキーをLIB_V3_CONFIG / LIB_V3_MORNING_CONFIGおよび新しい朝state/cursorに限定してレビュー。baseline等の移行が必要なら別途値・不存在確認を示す。configureLibraryV3MorningAfterApprovalで有効化し、installLibraryV3MorningTriggerAfterApprovalで日次＋一時再開の運用を許可する。V1既存トリガー、OAuth設定、main/Webデプロイは変更しない。

2026-10-18 11:26 JST、Spotify試験先だけは「リス田 自動更新テスト」`4FiVIwysKDtLqEXfkfhu2O`に確定（投稿承認ではない）。試験用コピーID・試験対象1件・実行認証の確認は未完了。[限定試験の準備と制約](pilot-test-plan.md)。したがって「次の承認だけで直ちに本番起動できる」という状態にはまだ達していない。コードの追加開発よりも実機反映の承認・READ_ONLY実測と試験対象の確定が残る作業。

## ロールバック

実行中処理がないことを確認してstopLibraryV3MorningAfterApprovalで朝だけ停止。日次予約はdisabledで無処理、一時予約は次回に自分だけ掃除する。全Properties削除・baseline再登録はしない。反映前の全文バックアップから変更した本文だけを戻し、全ファイル名/hashを再照合。台帳/Spotifyの追加分は自動削除せず、コピー上の差分やHOLD予約を根拠に個別対応する。旧V1への委譲解除も再追加を起こし得るため別承認。実機検証に入るまで本番反映・公開・マージは行わない。
