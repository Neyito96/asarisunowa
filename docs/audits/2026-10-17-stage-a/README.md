# 段階A — 隔離検証GASへの最小反映とREAD_ONLY実測

2026-10-17 JST。前回オンライン監査コミット `549a6124f79cea70bd61a178bd814d469ce57078` を引継ぎ。ユーザーが今回承認した段階Aだけを実施。V3再設計、既存33ファイルの機能再監査は行っていない。

## 対象と反映

- 対象: **朝リスの田_Phase2_隔離検証**、script ID `1eLqB-k1XIQz5qqOxamvUlinqld7jwSDO6AkWLx9Zg0ePGsuU7pE4rec-`。
- 既存バックアップZIP SHA256 `f5d5f737e5108efe5a654672c570cf4f6aac5f1fd277985ed538a80bb3310bde` は前回記録と一致。ZIP内33ソースは同梱SHA256SUMSの全件検証に合格。
- 変更前 `2026-10-17T03:46:41.095Z` にハッシュ照合用の原文取得。現状33/33がバックアップと**バイト一致**。全面的なコード再監査はせず、ドリフトの有無だけを確認した。
- 表示アカウントのトリガーは0、直近実行は10:36:07の過去パイロット。表示された履歴に実行中はなかった。他所有者/外部起動の不存在を証明するものではない。
- `LibraryV2CheckpointEngine.gs` の更新と `LibraryV3.gs` の追加。manifest・V1/V2の他ファイルは維持。保存後ブラウザーを再読込して34ファイルを照合し、**32件不変・1件更新・1件追加**を確認した。[source-verification.csv](source-verification.csv)
- 公開サービス本番にはアクセス/変更していない。トリガー・Properties・デプロイ・実シートへの書込操作は実施していない。

## 実測用の小さなログ補強

前回V3の `previewLibraryV3AllColumns()` は戻り値だけで、GASエディターの実行ログに結果が出ない。また進捗全体のJSONは1ログの文字数制限を超える。機能を再設計せず、次のログだけを追加した。

- AllColumns: mode、rows、columns、groups、writesの要約をLoggerへ出す。
- Progress: 既存の詳細ログの前にmode、rows、groups、config、conflictingTriggers、writesを短いJSONで出す。

戻り値・照合・補完・状態/Propertiesの処理は変更していない。ログの書込0は実シート0の意味で、GASの実行履歴/標準ログ自体は今回の3実行によって増える。

## 操作途中の不一致と復旧

最初の反映操作ではエディターの選択/表示切替と本文入力が競合し、CheckpointEngineの本文が `previewMediaTalkPilot10Preflight.gs` に一時的に入った。保存後の比較で検出し、**関数実行前に**同梱バックアップ原文へ復元した。その後、CheckpointEngineを明示選択し、更新前本文がバックアップ一致であることを確認して更新した。

保存済みHEADをブラウザー再読込後に照合し、既存パイロットは原文一致、最終変更は指定2ファイルのみ。これを隠さず記録する。中間状態でGAS関数実行は行っていない。この一時編集はソースに限り、シートやPropertiesの操作は伴わない。

## READ_ONLY実測

実行した関数は `previewLibraryV3AllColumns()`、`previewLibraryV3Progress()`、`previewLibraryV3()` の3つだけ。`setup` / `register` / `run...AfterApproval` / `scheduled` / `install` / `stop` は実行していない。

|関数|開始JST|GAS実行基盤の所要秒|実測結果|
|---|---|---:|---|
|`previewLibraryV3AllColumns()`|12:51:59|10.965|6,591行・51列・510群、writes=0|
|`previewLibraryV3Progress()`|12:52:32|9.446|6,591行・170群、enabled/allowEnrich/allowNewすべてfalse、競合トリガー[]、writes=0|
|`previewLibraryV3()`|12:52:57|37.378|READ_ONLY、RSS488件取得・18item検査・候補14セル・保留3・writtenCells=0|

RSS関数内部elapsedMs=36,143（36.143秒）、実行基盤全体37.378秒と区別。3実行の基盤所要時間合計57.789秒。RSS API呼び出し1、cacheHits=0、Spotify API呼び出し0。全列/進捗の2関数にはRSS取得処理がなく、RSS呼出0はコード経路に基づく。台帳書込0、updatedIds=[]、newIds=[]。

対象フィードはニュースの学校 `https://feeds.megaphone.fm/TASC5851398719`。nextOffset=18、completeFeed=false。READ_ONLYの位置は結果表示のみでPropertiesへ保存しておらず、再実行して続きを自動保存する試験は行っていない。warm cache構築や番組切替のための書込実行も行っていない。

ログに表示された候補EP-IDは EP-00408 / EP-00081 / EP-00082 / EP-00086 / EP-00089 / EP-00090 / EP-00091。清掃済み概要/清掃版の空欄候補で、全14セルに対応するEP-ID全文が表示されたわけではない（サンプル最大10枠のうち3枠を未一致RSSが使用）。これらは候補表示で、書込承認ではない。

保留3件はno_identity_match。各newDecisionに baseline_not_registered / new_registration_not_enabled / historical_or_invalid_publicationがあり、新規登録不可。状態集計VERIFIED=84 / UNINSPECTED=26 / NO_INFORMATION=128 / RECHECK_REQUIRED=17は今回の照合結果で、専用状態シートへ保存された件数ではない。

[measurements.json](measurements.json) / [executions.csv](executions.csv) / [execution-logs.txt](execution-logs.txt)。終了時にトリガー0件を再確認。

## 検証と限界

- モック単体テスト: V3 29件 + V2 25件 = **54/54 PASS**。[local-tests.txt](local-tests.txt)
- 全取得済みソース＋反映後V3の結合構文検証に合格。新規V3関数30個、既存名との衝突0。
- 書込0はREAD_ONLY経路のソース/モックと実ログを根拠とする。秘密を含むProperties全文の前後比較や、全実シートのセル差分再監査は今回行っていない。別ユーザー/外部処理の変更も含めて全環境不変を証明するものではない。
- Progressの詳細JSONはGASで切り捨てられたため、170項目群の全文をこの実行から取得できたとは報告しない。短い設定要約は完全取得した。AllColumnsは510群を算出したが、ログ保存は行/列/群数の要約のみ。
- MEDIA TALKの10件の再処理・番組横断の完走・実書込・停止再開の本番試験は今回の3関数実行と別。カーソル変更や追加の対象関数実行で試験範囲を広げていない。

## 終了状態

段階Aで終了。V3 enabled=false、allowEnrich=false、allowNew=falseを読取確認した。2つの専用タブ作成、原ID登録、Propertiesの初期化/有効化、シート補完、新着追加、トリガー設置、デプロイ、PRマージには進んでいない。

ロールバックが必要な場合は前回ZIPのCheckpointEngine原文を対象ファイルだけへ復元する。新規V3の削除やProperties変更は今回実施しておらず、必要なら別途対象を明示して判断する。公開本番のversion73/既存6トリガーを巻き戻す操作は不要。
