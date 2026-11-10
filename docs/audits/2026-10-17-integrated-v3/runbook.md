# 統合V3・操作手順と承認境界

2026-10-17追記: 自動制御の追加実装・新しい操作順は [V3自動巡回](../2026-10-17-v3-autonomy/README.md) / [操作手順](../2026-10-17-v3-autonomy/operations.md) を参照。GitHubのみの変更で、新コードは隔離GAS未反映・トリガー未設置。以下は段階Aまでの記録。

**この手順書は実行許可ではない。** 今回行ったのはGitHub開発ブランチへの実装、接続済みシート/RSSの読取、ローカルテスト、ホストからの少量音源検査まで。本番変更・実シート書込・トリガー・Properties変更・マージは未実施。

## 2026-10-17 オンライン監査の追記

編集URLの追加後、指定プロジェクト全33ファイルを実読した。名称は「朝リスの田_Phase2_隔離検証」で実台帳に接続。公開サービス本番とは別。現在表示トリガー0・公開デプロイ0、V3未配置。全文差分と本番6トリガーの維持対象、2ファイル限定の導入/承認/ロールバックは [オンラインGAS監査](../2026-10-17-online-gas/README.md) と [段階移行手順](../2026-10-17-online-gas/migration-and-approval.md) を正とする。以下の「URL未記入」は当初監査時点の記録。全フォルダ一括反映は行わない。

## 2026-10-17 段階A完了の追記

ユーザーの明示承認により隔離検証側だけでCheckpointEngine更新＋LibraryV3追加とREAD_ONLY3関数を実施。6,591件を読み取り、RSS488件/候補14セル/実書込0を実測。詳細は [段階A結果](../2026-10-17-stage-a/README.md)。enabled/allowEnrich/allowNewはすべてfalse、トリガー0のまま。段階B以降は未実施。以下の未記入/未反映は各当初時点の記録。

## 最初に必要なオンライン照合（当初記録）

本番GASの編集URL/script IDが未記入のため、現コードとの一致を確認できていない。隔離プロジェクトの過去実行ログは本番現状の証明にはならない。

ユーザーがGAS画面で確認/提供するもの（保存・実行・変更はしない）:

1. 本番GASの編集URL、プロジェクト設定のスクリプトID、プロジェクト名。隔離用と本番を区別する。
2. オンラインの全`.gs`/`.html`と`appsscript.json`。APIが使える場合は`projects.getContent`のHEADを読取取得。実際に公開しているデプロイID/バージョンも読取確認し、その固定バージョンのソースも照合する。
3. トリガー画面のハンドラー名・周期・所有者/実行アカウント。getProjectTriggersは実行ユーザーの範囲なので、他所有者のトリガーも別途確認する。今回停止しない。
4. 実行履歴の直近成功/失敗/実行中、特にV1/V2・フォーム/Spotify育成処理の区別。Propertiesはキー名と非秘密の運用フラグだけ確認し、トークン/secretをコピー・公開しない。

オンラインファイルとGitHubの相対ファイル名を対応させ、本文差分・SHA-256を作る。差分不明のまま一括上書きしない。取得権限/接続がなければ、ユーザーによるソースの書出しが必要。編集URLだけで全ソースへの権限が得られるとは限らない。

## バックアップ（書込前に別途承認）

- オンラインHEAD・稼働デプロイのソースを日時/script ID/バージョン/ハッシュ付きでローカル保存。`clasp clone <SCRIPT_ID>`を使う場合も空の専用フォルダへ読取取得し、既存チェックアウトにpullしない。push/deployはこの工程では行わない。
- 既存トリガーの設定一覧を記録し、実行アカウントを確認する。フォーム/Spotify等、図書館以外の正常な自動更新を止めない。
- 書込対象の台帳セルについて値・数式・列見出し・EP-ID・除外状態を保存する。シートのバックアップコピー作成も今回未実施で、承認後の操作とする。
- V3の設定/カーソル/原ID登録/採番キーと、専用状態/進捗タブをバックアップする。秘密を含む全PropertiesをGitHubに保存しない。

## 関数一覧

