# A/B/C承認受領後のMac実行手順 — 2026-10-22

承認済み。WORKから実機への認証済み書込経路はなく、本書保存時点ではA/B/Cすべて未実行。新しい承認要求ではなく、既存Macセッションでの操作手順。既存PRを更新し、新PR/merge/公開は行わない。

## 共通の停止条件

**各操作の直前にMacの現在時刻を確認。2026-10-23 00:00 JST（2026-10-22 15:00 UTC）以降なら以降の作業を停止し、新しい切替日時を再提示する。勝手に変更しない。**

```sh
TZ=Asia/Tokyo date '+%Y-%m-%d %H:%M:%S %Z'
python3 -c 'import datetime; cutoff=datetime.datetime.fromisoformat("2026-10-23T00:00:00+09:00"); assert datetime.datetime.now(datetime.timezone.utc)<cutoff, "STOP: approved cutover is past"'
```

別チャットの変更・実行中writer・lease・競合trigger・SHA不一致・読戻し不一致・新しいOAuth要求があれば停止。コードは54ファイル丸ごとpushしない。新しいプロジェクト/デプロイは作成しない。

## A — 既存2ファイルのみ

1. Macの元clasp取得先で`.clasp.json`のscriptIdと、GASエディタ「朝リスの田_Phase2_隔離検証」のプロジェクト設定のScript IDが一致することを確認する。ID/認証情報は公開コメントへ貼らない。
2. 元ZIPは保全する。`shasum -a 256 asarisunowa-gas-20261022.zip` が `c2917d243539c8bb3e2c8c128c048b4c048777723482a8d09b55d61d4b3ea97b` と一致すること。
3. 別の新しい空フォルダーで `clasp clone SCRIPT_ID` を実行して直前ソースをREAD_ONLY取得する（SCRIPT_IDは手順1の実ID）。全54ファイルのSHAを受領インベントリと比較する。対象2ファイルのbeforeSHAは下表。他52ファイルも一致しなければ停止。`.clasp.json`等のclasp管理情報は54ファイルの比較に含めない。
4. GASエディタで `previewLibraryV3Autonomy` と `previewLibraryV3Morning` を実行しログを手元保存。baseline.complete=true/offset=6591、V3 enabled=false/allowNew=false/allowEnrich=false、Morning config/state空、triggers=0、conflictingTriggers=[]、writes=0を確認する。実行履歴に稼働中処理がないことも確認する。
5. プロジェクト設定から変更前の `LIB_V3_CONFIG` と `LIB_V3_MORNING_CONFIG` の**有無と生の値だけ**を手元へ保存。状態/IDcounter/秘密値を変更しない。台帳の読取バックアップ（全タブxlsx）も取得し、保存日時とSHA、既存行数・最大EP-IDを記録する。バックアップ作成失敗なら停止。
6. READMEのprepareスクリプトで合成版を生成する。スクリプト/patch/manifestはPR248のcommit `b962eb54c9b51784a97d31b388a6151147b66759` に固定。入力は直前clasp取得先、出力は別の空フォルダー。
7. 出力2ファイルのafterSHAを確認して、既存GASエディタの **LibraryV3 と LibraryV3Morning の本文だけ**を置換し保存する。他52ファイル・manifest・OAuth・ScriptProperties・トリガーは触らない。`clasp push`は使わない。
8. 再び別の空フォルダーへclasp cloneし、2ファイルがafterSHA・他52ファイルが変更前SHAであることを確認。改行だけの不一致も自動容認しない。手順4のREAD_ONLY previewを再実行し、無効設定/トリガー0/書込0を確認する。

|ファイル|before SHA256|after SHA256|
|---|---|---|
|LibraryV3.js|35883c8de601dd21c545198b9eccf5d7c859d359885bfc5919d7202e182abe92|b06150b80e595581173d7a9415de0150e4bf42ebf02ef1f72cb08eb7492aee99|
|LibraryV3Morning.js|0d3a8654aa01075a2f9162a3b442602beed9528670a7ca2f1a618de9ca77c775|d93a43258ca8e88d458d801c150a0eb3b7e594c465d45a846b4fc0a3d3b73015|

## B — RSS専用設定

正式な設定関数と承認済み引数は次のとおり。GASエディタの通常の「実行」ボタンはこの引数を渡せないため、引数なしで実行しない。

