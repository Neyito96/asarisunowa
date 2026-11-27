# 引っ越し準備：GAS（Apps Script）の軽量化の棚卸し（2026-11-26・読むだけの調査）

目的: 専用 Google アカウントへ引っ越すときに、**いま本当に動いているコードだけ**を持っていけるようにする（#493）。
この文書は調査結果と段取りの案。**本番のコード・トリガー・シートには何も手を入れていない。**
秘密の値は書かない。ID は先頭だけ。

## 1. まず全体像：Apps Script は 14 個、毎日動いているのは 6 個

管理人のドライブの一覧（2026-11-26・Drive）と、**本番の時計の一覧**（2026-11-27・マイトリガー画面で確認。全16本）より。

| プロジェクト | ID（先頭） | 時計（関数） | 役目 | 引っ越し |
|---|---|---|---|---|
| 朝リスの輪 プレイリスト投稿受付（本番） | 1HpZNp… | runAutoUpdateAutomationV1・runAutoUpdateBackfillHourlyV1・syncKinoDougaPlaylist・syncIsshoShinbunPlaylist（エラー率 約17%）・syncToyohidePlaylist・syncListenerPodcastPlatforms | 投稿受付（Webアプリ）・自動更新・テーマ別・蔵プレイリスト | **持っていく（軽量化して）** |
| 朝リスの輪 GAS配達係 | 1jVW5I… | deliveryHourly・K_定時起動 ×3 | 自動配達、新着取り込みの起動係 | 持っていく |
| 概要欄清掃ロボ（COPY/V2作業用） | 1C3kV3… | P28_TICK | 配信先URLの巡回。**中の「RX」Webアプリが毎朝の台帳→蔵の同期の読み出し口** | 持っていく（RX の URL を変えないこと） |
| 朝ポキ｜本番ロボGAS | 1Ywoel… | P18_TICK・P19_TICK | 毎朝の新着取り込み | 持っていく。**シートに付いている型。コードの控えが GitHub に無い** |
| V2収蔵ボット COPY試験 | 1qVI_… | P25V2_D1_日次実行 | V2 台帳への日次の収蔵（名前は「試験」だが毎日動いている） | **持っていく** |
| 朝リスの田_Phase14_COPY_20261023 | 1roni6… | phase14CopyMorningRunnerV19 ×2（エラー率 17%・67%） | 10月の旧試験 | 持っていかない。**時計は 2026-11-27 に停止** |
| ほか 8 個（Phase25 COPY / Phase15 Lite / Phase2 隔離検証＋BACKUP 2 / 独立図書館 調査用 / SDGs概要補充 / ネジロボ・テスト / BACKUP 2026-11-18） | — | なし | 過去の試験・控え | 持っていかない（消さない） |

## 2. 本番「投稿受付」の中身：118 ファイル → 動いているのは 66

GitHub の控え（scripts/google-apps-script/）と本番の実物を照合した: **115 ファイル中 114 が一致**。
本番だけにあるのは `SdgsArchiveMap.js`（#395 の一回きりの読み取り専用。下の「棚上げ」行き）。

入口（Webアプリの doGet/doPost、シート編集の onEdit、**本番の実際の時計 6 本**、コードが必要なときに作る1回きりの時計）から呼び出しをたどると:

- **使っている: 66 ファイル・約 14,700 行**（残す）
- **どこからも呼ばれていない: 47 ファイル・約 7,300 行**（＋本番だけの1ファイル）

調べ直すとき: `node scripts/gas-reach.mjs`（名前が1回でも出れば「使う」とみなす。残しすぎることはあっても、消しすぎることはない）。

### 呼ばれていない 47 ファイルの仕分け

**A. 棚上げしてよい：試験用（GAS の中で手で押すテスト）— 11**
AutoUpdateImmediateV1, AutoUpdateRequestTests, PlaylistAutoLifecycleTransitionTests, PlaylistAutoNewRuleTests, PlaylistAutoPageMatchingTests, PlaylistAutoRuleValidationTests, PlaylistAutoSafetyTests ※, PlaylistAutoScopedStateStoreTests, PlaylistAutoScopedStateTests, PlaylistAutoV2DryRunEngineTests, PlaylistAutoWorkflowDryRun
（※ PlaylistAutoSafetyTests は GitHub 側のテスト tests/gas-theme-approval.test.mjs が読むので、置き場所を変えるときはテストも直す）

