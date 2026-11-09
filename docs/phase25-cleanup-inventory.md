# Phase25 整理の棚卸し(2026-11-09)

調査はリポジトリ内のコードと過去の監査文書に基づきます。本番の GAS・スプレッドシート・トリガーの実際の状態は、
このセッションからは確認していません。削除・変更したのは、このブランチのコードだけです。
稼働中の GAS、トリガー、シートの実タブ・実データには触れていません。

## 1. GAS ファイル(`scripts/google-apps-script/`)

| 区分 | 対象 | 備考 |
| --- | --- | --- |
| 現役 | `AutoUpdateAutomationV1.js` `AutoUpdateRequest.js` `AutoUpdateNotification.js` `PlaylistAuto*.js`(Write / Spotify / Episodes / Rules / Lifecycle 系)`PlaylistSpecial.js` `ThemeV3SingleSheet.js` `PlaylistAutoThemeReview.js` `Spotify*.js` `Post*.js` `Podcast*.js` `Sheet*.js` `Api*.js` `HttpFetch.js` `コード.js`(doPost / doGet) | 投稿フォーム、日次・毎時の巡回、テーマ型、ポッドキャスト連携 |
| 現役(新方式) | `P25Ownership.js` `P25LibraryPipeline.js` `P25SpotifyTarget.js` `P25ProdIo.js` | 蔵起点の更新。所有者が P25 のプレイリストだけ動く |
| 新方式に置換予定 | 旧方式の増分巡回(`syncRecentManagedAutoPlaylistV1_` ほか)と初回補完(`syncNextAutoUpdateBootstrapV1_`) | P25 に切り替えたプレイリストでは自動で停止。COPY 実機試験が済むまで残す |
| 未使用候補 | `*Tests.js`(GAS エディタ用の手動テスト 10 本前後)、`Test.js`、`PlaylistAutoDryRun*.js`、`PlaylistAutoV2DryRunEngine.js`、`PlaylistAutoWorkflowDryRun.js`、`P25CopySession20261107.js` | 他のコードから参照なし。ただしエディタからの手動実行に使われている可能性があるため削除せず、管理者の承認待ち |
| 削除禁止・保護対象 | `P25CopyAdapter.js` `P25CopyOwnership.js`(COPY 試験用。差分に触れない)、`PlaylistAutoOtaRebuild.js` `PlaylistAutoPolirebiAudit.js`(手動の再構築・削除ツール。P25 担当なら拒否)、`captureAutoUpdateBoundariesV1_`(旧方式へ戻すときの境界更新)、`assertAutoPlaylistLifecycleTransition_`(安全確認)、`appsscript.json` | 復旧経路・安全装置 |

### 今回削除したコード(参照が 0 件で、`_` 付きの非公開関数のみ)
- `nextAutoUpdateDailyWindowStartMsV1_`(`AutoUpdateAutomationV1.js`)
- `getThemeReviewSheetForRuleV1_`(`PlaylistAutoThemeReview.js`)
- `getThemeV3ConfirmedAt_`(`ThemeV3SingleSheet.js`)

### 参照 0 件だが残したもの(削除候補。承認後に整理)
`buildAutoPlaylistIncrementalPlan_`、`prepareThemeReviewSheetsV1_`、`planThemeSpotifyRemovalV1_`、
`previewThemeV3SpotifyPlan_`、`getThemeV3SheetNameByPlaylistId_` ほか。
大きめのテーマ型の管理ツールで、本番での手動利用の有無が確認できないため残しています。

## 2. トリガー(コードから確認できる範囲。本番の登録状況は未確認)

| 区分 | ハンドラー | 備考 |
| --- | --- | --- |
| 現役 | `runAutoUpdateAutomationV1`(日次4時)、`runAutoUpdateBackfillHourlyV1`(毎時)、`runAutoUpdateAutomationSoonV1`(1回限り) | 3つとも P25 を呼ぶ。P25 担当が 0 件なら即終了 |
| 現役 | `syncToyohidePlaylist` `syncIsshoShinbunPlaylist` `syncKinoDougaPlaylist` | P25 担当になると旧処理は読み飛ばす |
| 現役 | `runThemeReviewAutomation`(毎朝5時) | テーマ型。書き込み口はガード済み |
| 現役 | `syncListenerPodcastPlatforms` | ポッドキャスト連携。プレイリストへの追加には関与しない(コード上の確認は未了)|
| 保護対象 | 緊急停止・所有者切替は管理者の手動関数のみ。トリガー化しない | |

## 3. スプレッドシートのタブ(コード上の名前。実データは変更しない)

| 区分 | タブ | 備考 |
| --- | --- | --- |
| 現役 | 「自動更新申請」 | 既存フォーム。P25 の依頼元としても使う |
| 現役 | 「エピソード台帳」(A〜AM列) | 蔵の本体。AM列「人間除外」を P25 が読む |
| 現役 | 「削除・除外履歴」 | P25 が読む(GUID / EP-ID)。ない場合は停止 |
| 現役 | 「投稿受付」「サイト公開用」「作業台」「朝リスPodcast」「おすすめPodcast」、テーマ型の「中南米」「北欧」 | 投稿・公開・テーマ型 |
| 新方式に置換予定 | 旧方式の実行ログ・境界はスクリプトプロパティ側(タブではない) | |
| 未使用候補 | `P25_STATE`(COPY 試験専用のタブ) | 本番の P25 は状態をスクリプトプロパティに置く。COPY 試験後に整理 |
| 削除禁止・保護対象 | 上記の現役タブすべて | 削除候補はなし |

## 4. 新方式が動くまで残す旧方式の復旧経路
- P25 → PAUSED → LEGACY の戻し手順(`P25_SET_OWNER`、旧境界の更新確認つき)
- 旧処理のコードと、旧処理の実行ログ・境界
- テーマ型の手動ツール