```js
configureLibraryV3MorningAfterApproval({
  enabled:true, rssOnly:true, spotify:false, ruleKeys:[],
  since:'2026-10-23T00:00:00+09:00'
})
```

既存の認証済み関数呼出経路がない場合、**コード/manifestを追加変更せず**、MacのGAS「プロジェクト設定 → スクリプトプロパティ」で承認済み2設定を編集する。これは設定関数の呼出実績ではなく、同じ2設定をUIで適用する代替操作として記録する。秘密値や他のプロパティを削除しない。

- 直前に時刻、AのafterSHA/バックアップ、トリガー0、baseline.complete=true、実行中writerなし、Morning state空（leaseなし）を再確認する。設定関数の排他ロックをUI操作は取得しないため、他の操作者も書込操作をしないことを確認できなければ停止する。
- 変更前 `LIB_V3_CONFIG` が正確に下記であることを確認。未知の追加キー/変更があれば上書きせず停止する。

```json
{"enabled":false,"autonomous":true,"allowEnrich":false,"allowNew":false,"spotifyApi":false}
```

- `LIB_V3_CONFIG` を次の値へ変更して保存する。直後に再表示して読戻す。トリガーはまだ0件。

```json
{"enabled":true,"autonomous":false,"allowEnrich":false,"allowNew":true,"spotifyApi":false,"newAfter":"2026-10-22T15:00:00.000Z"}
```

- 時刻を再確認し、`LIB_V3_MORNING_CONFIG`（変更前は未設定または `{}`）を次の値へ変更/追加して保存し、再表示して読戻す。予期しない既存設定は上書きしない。

```json
{"enabled":true,"spotify":false,"ruleKeys":[],"since":"2026-10-22T15:00:00.000Z","rssOnly":true}
```

- preview2種を実行し、enabled/allowNew=true、autonomous/allowEnrich/spotifyApi=false、rssOnly=true、spotify=false、ruleKeys=[]、cutover一致、競合なし、triggers=0、writes=0を保存する。コードSHAも再取得して一致確認する。途中で失敗/期限超過ならCへ進まず停止設定に戻す。

## C — 朝トリガー

1. 時刻、バックアップ、afterSHA、Bの設定読戻し、競合/実行中writerなしを再確認。**現在のトリガー0件**を確認。
2. エディタで引数不要の `installLibraryV3MorningTriggerAfterApproval` を1回実行。返り値がエディタに表示されない場合はトリガー画面とpreviewで確認する。ALREADY_INSTALLED/異常なら停止して調査し、重複作成しない。
3. トリガー画面で `scheduledLibraryV3Morning` が日次1件、05時台、Asia/Tokyoであること、他handlerがないことを確認する。トリガーID、作成時刻、設定を手元保存する。previewでもdaily1件、RSS専用設定、競合なし、writes=0を確認。コードSHA/2設定の再読戻しも行う。
4. 手動で `scheduledLibraryV3Morning` や `continueLibraryV3Morning` を実行しない。初回は10/23の05:15頃（近似±15分）。未完了時のみコードがcontinueを最大1件管理する。設置直後のcontinuation0件は正常。

## 停止・復旧

異常時は `stopLibraryV3MorningAfterApproval`、`stopLibraryV3AfterApproval` を実行し、両enabled=falseを読戻す。今回作成したdaily/continuation IDだけ削除し、0件を確認する。設定2キーは保存した変更前の値/存在状態へ復旧し、コードは必要時のみ元ZIPから同じ2ファイルだけ戻す。全54ファイルSHAとREAD_ONLY previewで確認する。

台帳全体の巻戻し、既存行削除、予約EP-IDの再利用はしない。登録後に異常が見つかった場合は停止し、EP-ID/GUID/51セル差分を保存して復旧方法を個別判断する。既知12件・公開JSON・Spotify・メール・PR mergeには触れない。

## 初回朝のログ

開始/終了JST、対象7番組/RSSのHTTPと取得数、新着/重複/除外/保留の理由、割当EP-ID/GUID、51セル読戻し/VERIFIED、同一GUID再試行で追加0、checkpoint/pending/継続ID、失敗/停止理由、旧12件未登録を記録。新着0件なら成功0件として記録し、失敗と混同しない。公開JSON生成/Pagesは今回実行しない。
