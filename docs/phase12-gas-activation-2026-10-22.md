# Phase 12 — 実機報告と既存V3/Morningの安全な有効化手順

2026-10-22 JST。READ_ONLY・承認用手順。ここにある設定操作は実行していない。

## 根拠と判定

|項目|観測・出典|コードとの照合|
|---|---|---|
|実プロジェクト|ユーザー実機確認「朝リスの田_Phase2_隔離検証」|編集URL/Script ID・配備ソースのコミット対応は未確認。ファイル存在だけでPR適用済みとはしない|
|V3関連4ファイル|LibraryV3/Autonomy/BaselineTrigger/Morning.gsが存在|既存エンジンを使用。新設しない|
|トリガー|ユーザーの確認アカウントではインストール型0件|他所有者のトリガーや実行中手動処理まで0とは断定できない|
|ALIB|2026-10-21 04:38 writes:0, remaining:0, stopped:true、自己トリガー1件削除（実機報告）|当該転記の終了証拠。別実行/別所有者の競合は実行直前に再確認|
|baseline|offset:6591（実機報告）|complete:true、状態行、現在の台帳整合性は別途READ_ONLY確認が必要|
|V3設定|enabled:false / autonomous:true / allowEnrich:false / allowNew:false / spotifyApi:false|libV3Run_(true)はDISABLED。libV3NewDecision_でもallowNew不足、newAfter欠如で新規登録不可|

PR #243/#247はV3系、#244/#248は公開ブリッジ系。今回確認時はいずれも未マージ。#247 f0e0273は実台帳55列のうち管理51列で登録証拠を計算し追加4列を保持。#248 e2a64fdは実コピー試験・再実行0件・ローカル公開JSONの証拠を保存済み。配備ソースと比較せずファイル名だけで最新と扱わない。

## 候補11件と12件

以前の11件は10/22 08:07 JSTの既存監査では全件残り、1件増えて12件。09:13 JST取得のニュース公式RSSは2,653項目。既存元本6,591行と除外履歴で再評価した12件は、識別照合と概要清掃のコピー試験条件を満たした。全GUID・タイトル・日時・理由は `audits/2026-10-22-ingest/copy-pilot/decisions.json`、現在の設定を加味した保留表は `activation-candidates.csv`。実機設定報告後にRSS/台帳を再取得したとは主張しない。実行直前の差分再確認が必須。

本番では12件とも「未承認・設定で停止」。12件と、コピーで試した1件を引いた残り11件を混同しない。コピーのEP-06592は本番予約ではない。本番はその時点の台帳・状態・LIB_V3_LAST_IDの最大値+1で採番し、既存IDを固定予告しない。

Morning有効化関数・Autonomy新規有効化関数は現在/未来のcutoverを要求する。既知候補はその時点より過去なので、新着有効化だけで一括登録されない。newAfterを手で過去へ下げて回避しない。既知候補の本番登録は別の明示的allowlist・ライブ差分・承認が必要。既存のcopy pilot関数はコピー専用で本番用に転用しない。現時点で既知12件の本番一括適用は実装/承認済みではない。

## 有効化前のREAD_ONLYチェック

1. 実機のソースを取得して#230→#243→#247、公開側#244→#248と比較する。取得/反映予定ファイル・差分・バックアップハッシュを固定。コード配備も承認対象。
2. 実機で既存 `previewLibraryV3Autonomy()`、`previewLibraryV3Morning()` を実行。設定、complete/offset、競合、lease、未処理予約、通知依存の有無を確認する。これらのpreviewは書込なし。秘密のOAuth/トークンは収集しない。
3. 台帳・除外履歴・項目状態の同時スナップショットをREAD_ONLY取得。ID重複、GUID/UUID/音声の衝突、HOLD予約、baseline証拠を照合。offsetだけで基準状態を再作成しない。人手編集との不一致は保留。
4. 全所有者を含む実行中処理とトリガーを管理者が確認。ALIB/V2/V3/Morningの並行writer、手動バッチ、外部更新を照合。他チャットの監査書込とは競合させない。ScriptLockは別GASプロジェクトの排他にはならない。
5. 公式RSSを再取得し、既存の照合器で既知GUIDの消失/変更、削除履歴、再配信（同一音声、タイトル+日付）、清掃HOLDを再評価。タイトルだけで登録しない。

## 承認後だけ実行する段階

A. **配備のみ**：バックアップした実ソース/設定へ戻せる状態で、既存PRのレビュー済み差分だけを同じプロジェクトへ反映。enabled:false、トリガー0を維持しREAD_ONLY previewを再確認。GASのファイル名は.gs、リポジトリの.jsとの内容対応を確認。

