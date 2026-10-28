# Phase15 GAS単独運転：導入・復旧

2026-10-28。**コード完成とオンライン稼働は別。現時点は未導入・本番書込0・トリガー未設置。**
Work/ChatGPTは実行経路に存在しない。導入後はGoogleの15分トリガーが呼ぶ。

## 反映対象と再利用

- ベース：`29334c2` の `Phase15IntegratedProductionEngine.gs`。RSS/JSON照合、V原文、W関連記事、監査を継続利用。
- Phase14参照：`82679d7242f35e1aabae9b2e385c03c76dde8f44` の `Phase14ProductionRssFastShadowV2.gs`（GUID索引・日時順）、`Phase14NewEpisodeFormatterV2/V3/V4ReadOnly.gs`（明示出演者、5名上限、収録日保持）。既存の番組単位URL同期はエピソード照合に流用しない。
- 追加：`Phase15AutonomousRuntime.gs`。予約→台帳→再読込、再試行、巡回、単独owner、停止/復旧。
- コピーするのは **`install/Phase15AutonomousBundle.gs` 1ファイル**。同時に元の2ファイルも配置すると名前が重複するので、どちらか一方にする。
- `install-manifest.example.json` は新規専用プロジェクトの例。既存プロジェクトのマニフェストや無関係な関数を置換しない。
- 公開JSON・Pages・V3公開側の更新は含めない。新着は本番台帳へ収蔵するが公開審査を迂回しない。

## Google側の3工程

### 1. コード反映とwriter移管

本番台帳ID：`1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4`。
オンラインの最新版・プロジェクトIDは導入担当者が確認する。今回、オンライン稼働内容は確認できていない。

既存の統合GASプロジェクトへbundleを反映する。別のGASプロジェクトは作らない。オンラインのソースを保存し、同名Phase15関数だけの差分を確認する。
旧プロジェクトのうち、この本番台帳へ書く関数/トリガーだけを特定して停止する。COPY専用・プレイリスト・無関係な処理を止めない。
ScriptLockは別プロジェクトを排他できない。共有`P15_OWNER`は協調するwriterの検査であり、既存の無改修writerを物理的に阻止する機構ではない。別アカウント所有トリガーも所有者に確認する。未確認のまま自動運転を有効化しない。

### 2. 初回権限承認・設定・100行試運転

`p15AutonomousPreflight` を実行し、Googleの権限画面で本人が承認する。外部HTTP、台帳読取、トリガー一覧を確認するが台帳は書かない。
返却する `savedCursor`、`maxAllocatedId`、`pendingWrites`、RSS、スキーマを確認する。

Script Propertiesに以下を設定する。値をコードへ埋め込む必要はない。

| プロパティ | 設定値/意味 |
|---|---|
| `P15_OTHER_WRITERS_PAUSED` | 対象writerの確認・停止後のみ `YES` |
| `P15_WRITER_REVIEW_NOTE` | 確認したプロジェクト・関数・トリガー所有者・日時を短く記録 |
| `P15I_CURSOR_PROD` | 旧GASから読んだ保存値。処理履歴の最大行と保存カーソルを混同しない。読めなければ担当者が確認した安全な再巡回開始位置を明記して設定 |
| `P15_INITIAL_CURSOR_CONFIRMED` | 上記の確認/安全な再巡回開始位置の決定後 `YES` |
| `P15_MAX_EP_NUMBER` | preflightの`maxAllocatedId`以上。台帳・固定ID採番履歴・予約済IDの最大値より小さい値は採番に使われない |
| `P15_INGEST_SINCE` | 新着収蔵の開始日時（ISO 8601、例 `2026-10-28T00:00:00+09:00`）。過去回一括収蔵を防ぐ境界。導入日に毎回更新しない |
| `P15_BATCHES_PER_TICK` | 初回 `1`（100行）。安定した実測確認後 `5`なら最大500行。制限時間で少なく終わることがある |
| `P15_W_REVISION_APPROVED` | 未設定は既存W保護。既存Wの品質修正を明示的に許可する場合だけ `YES`。V完全一致・清掃検査合格が必須 |

