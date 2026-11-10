# V1/V2 → 統合V3対応・移行表

GitHubの実装同士の比較。オンラインGASとの同一性は未確認。下記は変更・停止の実施記録ではない。

|既存コード/入口|役割・重複/問題|V3の対応|今回の扱い|
|---|---|---|---|
|LibraryMetadataBackfillV1 / previewLibraryMetadataBackfill10 / scheduledLibraryMetadataBackfill10|GUID照合、画像/音声/時間/概要、取得元カーソル。途中アイテム位置なし|共通V2識別子とV3項目別計画、フィード別再開|V1本体・トリガーは無変更|
|LibraryMetadataBackfillV2 / previewLibraryMetadataV2|全RSS fetchAllと全解析|V2 snapshotを1フィードずつ呼ぶ|既存入口は保持、V3から呼ばない|
|LibraryMetadataBackfillV2Writer / writeLibraryMetadataV2Pilot10・80|毎回全RSS取得後に上限、複数セル補完|runLibraryV3AfterApproval、最大10EP/200item/110秒目安|旧手動入口は保持|
|LibraryV2GuidAudioAnchoredWriter / LibraryV2OmnyClipGuidPilotWriter|GUIDだけの照合/試験・全RSS再取得の重複|libV2CpMatches_ / libV2CpRowReasons_を一度だけ使う|旧入口は保持、V3から呼ばない|
|LibraryV2CheckpointEngine|1フィード分割キャッシュ、ETag/Last-Modified、厳格照合、HTTPバックオフ|**再利用**。extended projection・任意namespace/chunk/timeoutを追加|既存呼出しの既定動作/返却項目を保持、V2 25テストで回帰確認|
|LibraryV2UnifiedFastAutomation / scheduledLibraryV2UnifiedFast|単一フィードを完走まで処理、V2専用enabled/lease|scheduledLibraryV3は独立config/カーソル、同じScriptLock、フィード交代|既存統合スケジューラは無変更・未停止|
|LibraryV2MediaTalkPilot10 / writeMediaTalkPilot10Once|EP-05585〜05576、G/O限定20セルの一回試験|保存済み10件のG/O再補完0を実データで確認|試験用入口を流用しない・再実行しない|
|LibraryV2FeedDiagnostic / TargetedReadOnlyPreview / LedgerGapInventory|5項目の診断・短い候補サンプル|previewLibraryV3AllColumns + 項目状態/出典ハッシュ + 全件CSV監査|既存診断は保持|
|LibraryV2AudioAvailabilityAudit / auditLibraryV2OldNewsAudio5|GASでHEADを実行する未対応メソッド|外部PythonのHEAD/限定Range取得とV3証跡記録|旧監査はネットワークを実行しない事前確認へ修正|
|LibraryV2ContentAudit / previewLibraryV2AudioProbe|最大20件のRange fetchAll。200/206だけでは音声や再生を証明しない|外部streamingは実206・Content-Type・音声signatureを区別|既存入口は無変更、V3から呼ばない|
|OfficialRssBackfillWrite20等|個別番組の新規採番・過去回追加|原ID登録・日付境界・予約→追加・再実行保護を統合|旧書込関数を呼ばない|
|既存「図書館・進捗ダッシュボード」|一部数式参照が古く、見出し文字が数値欄に出る|専用「図書館V3・進捗」を承認後に作成|既存の式/書式/値は無変更|
|「削除・除外履歴」|現在0件、将来の除外根拠|毎書込直前に再読。加えてV3原ID登録を保持|追加/削除せず再利用|
|フォーム/Spotify/プレイリスト自動更新|独立した本番運用|V3は読み取らず・書き込まず・停止しない|公開API契約・OAuth・appsscript.json無変更|

## 4層の実装