|実行関数|作用|実行条件|
|---|---|---|
|`previewLibraryV3AllColumns()`|全51列・番組別欠損/状態を読む。RSS取得なし|オンラインソースを照合して配置した後のREAD_ONLY|
|`previewLibraryV3Progress()`|17自動項目の状態/設定/競合トリガーを読む|同上。値あり≠検証済み|
|`previewLibraryV3()`|現在選択の1番組を取得/キャッシュ参照し最大200item・10候補EPを検査。sheet/property/cache/triggerを書かない|ネットワークは最大1 RSS要求。cold/warmを分けて計測|
|`setupLibraryV3AfterApproval()`|専用状態/進捗2タブを作成。台帳変更なし|別途承認、競合する図書館トリガーなし|
|`registerLibraryV3BaselineAfterApproval()`|原ID/識別子を200行ずつ状態タブへ保存、baseline進捗Propertiesを変更|別途承認。6,591件なら最少34回（100秒目安の分割で増える場合あり）、最終BASELINE_READYを確認|
|`runLibraryV3AfterApproval()`|設定に応じてキャッシュ/進捗/履歴/状態を保存、空欄補完/新着追加|別途承認・`LIB_V3_CONFIG.enabled=true`が必須|
|`scheduledLibraryV3()`|同じ処理の時間実行入口|別途承認後のみ|
|`refreshLibraryV3ProgressAfterApproval()`|V3専用進捗表を更新。既存ダッシュボードを変更しない|別途承認|
|`stopLibraryV3AfterApproval()`|V3設定のenabledだけfalse。既存/他機能トリガーを削除しない|別途承認。実行中処理の強制中断ではない|
|`installLibraryV3TriggerAfterApproval()`|V3用10分トリガーを最大1個設置。設定は有効化しない|別途承認。既存図書館トリガーがあると拒否|
|`recordLibraryV3AudioEvidenceAfterApproval(evidence)`|最大5件、24時間以内、EP-IDと現在音声URL一致の証跡を専用状態へ記録|外部証跡を個別レビューして別途承認。再生状態は変更しない|

V3依存はLibraryV2CheckpointEngineと既存の`LIB_V2_SHEET_ID`定義。GASは全ファイル共有名前空間なので、この定数を重複定義しない。旧手動パイロットの名前だけを根拠に実行しない。

## 承認後の段階移行

1. オンライン差分・バックアップをレビューし、反映対象を確定する。本番コード差替えはこの承認まで実施しない。フォーム・Spotify公開API・権限・既存V1本体は変更しない。
2. 別途承認後、既存の**図書館書込**トリガーだけ停止し、実行中処理の終了を確認。旧トリガー一覧は不明なので今回の段階では一切操作しない。V3の競合検査は停止の代替ではない。
3. 先にREAD_ONLY関数を手動実行。SOURCE/header/番組一致、MEDIA TALKの既保存10件、公式itemid・GUID・音声の衝突、対象候補列を確認。取得件数/候補数/実書込0/elapsedMs/API回数を保存。
4. 2タブ作成・原ID登録の承認後にsetup、baselineを実行。初回は `LIB_V3_CONFIG={"enabled":true,"allowEnrich":false,"allowNew":false}` を**承認後にだけ**設定し、取得・状態記録・再開を確認する。これもキャッシュ・Properties・状態/履歴書込を行うのでREAD_ONLYではない。
5. 空欄補完の少量承認後にallowEnrich=true。**最大10EPであり20セル固定ではない。** 今回のV3は1EPあたり最大17項目の空欄候補を持つ。対象EP/列/予想セル数をpreviewとCSVで凍結して承認し、G/O以外を含む場合はその範囲も明示する。メインV3バッチは自動的に既存V2の20セル承認を引き継がない。
6. 1回目のSNAPSHOT_READYは台帳書込なし。次回のCHECKPOINTEDで実値/履歴/状態/再開位置を確認。数式・既存値・人間クリア・除外を保護し、再実行で二重書込がないことを検証。V3実GASの時間と状態表I/Oを測るまで大量化しない。
7. 新着は別承認。原ID全登録済み、取得元番組範囲、基準ISO時刻`newAfter`をレビューし、allowNew=trueを設定。基準以前の未一致76件は自動追加しない。境界前の取りこぼしは候補として人間がレビューする。
8. 手動で連続成功後、トリガーの別承認。既存図書館トリガーなし・V3重複なしを確認して1個だけ設置。初回運転を監視し、V1/V2を並走させない。日々の運転ではCHECKPOINTEDだけでなくRETRY_WAIT/FAILED/STOPPED_HTTPも見る。