`p15AutonomousEnable` を実行。owner登録、書込ゲート、旧保留キューの原因別移行を行う。トリガーは作らない。
次に `p15AutonomousTick` を一度実行する。新着最大10件＋既存100行まで、再試行最大5EP、メディア最大20行の枠内。
`P15_LAST_RUN` と `P15_RUNS`、`P15I_AUDIT`、`P15_INTAKE` を確認。少なくとも `status=OK`、`processed>=1`、未確定PENDINGなしを要する。
新着予約は既存台帳と固定ID採番履歴も参照する。新ロボの永続採番正本は`P15_INTAKE`で、旧採番履歴を上書きしない。

### 3. 明示承認後に時間トリガー設置

今回、設置は実行していない。運用変更として承認後に `P15_TRIGGER_APPROVED=YES` を設定し、`p15AutonomousInstallTrigger` を実行する。
同一ハンドラーがあれば追加しない。15分おきの`p15AutonomousTick`を1個だけ作る。無関係なトリガーには触れない。
旧`p15iInstallProductionTrigger`も新installerへ委譲し、旧巡回用トリガーを別に追加しない。
Work終了後はGoogleが実行する。Googleのクォータ/停止障害や失効権限まで保証するものではない。

## 処理と保留

- 既定100行、明示設定で最大500行。取得開始から240秒を予算とし、HTTP/行/バッチ境界で残時間を確認。1リクエストのGAS側待ち時間を中断するAPIはないため、ハードタイムアウト後の復旧も必要。
- 各行後に保存。除外・ID欠落でも進む。末尾後は次回先頭へ。再試行は通常カーソルを変更しない。
- 新着優先/既存優先を交互にする。旧公式RSS取得処理を1回のtick内で再利用。
- `P15_RETRY`はEP-ID＋GUID＋原因のキーで重複排除。ネットワーク/429/5xx等は1時間から指数バックオフ、最長7日、8回でEXHAUSTED。未到来のJSON再取得を通常巡回でも抑制。
- 対象外はEXCLUDED、ID不正/原文差異/関連記事対応不明/名前不確実はREVIEW。旧「対象外またはID不正」は実台帳で対象外とID/GUID不正に再分類する。元履歴は削除しない。
- 恒久保留を直したら`P15_RETRY`該当行のSTATEをRETRY、NEXT_UTCを過去にし、必要ならATTEMPTSを0へ。EP-ID/GUIDは編集しない。通常再試行前に再照合する。
- 曖昧な取得元はその行を保留して続行。台帳の識別子/他セルが書込直前に変化、書込途中の失敗、再読込不一致、未確定監査はP15_HALTで全体停止する。
- 新規予約中のタイムアウトは次tickで停止。予約に保存した55列JSONで復旧し、別IDは発行しない。

## 音声・配信先URLの正確な範囲

音声URLの存在、HTTP音声レスポンス、実再生は別。R列にURL/HTTP確認結果、S列は`未確認`。GASは音声デコーダではないため、HTTP200/206を「再生可能」としない。リダイレクト・不明ホスト・取得失敗は未確認。音声なしを推測しない。

配信先は6サービス。個別URL候補の取得と同一エピソードの検証を分離する。番組・検索・プレイリスト・未解決短縮URLは登録しない。既存URLは上書きせず、問題があればREVIEWに残す。

| サービス | 列 | 実ページの照合根拠 | 公開HTTP実例 成功/未取得 |
|---|---|---|---|
| LISTEN | K | 完全一致タイトル＋プレイヤー音声の公式GUID | 1 / 0 |
| Spotify | L | 番組名＋完全一致タイトル＋配信時刻＋再生時間 | 1 / 0 |
| Apple Podcasts | M | 個別storeUrl＋GUID＋タイトル＋配信時刻 | 1 / 0 |
| Amazon Music | AO | 個別PodcastEpisodeのGUID/音声・タイトル・日時 | 0 / 1 |
| Pocket Casts | AP | 個別UUID＋タイトル＋公式音声GUID＋日時 | 1 / 0 |
| Pody | AQ | 個別ArticleのisBasedOnエピソード名＋公式音声GUID＋日時 | 1 / 0 |

2026-10-28のWork環境HTTP検証であり、オンラインGASの取得成功・本番補填ではない。AmazonはHTTP200でもHTMLがJavaScriptシェルで照合情報を取得できず、`EPISODE_METADATA_UNAVAILABLE`。PodyのSpotify/Apple検索ボタンは照合根拠にも登録URLにも使わない。公開実例と抽出フィクスチャは`platform-real-samples.json`。将来のページ構造変更時は安全側に未取得となる。

