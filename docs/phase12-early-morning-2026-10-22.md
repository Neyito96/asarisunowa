# Phase12 RSS専用早期稼働 — 2026-10-22 JST

司令塔優先変更 [comment6331380893](https://github.com/Neyito96/asarisunowa/issues/241#issuecomment-6331380893) を適用。既存V3/Morningを使用し、新エンジン/新PRなし。**本番はまだ停止状態。** 既知12候補のバックフィル、Spotify、メール、公開を新着収蔵の必須条件にしない。

## 実装した最小変更（既存#247）

- configureLibraryV3MorningAfterApprovalへ明示的rssOnly:trueを追加。Spotifytrue/プレイリスト指定は拒否。このモードだけ通知関数を必須とせず、libV3MorningAlert_が状態とLoggerへ失敗を記録する。実メール関数が同じプロジェクトに存在しても呼ばない。旧モードの通知条件は維持。
- RSS専用は05:00〜05:59 JSTに実行。既存installerはatHour(5).nearMinute(15)で日次1件を提案。nearMinuteは公式仕様で±15分の近似なので正確な05:15開始や06:00までの完了保証ではない。公式根拠: https://developers.google.com/apps-script/reference/script/clock-trigger-builder 。遅延/障害時はチェックポイントを保持する。
- 未完了だけ既存continueLibraryV3Morningで1分後に継続、継続は最大1件、完了/時間外/無効化で終了。日次の全巡回トリガーとは別の同じ処理の続き。旧モードの5分継続は変更しない。
- RSS専用新着巡回は現行10RSSからアルキキ/AJW/旧SDGsアーカイブを除いた7本。元の取得元/台帳/公開分類を書き換えない。libV3MorningFeeds_を既存Morningと既存V3の双方で使い、cursorが対象外へ流れないようにする。
- 既存小バッチ5話、110秒処理deadline、ScriptLock/lease、日次20分予算、HTTP再試行/停止、予約→append→51セル読戻し→VERIFIED、2失敗停止を維持する。別プロジェクト/所有者の排他は実機確認が必要。
- 既知12件は変更前の候補表で保全。未来cutoverより前なので通常収蔵対象外。過去へnewAfterを下げず別承認で1件ずつ検証する。

対象コードは既存LibraryV3Morning.js/LibraryV3.js。#247の既存変更も含むため実機との一致確認なしに貼らない。関連新モード試験53件、影響範囲を含むV3回帰163/163 PASS。新モードで実際の既存V3 append/readback/同GUID再実行0をインメモリー試験。実GASの実行成功とは区別する。

17時台の追加巡回は**設計のみ**。05/17の最大2巡回、同じhandler/排他/cursorを使う案。s.dayだけで完了判定すると同日17時がNOOPになるため、承認前にslot識別と共有日次予算を含めた試験が必要。単に2本目のタイマーを作らない。まず朝1回の実測で必要性を判断する。

## C1完了・C2は未実行

承認済みC1で作成したコピー:
https://docs.google.com/spreadsheets/d/190KQDxD7LCl-apSVU59etgMvSEzMCjf2-3fuV0m38L0/edit?usp=drivesdk

元本とは別ID、31タブの順序と全使用値のhashが一致。元本modifiedTimeは前後とも2026-10-22T01:48:15.286Z。コピーXLSXのSHA/全タブ照合はearly-morning/c1-copy-proof.json。セル追記/編集0、GAS/設定/トリガー0。過去の1件入りコピーは変更しない。

## 本番稼働の個別承認セット（まだ実行しない）

### A コード反映

対象は既存実機「朝リスの田_Phase2_隔離検証」。編集URL/Script IDと現ソース/manifestをREAD_ONLYで取得し、#247 head6a54f2459ee90e93c8f1d82a7f4ee238c4526fb2との差分とバックアップを固定する。中心はLibraryV3.gs/Morning.gs、必要な前提Checkpoint/Autonomy差分は既存#230/#243/#247からのみ採用し、実機固有BaselineTriggerの重複を確認。manifest/OAuth変更、baseline再作成、setup、設定変更は含めない。復旧は保存した同じファイルの元ソースへ戻す。現在ソース未提供のため盲目的な全ファイル反映は申請しない。

### B 朝の新着設定

コード一致・全writer停止確認後、既存関数を以下の引数で1回実行する承認:

```js
configureLibraryV3MorningAfterApproval({
  enabled:true, rssOnly:true, spotify:false, ruleKeys:[],
  since:'2026-10-23T00:00:00+09:00'
})
```

この日時が承認時点で過去なら実行せず、次の未到来00:00 JSTで再提示。既知12件を取り込まない。変更はLIB_V3_CONFIGのenabled:true/autonomous:false/allowEnrich:false/allowNew:true/newAfterとLIB_V3_MORNING_CONFIG（enabled/rssOnly/spotifyfalse/rules空/since）。既存spotifyApi:falseを維持し、秘密値は触らない。復旧はstopLibraryV3MorningAfterApprovalとstopLibraryV3AfterApprovalで無効化し、保存した設定との差分を確認して承認対象値だけ復元する。IDcounter/台帳は巻戻さない。

### C 日次トリガー

Bとは別承認でinstallLibraryV3MorningTriggerAfterApprovalを1回。現在0件を再確認、scheduledLibraryV3Morning日次1件（05:15頃、JST）と処理中だけcontinueLibraryV3Morning最大1件の1分継続を許可する。ALIB/別V3/重複handlerがあれば停止。他所有者のトリガーを削除しない。既存同名timerがある場合は時間設定を確認し、ALREADY_INSTALLEDだけで新時刻への移行成功としない。復旧はBの両停止関数と、今回作成したIDのタイマーだけを個別承認範囲で削除し0件へ戻す。最初の05時台実行でRSS取得/GUID/新ID/台帳/読戻し/次回0件の証拠を確認する。

### D コピー1件試験

C1のコピーIDは確定。候補GUID38da5e5a-96ce-4113-9c7e-b4db000e82d2の最大1件、予定範囲は台帳A6593:AY6593、状態A6593:C6593、履歴A94:J94。実機ソース/直前RSS/台帳/状態と既存previewのplanHashを固定してからsaveLibraryV3CopyPilotAfterApprovalの引数を別提示する。未確認のライブplanHashをローカル値で代用しない。C1承認はこの書込を含まない。今回追加書込0。

A〜Dは包括承認ではなく操作別に判断する。merge/main/JSON/Pages/メール/Spotifyはこの早期稼働セットに含めない。実機READ_ONLYソース取得が不足する主なコード反映前確認であり、同じRSS監査の反復で先送りしない。

## P1 条件差の絞り込み（既存#250資産再利用）

現行speakers3.jsを再取得し、6カテゴリのみ（ニュースの学校なし）、SDGsはブラウザー現地時刻の2026-06-30以降を除外、指定再配信等はactualDuration=0で件数/時間を加算しないことを確認。比較はJSTとして扱う。公開フィルタは変更しない。

|段階|元本|作業台コピー1022|
|---|---:|---:|
|元の保存行|6,591|7,687（YouTube含む）|
|アルキキ/AJW/YouTube除外|−140|−1,195|
|speakers2にない学校|−486|−492|
|旧SDGsと後継の時点調整|−31|−35|
|現行speakers2の再配信等ゼロ加算条件|−225|−225|
|同一元URLの余剰行（暫定、確定統合ではない）|−290|−290|
|仮の元URL群＋URL未確定の単独行|**5,419**|**5,450**|
|申告5,452との差|−33|−2|

5419は確定ユニーク数ではなく、3件の元URL欠損も独立扱いした仮群。時間は元本51件欠損、同URL内の時間不一致37群、コピー側125群。コピー側の各群時間の最小/最大を足すと15,005,754〜15,022,017秒で、申告173日19時間8分=15,016,080秒はこの範囲内にある。どれを正しい時間として採るかは未確定。元本の既知時間だけは14,827,549〜14,831,963秒だが51群の不明時間があるため総時間として比較しない。

EP-ID別の表示/比較条件表、元URLだけでは確定できない差分候補、根拠JSONをspeakers2-scopeへ保存。元URL一致だけで自動採用/削除せず、別チャットのGUID/UUID監査へ渡す。同条件コピーと現表示の残り2件は、実際の5452行データ未取得のため確定できない。既知403のデータ先を再試行せず、コピーの時点差/フィルタ差として保留。数字に合わせる調整、元本書込、公開数変更なし。
