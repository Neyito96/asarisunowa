# 引っ越し準備：GAS（Apps Script）の軽量化の棚卸し（2026-11-26・読むだけの調査）

目的: 専用 Google アカウントへ引っ越すときに、**いま本当に動いているコードだけ**を持っていけるようにする（#493）。
この文書は調査結果と段取りの案。**本番のコード・トリガー・シートには何も手を入れていない。**
秘密の値は書かない。ID は先頭だけ。

## 1. まず全体像：Apps Script のプロジェクトは 14 個ある

管理人のドライブにある Apps Script を一覧にした（2026-11-26・Drive で確認）。動いているのは 4〜5 個だけ。

| 区分 | プロジェクト | ID（先頭） | 役目 | 引っ越し |
|---|---|---|---|---|
| **毎日動く** | 朝リスの輪 プレイリスト投稿受付（本番） | 1HpZNp… | 投稿受付（Webアプリ）・自動更新・テーマ別・蔵プレイリスト | **持っていく（軽量化して）** |
| **毎日動く** | 朝リスの輪 GAS配達係 | 1jVW5I… | GitHub → 本番の自動配達、新着取り込みの起動係（Kicker） | 持っていく |
| **毎日動く** | 概要欄清掃ロボ（COPY/V2作業用） | 1C3kV3… | 清掃・監査。**中の「RX」Webアプリが、毎朝の台帳→蔵の同期（library-v2-sync）の読み出し口**になっている | 持っていく（RX の URL を変えないこと） |
| **毎日動く** | 朝ポキ｜本番ロボGAS | 1Ywoel… | 毎朝の新着取り込み | 持っていく。**シートに付いている型（Drive の一覧に出ない）。コードの控えが GitHub に無い**（追加ファイル P26 だけ） |
| 要確認 | V2収蔵ボット COPY試験 | 1qVI_… | 収蔵の試験（日次トリガーの手順あり） | トリガーがあるか見て決める |
| 終わったもの | 朝リス Phase25 COPY / 田 Phase14 COPY / Phase15 Lite / Phase2 隔離検証（＋BACKUP 2つ）/ 独立図書館 調査用 / SDGs概要補充 / ネジロボ・テスト / BACKUP 2026-11-18 投稿受付 | — | 過去の試験・控え | **持っていかない**（旧アカウントに置いたまま。消さない） |

## 2. 本番「投稿受付」の中身：118 ファイル → 動いているのは 66

GitHub の控え（scripts/google-apps-script/）と本番の実物を照合した: **115 ファイル中 114 が一致**。
本番だけにあるのは `SdgsArchiveMap.js`（#395 の一回きりの読み取り専用。下の「棚上げ」行き）。

入口（Webアプリの doGet/doPost、シート編集の onEdit、コードが設置するトリガー: 自動更新 V1 の3本・テーマ確認・佐藤陽）から呼び出しをたどると:

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

**C. 本番のトリガー一覧を見てから決める — 5**
| ファイル | 気になる点 |
|---|---|
| PlaylistSpecial.js | `syncToyohidePlaylist` などの古い入口。README に「既存トリガーが関数名を使っているかも」とある |
| PlaylistAutoV2Production.js | `syncNoMiraiAutoPlaylistV2` が時計で動いているかもしれない |
| ThemeRuntimeV2.js | `runSubmittedThemesV2` が時計で動いているかもしれない |
| PlaylistAutoSatoYoTriggers.js | 佐藤陽の時計を設置する関数（時計そのものは残す側で動いている） |
| AutoUpdateRecovery.js | 11/19 の復旧用の手押し関数。GitHub 側のテスト tests/auto-update-recovery.test.mjs あり。道具として残すか決める |

→ 本番の「トリガー」画面（時計のマーク）の一覧が分かれば、C も確定できる。

## 3. 引っ越しの段取り（案）

1. **トリガー一覧をもらう**（管理人: 4 つの毎日動くプロジェクトの「トリガー」画面のスクショ）。これで C が決まる
2. **GitHub の中で棚上げ**: A・B（と C で不要と決まったもの）を `scripts/google-apps-script-shelf/` へ移す。
   - 配達係は「本番だけにあるファイルは残す」作りなので、**この時点では本番は何も変わらない**（安全）
3. **本ロボのコードを GitHub に控える**: 本番ロボGAS は控えが無い。シートに付いている型なので、シートの持ち主を移せば一緒に移るが、控えが無いと直せる人が限られる
4. **引っ越し当日**: 投稿受付は持ち主を移す（Webアプリの URL を変えないため）。そのあと本番から棚上げ分を消す
   （配達係に「消してよいファイルの一覧」を渡す作りを足すか、エディタで消す。**どちらも管理人の承認後**）
5. 終わったら `node scripts/gas-prod-compare.mjs` で「GitHub と本番が一致」を確かめる

## 4. コード以外で、軽くできそうなもの（メモ・作業はしない）
- `public/` に試作ページ（omikuji-*.html など 13 個）が公開されたまま残っている
- `scripts/` 直下の古い .gs（playlist-submit・risu-apple-enrichment など）と `google-apps-script-not-in-prod/`
- これらも「使っていない」なら棚上げ候補。サイトの見た目には影響しない
