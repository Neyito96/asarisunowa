# 朝の新着保管・Spotify接続：操作と承認対象

**この手順は将来の承認用。今回は一つも実行していない。**

## 接続先と最短経路

`公式RSS → 既存V3 Snapshot/Plan/Append → エピソード台帳 → 既存V1の認証・ルール判定 → Spotify`。

両側の関数を**同じGASプロジェクト**に置くのが最短。別GASの関数を名前だけで呼ぶことはできない。公開HTTPエンドポイントや新しい外部サーバー・有料APIは追加しない。前回全文取得済みの隔離GASにはV1の下記5依存がなかった。今回も一覧上、V1の主要ファイルは存在せず、LibraryV3Morningを単に追加するだけでは実Spotifyへ接続できない。

既存公開GASのV1認証・設定を維持してV3側コードを統合するか、隔離側へ既存V1依存と同じ設定を明示的に移すかを、ソース差分確定後に決定する。**今回は認証情報をコピーしていない。** 全フォルダclasp pushや隔離manifestを本番へコピーする方式は採らない。

直接再利用する関数:

- V3: libV3Context_ / Plan / Append / StatePut / V2条件付きRSS・HTTP / packed状態・履歴・ScriptLock。
- V1: getAutoPlaylistRuleByKey_ / getAutoPlaylistShowIds_ / matchesAutoPlaylistRule_ / getSpotifyUserAccessToken / assertAutoPlaylistSheetLinkBeforeWrite_ / isAutoUpdatePlaylistHumanDeletedV1_。
- 個別判定に必要な既存speaker/no-mirai helperも既存プロジェクトのまま使用する。部分コピーして依存漏れを生まない。

既存V1の `getAllSpotifyPlaylistItems_` は全ページループ、既存writerはまとめて複数追加するため、朝ブリッジでそのループは呼ばない。**既存ルール・認証・作業台検査を再利用し、HTTP送信だけを1ページ/1POST単位に分けた。** 旧V1の日次4時台やフォームの入口は残す。委譲対象のリストだけskip/書込拒否するフックで二重実行を防ぐ。

## 初回の操作順（別承認後）

1. 現行35スクリプト+manifestの全文を取得し、既存バックアップ/GitHubとの差分を確定。未知の差分は中断して照合する。
2. 値・数式・削除除外履歴・V3状態と、対象V3運用キーだけをprivate backupへ保存。認証secretはGitHubへ保存しない。実行中writerなし、旧V3 scheduler/baseline-only triggerなしを確認。V1全体を停止する必要はない。
3. 承認対象は LibraryV3.gs更新、LibraryV3Morning.gs追加、AutoUpdateAutomationV1.gsとPlaylistAutoWrite.gsの委譲フック。既存CheckpointEngine/AutonomyおよびV1依存の配置も確定する。隔離にない依存がある状態で本番を有効化しない。
4. **最初に実行する関数:** `previewLibraryV3MissingAudit()`、次に `previewLibraryV3Morning()`。どちらもREAD_ONLY。初期登録6,591/complete=trueを保持し、再登録・offsetクリアはしない。
5. モック以外の試験は、1フィードREAD_ONLY → 元台帳を保護したコピーで新着1件保存 → 承認されたSpotify試験リスト1件の順。再実行0追加、人間削除の復活0、失敗時の保留を確認する。実台帳・実Spotifyへ勝手に移らない。
6. 開始日時を現在/未来のISO日時（タイムゾーン付き）で定め、`configureLibraryV3MorningAfterApproval({enabled:true,spotify:true,ruleKeys:[承認された既存キー],since:開始日時})`。引数は別途レビューした小さな呼出ラッパー等から渡す。V3をenabled=true/autonomous=false/allowEnrich=false/allowNew=trueにし、newAfterを同じ日時にする。初期登録Propertiesは保持。ここでV3台帳書込・Spotify反映を許可するため、コード反映とは別の承認が必要。
7. **トリガー設置:** `installLibraryV3MorningTriggerAfterApproval()`。既存V3トリガーと重複すれば拒否し、他トリガーは削除しない。毎分1回だが、Asia/Tokyoの06時台以外は設定読み取りだけで終了し、RSS/Spotifyを呼ばない。6時台の開始・終了を正確な秒単位で保証しない。

## 1回の仕事と再開