1. **番組取得**: libV2CpSnapshot_ / libV2CpHttp_。V3 namespace `LV3CP`、22,000文字断片、SHA-256、条件付き取得、欠落時の再取得。初回取得はSNAPSHOT_READYで終了し、その実行では台帳を書かない。
2. **エピソード照合**: V2のGUID・Omny Clip ID・公式Asahi itemidを全候補の和集合で照合。一意EP、番組、正規化タイトル、JST日付が一致しなければ保留。V3は不一致を回避する曖昧検索・自動別名変換をしない。
3. **項目判定**: libV3Plan_。既存非空欄・数式は保持。17項目に個別の候補/状態/値ハッシュ。全51列の欠損はpreviewLibraryV3AllColumnsで検査。既存値の人間変更はRECHECK_REQUIREDとして固定し、再走査・別RSSの保留を挟んでも自動復活しない。
4. **音源確認**: library-v3-audio-probe.py。最大5件、許可ホスト、最大2転送、HEAD/Rangeの独立証跡。GASのHTTP機能では未対応HEADやRange無視時の受信量を安全に保証できないため、自動の代替GETをしない。外部実行環境との運用接続は未設定。

## 状態の意味

|状態|意味|
|---|---|
|UNINSPECTED|未検査。または根拠のある空欄候補を生成したが未書込。candidateフラグは状態と別|
|VERIFIED|その項目の根拠との一致/書込後一致を確認。音声のURL一致や先頭データ確認は全編再生を意味しない|
|NO_INFORMATION|現在のRSS等に、その空欄を安全に埋める明示情報がない。永久に情報がないという意味ではない|
|HOLD|識別子・メタデータ・重複・数式・除外等で保留|
|RECHECK_REQUIRED|既存値との差異、人間/別書込処理による変更、要追加確認。自動上書きしない|

## 耐障害性と物理保存

- `LIB_V3_CURSOR`にフィードごとのhash/offset/retryを保存。8,000文字を超える場合は停止。既存V2のキーは読まない・移行しない。
- フィードの内容変更時はそのフィードだけ0から安全再走査。キャッシュ消失時も同じ内容なら保存位置から続け、他番組の位置を壊さない。
- 各処理バッチ後に次番組へ交代。コールド取得直後だけは同じ番組を次回に残してキャッシュ処理を行う。429/503待ちは当該番組に保持し他番組へ交代。403/最終停止はV3全体をdisabledにする。
- 「図書館V3・項目状態」は **1 EP = 1行**（EP-ID / fieldStatesJSON / updatedAt）。項目別状態をJSON内に保持し、17項目×全件の行爆発を避ける。45,000文字/EPを超えたら停止。台帳の原文を状態に複製せずハッシュを記録する。
- 原ID登録は200台帳行/回。全件登録前は新着追加しない。登録後に人間が行を消した場合も原ID記録は残す。新着候補は基準時刻以降のみ、同じタイトル/日付・同一音声等は保留。
- 新EP-IDは台帳・状態表・単調増加プロパティの最大値から採番。**予約を状態表に保存してから行追加**。途中失敗した予約は自動で再追加しない。安全な保留として人間確認する。
- RSS取得・再試行・失敗・書込バッチは既存実行履歴へ別状態として記録。失敗時のカーソルは破壊しない。履歴記録に失敗した場合はV3をdisabledにする。
- GASの強制打切りではfinallyが動かない可能性がある。ScriptLockは排他に使用し、保存済み位置/予約/既存値の再読で次回を安全にする。一般エラー2回、HTTP停止、完了した実行150秒以上でV3をdisabledにする。既存トリガーは自動削除しない。

## 公式仕様との照合

2026-10-17に以下を実読した。

- [UrlFetchApp](https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app): 記載メソッドはget/delete/patch/post/put。HEADは記載なし。現行ドキュメントにはtimeoutSeconds（既定360秒）が記載されているため、V3だけ45秒を指定。実GASでの対応・効果は承認後に検証する。XML解析を中断する仕組みではない。
- [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas): 6分/実行、URL Fetch応答50MB/回、Properties 9KB/値等。V3は処理ループ110秒を目安に余裕を確保するが、全I/Oの所要時間を保証した値ではない。

従来の「単一fetchを中断できない」という監査記述は初版時点の制約説明。V3は現行の文書にあるtimeoutSecondsを明示するが、本番の打切り保証を未実測のまま宣言しない。