既存の`配信先URL`シート（番組/リンク種別/配信先/URL）から番組一覧を取得する。`P15_PLATFORM_CANDIDATES`に観測した個別リンクとタイトルを保存し、`P15_PLATFORM_PAGES`で明示的な次ページのみ継続する。候補は未検証であり、保存しただけでは台帳へ書かない。公開HTMLに候補がないサービス・過去回の全件網羅は保証しない。

既存の信頼できる照合資料を使う場合は任意の`P15_PLATFORM_REFERENCES`シートに`GUID,SERVICE,URL,EVIDENCE_URL`を置ける。サービス名は上表の完全一致。参照URLも必ず取得先のエピソード情報を再照合する。

`P15_PLATFORM_STATUS`はEP-ID＋GUID＋サービスごとの状態、原因、候補URL、検証出典、確認日時、次回確認可能日時、照合方式、HTTPコードを保存する。ネットワーク/429/5xxは1時間、通常の未取得は1日、確認済みは30日、予算終了は15分以上空け、次のメディア巡回時に再試行する。指定時刻ちょうどの再試行ではない。REVIEWは自動再試行せず、根拠を修正後STATEをUNAVAILABLE、NEXT_UTCを過去にする。台帳の既存値は消さない。

メディア枠は最大20行、配信先HTTP最大12リクエスト（リダイレクトを含む）、45秒を目安に打ち切り、独立カーソルで再開する。主巡回後に実行し、配信先取得失敗は概要・関連記事・出演者・音声処理を停止させない。`P15_RUNS`のmediaにサービス別verified/unavailable/written/deferred/existingを記録する。書込失敗・並行変更・監査不一致は従来どおり全体停止する。

## 監査・復旧・元に戻す

`P15I_AUDIT`：セルごとのBEFORE/AFTERを先にPENDING保存→書込→再読込→VERIFIED。既存書式・式・検証条件付きセルは保護。原文を数式として実行させない。
`P15_INTAKE`：GUID、予約EP-ID、予定行、状態、出典、55列JSON。`P15_RUNS`：実行範囲/列別数/取得数/新着/メディア。`P15_LAST_RUN`：最新要約。

1. 緊急停止は`p15AutonomousPause`。他のトリガーは止まらない。
2. `p15AutonomousRecoveryReport`は読取のみ。PENDINGの現在値がBEFOREかAFTERか、識別子を調べる。
3. すべてBEFORE/AFTER一致のセルなら、`P15_RECOVERY_APPROVED=YES`後`p15AutonomousReconcilePending`で監査だけ確定できる。不一致や新着RESERVEDは自動修復しない。
4. 新着RESERVEDは予約JSONと対象55列を比較。元の予約ID・GUIDを保ち、本人が不足値の反映/差分復旧を行い、全列照合後に予約状態をVERIFIEDへ。列が別EPへ変わっていたら上書きしない。予約IDを別エピソードへ転用しない。
5. 既存セルの巻戻しは監査行番号を`P15_ROLLBACK_AUDIT_ROW`に設定、`P15_RECOVERY_APPROVED=YES`後`p15AutonomousRollbackOneCell`。現在値がAFTERのままの1セルだけBEFOREへ戻す。後からの人間の編集は拒否。台帳行の削除機能はない。
6. 原因解消後、`P15_RESUME_APPROVED=YES`→`p15AutonomousResume`。未確定書込が残れば再開不可。停止理由を調べずHALTだけ消さない。

## 再現テスト・未完了事項

```bash
node --test lab/phase15-safe-ingest/automation/autonomous-runtime.test.cjs
node lab/phase15-safe-ingest/automation/legacy-regression.cjs
node lab/phase15-safe-ingest/automation/build-autonomous-bundle.cjs
```

旧ベースでカーソル/例外処理4ケースがFAIL、修正版でPASS。旧LABの16＋7件も維持。結果は`autonomous-verification.json`。

未完了：オンライン最新版との比較、保存カーソル実読取、旧writer所有者確認、実GASの8系統RSS/JSON・実行時間・権限・書込再読込、GAS実機の6サービス取得、トリガー設置と次回発火確認。モック結果をこれらの成功証拠にしない。