`LIB_V3_CONFIG`の初期値は無効。V1/V2のenabledフラグはV3を有効化しない。運用基準日は今回コードから勝手に設定しない。新着の予約失敗、human_or_other_writer_changed_cell、旧SDGs名不一致等を一括解除する関数は設けない。確認・修正は別承認にする。

## 音源の独立工程

入力JSONは最大5件の`[{"id":"EP-...","url":"https://..."}]`。URLは台帳または監査対象の公式RSSから取得し、どちら由来かを明記する。

```sh
python scripts/library-v3-audio-probe.py input.json evidence.json --range --follow-provider-redirects
```

- GASのトリガーやシートを書かない。HTTP HEAD→許可ホストの転送最大2回→成功時だけGET Range 0–1023。200でRangeを無視した本文は読まない。206でもContent-Typeと音声signatureが必要。
- 403/429/503等は成功でなく再検査。Retry-Afterを記録して終了し、その場で連続再試行しない。外部で定期化する場合はRetry-After以降の再実行管理・実行環境の承認が必要。今回cron/外部サーバーを設置していない。
- HEAD成功は到達性、AUDIO_PREFIX_OBSERVEDは先頭データ取得、全編の再生は別の人間確認。404/410でも書誌を削除しない。
- 証跡のGAS取込は別途承認後に、Apps Script実行API等から引数を渡す。外部からGASへの公開エンドポイントを新設していない。今回5件のURLは台帳未補完でRSS由来のため、そのまま取込するとURL不一致で拒否される。台帳の音声URLを承認後に補完してから再照合する。

## ローカル検証の再現

生の台帳/RSS概要には公開リポジトリへ複製しない情報が含まれる可能性があるため、CSV成果物とハッシュだけを保存する。

```sh
python scripts/project-library-v3-inputs.py captured-ledger.json rss-manifest.json projected
node scripts/audit-library-v3-snapshot.cjs projected.ledger.json projected.rss.json report.json
node --test tests/gas-library-v3.test.mjs tests/gas-library-v2-checkpoint.test.mjs tests/gas-auto-manual-lifecycle.test.mjs tests/gas-auto-delete-pending-request.test.mjs tests/gas-theme-approval.test.mjs
python -m unittest discover -s tests -p 'test_library_v3*.py'
node scripts/test-official-rss-preview.cjs
```

台帳入力は `{readAt,spreadsheetId,headers,rows,sources,exclusions,history}`（必要ならdashboard/definitions）。UNFORMATTED_VALUEの配信日serialはSheetsの1899-12-30起点の現地日時として変換する。RFC日時の`-0000`はUTCを明示し、ホストTZに依存させない。manifestは`[{show,url,path}]`で、pathはローカルに保存したRSS XML。再生コードはGASやネットワークへ接続しない。

## 停止とロールバック

停止・設定復旧も本番変更なので、今回未実施で別承認が必要。

1. V3 enabledをfalseにし、実行中の終了を確認する。`stopLibraryV3AfterApproval`は他の自動更新・トリガーに触れない。
2. 承認したバックアップのGASソース/デプロイへ戻す。旧図書館トリガーを戻す場合はV3停止・実行終了を確認してから、元の所有者/周期/ハンドラーを個別復元する。両方を同時に有効化しない。
3. 既存値は書換えない設計だが、補完済み値を空欄へ戻す操作は別の破壊的変更。事前セルスナップショットと今回の書込記録が一致し、その後人間編集がないセルだけをレビューして、別承認後に行う。全シートの過去コピーをそのまま上書きしない。
4. 新規EPは自動削除しない。異常があれば保留/人間除外で保持し、書誌情報を失わない。原ID登録・予約・最大採番値は保持し、採番カウンターを巻き戻さない。
5. 不完全な予約や手動クリアのRECHECK_REQUIREDは証跡を保存して個別判断。V3状態タブを丸ごと消して「再開」しない。

## 今回の承認対象候補（まだ実行しない）

オンライン差分が未確認のため、現時点では一括本番移行の承認は求めない。まず編集URL/script IDとオンラインソースを取得する。その後、反映ファイル、停止する旧図書館トリガー、作成する2タブ、変更する5運用キー、少量対象EP/列/セル数、ロールバック用バックアップを具体的に提示して承認を得る。

変更する可能性のある運用キーは `LIB_V3_CONFIG` / `LIB_V3_CURSOR` / `LIB_V3_BASELINE` / `LIB_V3_LAST_ID` / `LIB_V3_FAILURES`。既存V1/V2やSpotify認証のプロパティは変更しない。
