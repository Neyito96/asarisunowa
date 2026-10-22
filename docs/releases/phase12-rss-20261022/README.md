# 2026-10-22 — 明朝のRSS収蔵：承認待ち最小セット

**準備完了、実機変更0。** 対象は既存GAS「朝リスの田_Phase2_隔離検証」。元ZIPの54ファイルとインベントリ全SHAが一致。バックアップZIPのSHAはoverlay-manifest.jsonに固定。#230→#243→#247（6a54f24）の必要差分だけを使う。

## 1. 差分と反映対象

|対象|必要な差分|保全|
|---|---|---|
|LibraryV3.js|管理51列のhash、ALIB排他、新着巡回対象7本、検証済み登録証拠の維持|実機固有の候補概要・出演者監査4関数|
|LibraryV3Morning.js|明示RSS専用/ログ通知、05時台/約05:15、1分pending継続、ALIB競合停止|実機固有の候補/準備確認3関数、Spotify処理の現状|
|その他52ファイル|変更なし|BaselineTrigger、manifest、OAuth含む|

CheckpointはGitHub版と完全一致。Autonomyは診断表示の差のみなので今回変更しない。通知ファイル追加も不要。既存全体に重複関数22群があるが、今回の12変更/追加関数はすべて一意で新規重複なし。既存重複を今回の作業で整理しない。

実機全体/最小修正後とも53JS構文PASS。実機ソースを保全した合成版でRSS専用/ALIB/コピー等28/28ローカル試験PASS。既存163回帰は再利用。本番GAS実行ではない。

## 2. A〜Cの承認表

|承認|変更対象・操作|実行関数/方法|復旧|
|---|---|---|---|
|A|GASのV3とMorningの2ファイルだけ必要関数を反映。設定・manifest・OAuth・他52ファイル不変更|下記ローカル準備でSHA一致する2ファイルを作成し、**既存GASエディタの該当2ファイルだけ反映**。全54ファイルのclasp pushは行わない|元ZIPから同じ2ファイルだけ戻し、全関数/manifestのSHAを再確認|
|B|LIB_V3_CONFIG/MORNING_CONFIGをRSS専用で有効化。既知12候補は除外|`configureLibraryV3MorningAfterApproval({enabled:true,rssOnly:true,spotify:false,ruleKeys:[],since:'2026-10-23T00:00:00+09:00'})` を1回|変更前の2設定の存在/安全な値を手元保存。`stopLibraryV3MorningAfterApproval()` と `stopLibraryV3AfterApproval()` で停止後、この2設定の承認したキーだけ元へ戻す。counter/台帳を巻戻さない|
|C|日次scheduledLibraryV3Morningを1件、未完了時のみcontinueLibraryV3Morning最大1件|`installLibraryV3MorningTriggerAfterApproval()` を1回。05:15頃±15分JST、05時台のみ。pending継続1分|Bの停止後、今回作ったIDのdaily/continuationだけ削除し、元の0件へ戻す。他所有者/他handlerを触らない|

A/B/Cをそれぞれ明示承認するまで実行しない。Cは将来の新着を**本番台帳へ自動追加することの承認**も必要。単にtimer作成だけの許可とは扱わない。既知12件のバックフィル、検証コピーの追加書込、公開JSON、merge/Pages、Spotify、メール送信は含まない。

承認時にsince日時が既に過去なら実行せず、次の未到来00:00 JSTへ更新して再提示する。初回予定は10/23朝。17時巡回は朝の実測後の別判断。

## 3. Aのローカル準備（ネット接続/本番変更なし）

このPRのリポジトリで次を実行する。PRIVATE_CLASP_DIRは今回ZIPと同じ内容の専用clasp取得先、NEW_OUTPUT_DIRは別の空フォルダーを指定する。

```sh
python3 scripts/prepare-phase12-rss-overlay.py PRIVATE_CLASP_DIR NEW_OUTPUT_DIR
```

入力SHAが1文字でも違えば出力前に停止。成功すると新しい出力先にV3/Morningの2ファイルだけができる。元clasp取得先や.clasp.jsonを編集せず、push/deploy/設定を実行しない。出力SHAはoverlay-manifest.jsonのafterSha256と一致する。

A実行直前に実機の対象2ファイルが同じbeforeSha256かをREAD_ONLYで再確認。別チャット等の更新があれば止めて差分再審査。実機固有7関数を削除しないため、GitHubのcanonical2ファイルをそのまま貼らず、この準備出力を用いる。

現在このWORK環境には実機への認証済み書込経路がなく、AはMac側GASエディタでの反映が必要。編集先プロジェクト/Script IDを確認して実施し、貼付後は再取得SHAとpreviewで確認する。新たなOAuth許可や別プロジェクト作成は行わない。

## 4. 残課題・初回確認

コードの差分未確認という阻害要因は解消。残るのはA〜Cの承認・実機反映と、操作直前の停止設定/トリガー0/進行中writerなし/backup一致の再確認。

A後はpreviewLibraryV3Morning/Autonomyで無効状態・ALIB競合なし・baseline.completeを確認し、B後はrssOnly:true/spotify:false/rules空/newAfter、C後はdaily1件を確認する。実機固有previewLibraryV3MinimumArchiveReadinessだけを安全性の唯一の根拠にしない。

最初の05時台は以下を記録する。

- 番組/RSS URL、開始・取得時刻、HTTP/取得件数、SNAPSHOT_READY→巡回結果
- 新規GUID、重複/削除/保留理由、割当EP-ID、newIds、writtenCells
- 新規各話の51セル読戻しとidentity VERIFIED/RSS_registered、原文保持
- 同一GUIDの再巡回で追加0件。配信がなければ成功0件として区別
- cursor/completeFeed/未完了、経過時間・日次予算、retry/エラー/停止理由
- 主要7番組の最終成功、旧12候補が未登録のまま保全されていること

通知はLoggerと状態のみ。05:15は近似であり、外部RSS障害時の06時までの全件完了保証はしない。時間外は継続せず状態を残す。163の回帰・28の合成版試験はこの実機ログを代替しない。

P1の5,419/5,450仮群、申告5,452/173日19時間8分の根拠は既存speakers2-scopeに保持。時間欠損/不一致の解消は継続し、朝の新着有効化を待たせない。物理削除・公開数変更なし。