- 1 invocationはRSSまたはSpotifyの1工程。8分leaseとScriptLockで同時処理を抑止。強制終了後はlease期限から再開可能。
- RSSは既存の取得と保存を別tickに分離し、朝用cacheとcursorを分離。新しい順に最大5候補/200item、最大110秒目安。開始日時以降かつ72時間以内を対象にし、古い概要清掃・歴史補完はしない。台帳の新着書誌は既存安全採番・予約・除外保護で保存する。既存値の一括補完は有効化しない。
- 番組は完了マークで一巡。終わって30分経過した場合は6時台にもう一巡できる。時間内に完了しなければcursor/queueを保持し翌朝へ持ち越す。必ず全番組が毎朝1時間以内で終わると断言しない。
- Spotify URLがない新着は、公式の取得元一覧からShow IDを選び、API最新20件内でタイトル・日付が厳密に一致する一意の実URLだけを採用。RSS GUIDと台帳一意性を前提にし、URLを推測生成しない。該当なし/複数/既存値/数式/他EPのURL所有/保護状態は保留。
- Spotify反映は既存ルールを明示allowlist化。reviewRequiredまたはproductionWriteAllowed=falseのルール、削除済みリストは不可。過去の削除を再登録しないため、開始前のエピソードは対象外。
- 既存リストは100件1ページ/tick。offsetとsnapshot_idを保存し、リスト変更時は先頭から再検査。APIの同一ID・Show・タイトル・日付・is_playableを確認し、POST前にもsnapshot/元台帳/除外を再確認する。
- POST直前にV3状態へ予約を保存し、1URIだけ追加。観測済み・追加済み・保留予約は自動再追加しない。人間が後でリストから消したEPも復活させない。200/201だけ成功。403停止、429/503はRetry-Afterを守って次回へ。GETの再試行は保存位置を壊さず、POSTの不確実な成否は自動再送せず保留する。
- Spotifyの依存/認証不備・予期しない補助エラーが2回なら補助だけpauseし、RSSを続ける。RSS/制御エラー2回や監査履歴書込異常は安全停止。既存認証token取得関数の内部挙動やサービス全体のquotaはこのコードだけでは保証できない。
- 他プロジェクトや人間のSpotify同時編集との完全な原子性はSpotify APIでは保証できない。起動前に同じリストの他writerを排除し、少量試験で運用を確認する。

## 停止・進捗・エラー

- **進捗確認:** `previewLibraryV3Morning()`。設定、最後の結果、当日番組完了、Spotifyページoffset、lease、retryを見る。欠損数は `previewLibraryV3MissingAudit()`、既存の全項目進捗は `previewLibraryV3Progress()`。READ_ONLYはダッシュボードを暗黙更新しない。
- **停止:** `stopLibraryV3MorningAfterApproval()`。朝runnerのみdisabled、checkpointとトリガーは保持。委譲先の旧writerも停止状態を維持し、V1へ勝手に逆戻りしない。
- Spotifyエラー修正後の再試行許可は `resumeLibraryV3MorningSpotifyAfterApproval()`。retry/auxiliary pauseだけ解除し、未確定POSTの保留予約は消さない。POSTは実リストを照合してから人間が個別判断する。
- 任意の基準値・offset・identity・採番・除外をリセットしない。保留を解除するために全Properties削除をしない。
- 正常完了: baseline.complete=true、当日の対象フィードがすべて完了、対象の新着に一意な台帳ID、対象リストの新着が観測/追加済み、未完了ページやretryなし。保留は件数と理由を残して明示し、0欠損/全編再生済みと同義にしない。

## 復旧

まず専用停止関数で止め、実行中処理が終了してから復旧。Propertiesのidentity/採番/予約/除外は消さない。コードだけならこのブランチの4 GAS変更を反映前本文に戻す。既に追加したSpotify項目・台帳行は自動削除せず、証跡と現状を突き合わせて個別承認で対処する。旧V1へ委譲を戻す操作は別レビューとし、停止しただけで旧writerが再追加を始めないようにする。

承認時にまとめる項目: 反映先プロジェクトと4ファイル/依存、開始日時、許可するプレイリストキー、コピー上の試験件数とSpotify試験リスト、本番への書込範囲、トリガー、復旧基準。現行全文・5,439件の集計条件が未取得のまま、承認要求を先行させない。

## 実行時間の正確な限界

UrlFetchApp公式のadvanced parametersには任意のHTTP timeout設定が記載されていない。既存V2の `timeoutSeconds` 引数を45秒の強制保証とは扱わない。新しいSpotify GET/POSTには未文書化timeoutオプションを渡さず、次のHTTP要求前とPOST前の90秒予算判定で分割する。1ページ/tick、最大5要求（認証helper内部を除く）に限定する。実行中のHTTP要求を途中で中断する機構ではなく、GASの強制終了は起こり得る。GET側は最後の確定checkpointから、POST側は事前予約を保留したまま再開する。実GASでの所要時間・quotaは承認後に少量実測する。

公式資料: https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app / https://developers.google.com/apps-script/reference/script/clock-trigger-builder
