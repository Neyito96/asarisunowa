# 朝リスの田｜日次作業ログ（2026-10-20）

## 概要
独立エピソード図書館の管理タブを整理し、隔離コピー向け音声URL補完処理の停止状態を調査。SDGs公式JSONの突合せ監査も記録した。

## 1. Google Sheetsタブの安全整理
- 対象: 独立エピソード図書館 `1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4`
- 整理前: 31タブすべて表示
- 第1段階: バックアップ3タブ、1007関連作業タブ2件、計5タブを非表示
- 第2段階: 番組別表示、旧調査原票、SDGs1095、SDGs公式JSON原本、項目定義など19タブを追加で非表示
- 整理後: 表示7タブ、非表示24タブ。Sheetsメタデータ再取得で確認済み。
- 表示タブ: `図書館・進捗ダッシュボード`、`削除・除外履歴`、`取得元一覧`、`エピソード台帳`、`LISTEN・確認待ち`、`自動補完・実行履歴`、`SDGs公式JSON_受入管理`
- **シート削除0、改名0、データセル書換0、GAS/トリガー変更0**。非表示は復元可能。
- 注意: GASの全参照・全動作検証は未完了。非表示後の自動処理を要観察。

## 2. GAS 音声URL補完の状態確認
- 対象プロジェクト: `朝リスの田_Phase2_隔離検証`
- スクリプトID: `1eLqB-k1XIQz5qqOxamvUlinqld7jwSDO6AkWLx9Zg0ePGsuU7pE4rec-`
- 実行履歴: `runLibraryV3AudioBackfillCopyBatchScheduled` が14:30頃まで複数回完了、12:40頃の実行に約360.8秒のタイムアウトあり。画面の表示件数制限に注意。
- ユーザーが提示した状態確認関数は `ScriptApp.getProjectTriggers()` と `LV3A_BACKFILL_FAILURES` を参照し、ログを出さずにオブジェクトを返す実装。
- 状態確認ログ（ユーザー実測）: `{"mode":"READ_ONLY_TIMER_STATUS","triggers":0,"failures":3,"copyOnly":true}`
- このアカウントから見える対象定期トリガーは0本。停止原因・失敗カウンター3との因果関係は未確定。他アカウントのトリガーはこの確認から除外され得る。
- ユーザーが実行した確認用関数 `inspectLibraryV3AudioBackfillTimer` を追加。状態をconsoleへ表示するためのラッパー。GASコードの変更として区別する。
- `LIB_V3_CONFIG` に `"enabled":false` が表示されたが、今回の音声補完タイマーと同じ制御とは断定できない。
- 自動タイマーの再設置・スクリプトプロパティ変更は実施していない。

### 20:47 手動実行の結果（ユーザー提示ログ）
- `mode=COPY_ONLY_AUDIO_BACKFILL_BATCH`
- `status=NO_ELIGIBLE_CANDIDATES`
- `writes=0`, `maxWrites=25`, `elapsedMs=38419`, `feedItems=2651`
- コピー先ID: `19Dv6cgM33NYbrMGLofuVvxM4-WHiuPqxmivZUuwoBqc`
- 対象番組: `ニュースの現場から`
- スキップ内訳: `identity_ambiguous_or_missing=298`, `source_audio_exists=125`, `metadata_hold=66`, `copy_audio_exists=2038`, `copy_row_diverged=124`
- `propertyWrites=0`, `triggerChanges=0`, `spotifyPosts=0`, `sourceWrites=0`
- 今回の安全補完候補は0。**図書館全体の音声URLが補完済みという意味ではない**。スキップ内訳は未補完件数そのものではない。
- 判断: 定期実行は再開せず、保留・行不一致の監査を優先。

## 3. SDGs公式JSONと台帳の照合
- `SDGs1095`: 1,093データ行
- `SDGs公式JSON_1092件原本`: 1,092件
- 公式UUIDの集合は1,092件で一致。作業用シート1049行目でUUID未記録（`助けを求める力、あるかな… #1048`）。
- 共通台帳6,591件に対する識別子による暫定照合: 一意一致1,080件、未一致13件、複数一致0件。タイトル・日付等の完全監査は未完了。
- 共通台帳へのSDGs/後継番組の追加・補完は未実施。
- 監査詳細: [SDGs JSON取り込み監査](./sdgs-1095-library-import-20261020.md)

## 次回の優先事項
1. SDGs・こどもそうだんしつの照合を完了し、安全な共通台帳統合へ進む。
2. 音声URL補完の `copy_row_diverged=124`、識別子曖昧298件、メタデータ保留66件を原因分類。
3. タブ非表示後のGAS動作と本番・隔離コピーの参照関係を検証。
4. 定期実行トリガー消失の原因を停止関数・設置関数のコードと履歴から調査。

## 安全性と記録範囲
この日次ログは、2026-10-20のチャット内で実測・確認した事実に基づく。自動補完の停止原因や未確認のデータ統合完了を推定で断定しない。GitHub保存はこの日次ログのみで、スプレッドシート/GASの追加変更は伴わない。