B. **新着収蔵のみ**：Morningを1系統選ぶ。AutonomyのscheduledLibraryV3は同時に設置しない。事前承認された未来の切替ISOを用い、既存 `configureLibraryV3MorningAfterApproval({enabled:true,spotify:false,ruleKeys:[],since:APPROVED_FUTURE_ISO})` を使用する。期待するV3設定はenabled:true/autonomous:false/allowEnrich:false/allowNew:true/newAfter:切替時刻。spotifyApi:falseは維持。Morning設定もenabled:true/spotify:false/ruleKeys:[]。これは既知候補の遡及登録を含まない。

この関数はSpotify無効でも `notifyAutoUpdateFailureSafely_` の存在を要求する。失敗通知が実際にメール送信し得るため、その呼出し範囲の確認・通知の承認も有効化条件。依存不足をダミー関数で回避しない。現在の通知依存は未確認。

C. **タイマー1系統**：承認後、既存 `installLibraryV3MorningTriggerAfterApproval()` で日次06時台JSTを1件だけ設置。必要時に5分後の継続を最大1件作り、09時以降/完了時に終了する設計も承認範囲に含める。09時以降の手動実行ではOUTSIDE_MORNING_WINDOWとなるため、安全ガードを外さず次の窓で確認。小バッチ最大5話、処理時間/1日20分予算・lease・チェックポイントを既存コードで使用。再試行は既存HTTP分類に従い、停止条件は手動で無効化しない。

D. **登録の実証**：新着の原RSS、GUID、採番、予約→台帳51セル→読戻し→VERIFIED/RSS_registered→履歴を確認。再実行で追加0。原文を保持し、公開整形は既存ブリッジで行う。不明な予約/不一致は停止して人手確認。既知候補を登録したい場合は先に個別適用計画が別途必要。

E. **公開準備**：#244/#248の既存workflowを再利用。Google側はREAD_ONLYのWIF/サービスアカウント接続を確認（新たな認証設定も承認対象）。`LIBRARY_PUBLICATION_ENABLED` は承認後にだけtrue、`LIBRARY_AUTO_PUBLISH_APPROVED` はfalseのまま開始。環境library-publication-approvedで二重読取の一致、登録証拠、清掃/関連記事、既存export、テスト、buildを確認する。公開用の承認待ちスナップショットPRを1件のみ作る。失敗時は既存公開データを保持。

F. **Pages**：最初は当該スナップショットのmerge/Pages実行を別途承認してから実施。既存workflowは「Sync listener playlists」成功後またはworkflow_dispatch起動で、GAS完了イベントに直接結線されてはいない。公開待ち時間を保証しない。Pages成功後はmanifestだけでなく、新IDの詳細・概要・関連記事・リンク・検索を `verify-library-publication.mjs` でHTTP読戻しする。自動merge/公開の恒常許可は別承認。Spotify処理はこの段階でも無効。

## 停止・復旧

- 承認された運用停止は既存 `stopLibraryV3MorningAfterApproval()` と `stopLibraryV3AfterApproval()` の両方で無効化。片方だけで全writer停止とは扱わない。無効化はトリガー削除ではない。処理中leaseがある場合は終了/失敗を確認し、競合する復元をしない。自分の継続タイマーは既存dispatcherの停止経路で処理し、所有不明トリガーを削除しない。
- 復元前に原設定・ソースとの差分を提示。台帳全体をバックアップで上書きしない。失敗予約/部分登録はEP-ID/GUID・全対象値を読戻して隔離し、人手で解決する。予約済みID・counterを巻き戻して再利用しない。予約が残れば既存registry判定で重複登録を止める。
- 公開停止はworkflow gateを無効化し、未マージPRを保持。公開済みの問題は直前の正常JSONへのrevertとPages再配信を別途承認。最新の正常データを維持し、台帳の監査履歴は消さない。
- コピー実証はA6593:AY6593、状態A6593:C6593、履歴A94:J94だけが対象。照合一致を確認した自分の書込だけをクリアできる。コピーで確認した復旧手順を、本番で一括削除してよいという承認にはしない。

## 検証と残件

既存V3を使用するREAD_ONLY設定回帰3/3 PASS：disabledの無変更、offsetだけでは不十分、未来cutoverによる既知候補除外。前回の回帰152/152、実コピー1件・再実行0件・失敗復旧、ローカルJSON詳細/検索の証拠は既存ログを再利用。実GASやPagesを実行した試験ではない。