**B. 棚上げしてよい：一回きりの診断・復旧・立ち上げ（終わった作業）— 31**
- 寺下・楽ゆら・まなび場・キノドウガ: AutoUpdateTerashitaReadOnlyDiagnostic, RakuyuraBackfill, diagnoseRakuyuraReadOnly, ManabibaReadOnlyDiagnostic, RunKinodoNow
- 太田さん・ノーミライ・佐藤陽の立ち上げ: PlaylistAutoDryRunOtaAuditV5, PlaylistAutoDryRunOtaSafeMatch, PlaylistAutoOtaRebuild, PlaylistAutoSpeakerOtaComparison, PlaylistAutoNoMiraiLaunch, P266NoMiraiSpecialOnce, PlaylistAutoSatoYoFinalize, PlaylistAutoSatoYoSiteAudit, PlaylistAutoDryRunTargets, PlaylistAutoIncrementalDryRun, PlaylistAutoBootstrapPlan, PlaylistAutoLifecycleTransitions
- 出演者ルールの試作: PlaylistAutoSpeakerCanary, PlaylistAutoSpeakerSafeV2, AutoUpdateSpeakerFastLaneV1, AutoUpdateSpeakerRecoveryV1
- 最終更新日の照合・復旧: AutoUpdateLatestDateReconcile, AutoUpdateLatestDateLight, AutoUpdateLatestDateBaselineApproval, AutoUpdateRecoveryPatchV1, AutoUpdateUrgentRepairV1, PlaylistDateAudit
- Phase24 の試作: P24ConnectionCheck, P24LibraryPlaylistProposals20261105, P24NewPostPreview20261106, P24PolirebiMembershipReadOnly20261105

**C. 時計の一覧で決まったもの（2026-11-27）**
| ファイル | 結果 |
|---|---|
| PlaylistSpecial.js | **使っている**（時計 syncToyohidePlaylist ほか）。本番側に残す |
| PlaylistAutoV2Production.js（syncNoMiraiAutoPlaylistV2） | 時計なし → 棚へ（ノーミライは固定ルールで毎日更新中） |
| ThemeRuntimeV2.js（runSubmittedThemesV2） | 時計なし → 棚へ（テーマ別は LibraryTheme が担当） |
| PlaylistAutoSatoYoTriggers.js / PlaylistAutoSatoYoSync.js | 時計なし → 棚へ（佐藤陽は固定ルールで更新中） |
| AutoUpdateRecovery.js | 復旧用の道具として本番側に残す（テストあり） |

### 実施（2026-11-27）
46 ファイルを `scripts/google-apps-script-shelf/` へ移した（消していない）。本番側の控えは **67 ファイル**に。
配達係は本番だけにあるファイルを残すので、**この時点で本番の中身は変わらない**。

### 軽量版を作った（2026-11-27・管理人承認）
`gas/lite/`: 本番の控え 67 ファイル → **9 ファイル（約 11,000 行）**。使っていない宣言を外して役目ごとに並べ直しただけで、関数の中身は変えていない（テストで確認）。
詳しくは [gas/lite/README.md](../../gas/lite/README.md)。引っ越し先の新しいプロジェクトに入れる用で、今の本番には入れない。

## 3. 引っ越しの段取り（案）

1. ~~トリガー一覧を見る~~ **済**（2026-11-27）
2. ~~GitHub の中で棚上げ~~ **済**（46 ファイル。本番は変わらない）
   - **Phase14 COPY の時計 2 本を停止（2026-11-27・管理人承認）**。戻すときは phase14CopyMorningRunnerV19 を「日付ベース・午前5〜6時」と「午前6〜7時」で作り直す
3. **本ロボのコードを GitHub に控える**: 本番ロボGAS は控えが無い。シートに付いている型なので、シートの持ち主を移せば一緒に移るが、控えが無いと直せる人が限られる
4. **引っ越し当日**: 投稿受付は持ち主を移す（Webアプリの URL を変えないため）。そのあと中身を `gas/lite/` の 9 ファイルに入れ替える
   （配達係に「入れ替え」の作りを足すか、エディタで入れ替える。**どちらも管理人の承認後**）
5. 終わったら `node scripts/gas-prod-compare.mjs` で「GitHub と本番が一致」を確かめる

## 4. コード以外で、軽くできそうなもの（メモ・作業はしない）
- `public/` に試作ページ（omikuji-*.html など 13 個）が公開されたまま残っている
- `scripts/` 直下の古い .gs（playlist-submit・risu-apple-enrichment など）と `google-apps-script-not-in-prod/`
- これらも「使っていない」なら棚上げ候補。サイトの見た目には影響しない