次の承認前に必要：実機previewの2出力（秘密値不要）、baseline.complete、実ソース差分、全所有者の競合確認、通知依存、GitHub公開環境/WIF/gateの実設定。上記A〜Fを一括実行せず、具体的差分・復旧対象が確定した段階ごとに承認を得る。今回の本番書込/設定/トリガー/配備/merge/公開/メール/Spotifyは0。


## 追加実機診断（10/22、上記の未確認事項を更新）

ユーザーのREAD_ONLY実機報告でbaseline.complete=true、offset6591、conflictingTriggers=[]、writes0を確認。Morning config/state={}、Spotify依存6件なし、notificationAvailable=false、確認所有者のtriggers=[]。本節が上記のbaseline.complete未確認記述を更新する。配備ソース全体のコミット対応と他所有者は引き続き未確認。

### feeds=[]の原因

既存 previewLibraryV3Autonomy のfeedsはLIB_V3_CURSOR.feedsから作る**巡回履歴**。設定済みRSS一覧ではない。未巡回/未初期化なら空で正常。既存 libV3Context_ は取得元一覧H列のHTTPS URLとA列番組名から別にRSSを読む。保存済み09時台のネイティブ台帳スナップショットでは10本（アルキキ/AJW/旧SDGsの原本管理用も含む）が存在。実機現在の10本を直接読んだとは主張しない。

診断の誤解を防ぐ最小修正を既存#247に保存：従来feedsは互換維持し、configuredFeeds/configuredFeedCount/feedHistoryMeaningを追加。設定・台帳・巡回・通信を変更しない。#248のテストがこの#247を固定参照する。配備前はローカルのみ。実機診断をやり直す前に承認なしで新コードを貼らない。既存ソースの取得元一覧タブA/H列をREAD_ONLYで確認してもよい。

### RSSだけの最小構成と不足関数

6関数はSpotify経路専用。spotify:false、ruleKeys:[]ではconfigureのSpotify依存判定とMorning Spotify処理には入らない。既存コア runLibraryV3AfterApproval → libV3Run_(true) → libV3Append_ はこの6関数と通知関数を呼ばず、RSS→GUID→採番→51セル読戻しを実施できることをインメモリー試験で確認。これは**承認後の単発writer候補**であり、今は実行しない。

一方、Morning configureはenabled:trueで通知関数を必須にしており、実機のnotificationAvailable=falseではSpotifyなしでも設定前に停止する。ダミー通知や無検証のガード撤去はしない。Morning自動化は、既存 AutoUpdateNotification.js の依存・送信先・6時間抑止・MailApp権限をREAD_ONLYで照合し、コード反映と失敗メール送信を別途承認してから進める。未導入のV1エンジンやSpotify認証を丸ごと入れる必要はない。

### 12候補の再判定と試験

保存済みの公式RSS（09:13 JST）・元本6,591行・除外履歴で既存V3照合を再実行。12件はGUID既存対応0、RSSメタデータ差分0、既存の重複/再配信ガードによる理由0、清掃HOLD0。既存の判定範囲を超えた同一話の断定はしない。本番設定を適用すると全12件がallowNew:false/newAfter空のため保留、baseline不足の理由は今回解消。候補別CSVを更新。コピーだけに登録した1件はコピーでALREADY_PRESENT、追加0。今回新たなSheets書込は0。

この再判定は保存済み実データを使用したローカルREAD_ONLY試験。実機診断報告後の最新RSS/本番台帳の再取得は未実施であり、本番適用直前の再取得・差分確認が残る。既知候補の遡及登録と未来cutoverは別承認のまま。

今回の試験：V3回帰152/152、公開・収蔵・設定統合13/13 PASS（設定回帰6件を含む）。追加テストは空履歴と設定RSSを区別、6関数なしのコア新規登録と再実行0件、Morning通知依存不足時の無変更停止。fixtureの設定変更はインメモリーのみで本番操作なし。

### 承認前の次の一手

1. 現在の取得元一覧と実ソースの内容対応をREAD_ONLY確認し、既存#247/#248の反映予定差分・バックアップを確定。
2. RSS単発実行とMorningタイマーを別段階にする。単発もenabled/allowNew/newAfter変更を伴うため未承認で実行しない。既知12件を過去cutoverの抜け道で流さない。
3. Morningは既存通知helperの最小依存・メール動作を確認した後に配備/通知/設定/タイマーを承認申請。Spotify6関数の追加をRSS収蔵の前提にしない。
4. 公開は既存#244/#248のreview用snapshot PRまでと、merge/Pagesを分ける。本番gate/認証/公開の変更は承認後のみ。
