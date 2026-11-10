# 開発資源台帳（resource-inventory）

作成: 2026-11-10 / 指示: 第33号 / 作成者: Claude（開発実行役）
目的: 「どのシートか」「どのAPIか」「Claudeから見えるか」で迷わないための共通の接続索引。

**この文書に書かないもの**: APIキー、トークン、パスワード、リフレッシュトークン、台帳本文。書くのはIDとサービス名と役割だけ。
**確認の種類**: `[実機]` = 2026-11-10にDriveコネクタでメタデータを実際に取得 / `[コード]` = GitHub上のコード・文書にその記述がある（実機は未確認） / `未確認` = 根拠なし。推測はしない。
走査方法: `scripts/ops/scan-resources.mjs`（読み取り専用。値は読まず、ID・関数名・キー名だけ抽出）。対象は11ブランチ。再実行: `node scripts/ops/scan-resources.mjs REF [REF...]`。

## 1. Google スプレッドシート

| ラベル | 名称（Drive上の実名） | ID先頭 | 役割 | 確認 |
|---|---|---|---|---|
| **PROD** | 朝ポキの田｜正式エピソード台帳【本番】 | `1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4` | 唯一の本番台帳（シート「エピソード台帳」55列、約6.7千行）。公開JSONの元。14MB、最終更新 2026-11-10 09:21Z | [実機] |
| PROD周辺 | 朝ポキ　プレイリスト一覧表（作業台） | `1KSzoIkOsjUagNBLt3IbKIvgWEmez4f0XISQ-jkUjmwQ` | 旧来のプレイリスト作業台。投稿受付GAS・Apple補強GAS・アプリ(community.tsx)が参照。11/09更新 | [実機] |
| 外部原本 | 朝ポキ出演者 共同編集用 スプレッドシート | `1CvRyWLQb7YyonGyRSNKtc_liRrgtiWE5yDGI3R48Xfk` | 所有者は別アカウント(onsanai.com)。当方は共有で閲覧。11/10更新。出演者共同編集。**コード側の参照は未確認** | [実機] |
| COPY | 朝リスの田 Phase14 コピー検証 20261023 | `1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY` | 収蔵ロボのCOPY。朝トリガー設置報告あり。11/09更新 | [実機] |
| COPY | 朝リス Phase25 COPY試験 2026-11-07（本番接続禁止） | `1lbfEq3Tdj6QaLGJOWZfez-xNkQ5yRHRILqmP1nLJtQw` | P26 COPY GAS用の小型試験シート（62KB） | [実機] |
| COPY(検証済・終了) | Phase12 新着1件検証専用コピー | `1EFY00C1IyZfIW6LdCAiK0MTXpVGRIQvoc4aLzRnUruI` | EP-06592の1件書込検証。役目終了 | [実機] |
| COPY(検証済・終了) | Phase12 G5 1件受入専用コピー | `190KQDxD7LCl-apSVU59etgMvSEzMCjf2-3fuV0m38L0` | G5受入検証。役目終了 | [実機] |
| COPY(検証済・終了) | Phase6 V3 Append検証専用・原本同一・書込前 | `19Dv6cgM33NYbrMGLofuVvxM4-WHiuPqxmivZUuwoBqc` | `LibraryPhase8ReadOnlyStatus.js` が比較に使用 | [実機] |
| BACKUP | Phase11本番更新直前_BACKUP_20261021 | `19rxdyHUi3jAV6JCDFJNlm9nW7rcFdGQ6_3DDTJTgnkM` | 9.3MB。復旧用。変更禁止 | [実機] |
| BACKUP | Phase9本番更新直前_BACKUP_20261021 | `1M25qQT4y5iKWOGHvQZObz3Vrx4oqw-IguwvfOjXxT0k` | 9.8MB。復旧用 | [実機] |
| BACKUP | V3段階B開始前バックアップ 2026-10-17 | `1CPHnvQd9JAYLACZqeSOJAy6IQ5ZLMbd8-FU6G6ugvaI` | 8.2MB。`LibraryV3Morning.js` が参照 | [実機] |
| 旧COPY | 朝ポキ出演者 共同編集用 のコピー1007 | `1lJF11Xpx9cz9RLuuJsvl0zV9E5Fpg7I7XreB2R6wS7o` | 10/07に取り込んだ出演者データのコピー。`Import1007*.js` が参照。取込完了済み(文書あり) | [実機] |
| 入力Form | （Google Form） | `1FAIpQLSff1cc9SvJFtzbk3btowdGocatM2zEZgj-Drn1e8OKFd7Vezw` | プレイリスト投稿フォーム。app/community.tsx | [コード] |

数: シート12 + Form1。うち実機確認12、コード記述のみ1（Form）。

## 2. GAS（Apps Script）プロジェクト

| ラベル | 名称 | scriptId | 役割 | 確認 |
|---|---|---|---|---|
| PROD | （本番GAS） | `1Ywoelv_gnS6oJQz7CDbAn6PZaS4l2lty-XmhHJUdk9-K5PmvwAE79JJV` | 本番台帳側のGAS（command-center引継ぎ文書の記載）。Driveのメタデータ検索では**見つからず**（スタンドアロン/別所有の可能性）。トリガー実状態は未確認 | [コード]のみ |
| PROD | 朝リスの輪 投稿受付 | `1HpZNp96TQ7S1ilmfyItKI2IxYgdk8ufCsWXSVNEaGkh7_uQRXkr6k1I9` | 投稿受付Webアプリ（デプロイID先頭 `AKfycbxlZCNq…` を公開ページが使用） | [コード] |
| 隔離検証 | 朝リスの田_Phase2_隔離検証 | `1eLqB-k1XIQz5qqOxamvUlinqld7jwSDO6AkWLx9Zg0ePGsuU7pE4rec-` | 公開サービス本番ではないが**実台帳に接続**（文書に明記）。⚠ 名前が隔離でも台帳に触れる | [コード] |
| COPY | 朝リスの田_Phase14_COPY_20261023 | `1roni6h_C9vKxtP_2I6jGgXKE2KJ1yRRhE3ZD1JsZ6XXRnT5RcndqyfJo` | Phase14 COPYシート用GAS。Drive上は10/28更新まで | [実機] |
| COPY | P26 COPY GAS | `16qdHt_nojvKK4Qzcww4C7jkg6frpLiYIHXn4CG-_UtILn4qKlmoixT9R` | P25/P26 COPY試験。コード内で自分のscriptId一致とCOPYシートIDしか開かない設計 | [コード] |

数: GAS 5。うちDrive実機確認1、コード記述4。公開デプロイID（`AKfycb…`）は2種を検出（先頭12文字のみ記録）。

## 3. トリガー（コードで定義されているもの）

⚠ これは「コードにある」だけで、**実際にどのGASに設置され動いているかは未確認**。実状態はApps Scriptの「トリガー」画面でしか確認できない。既存トリガーは変更しない。

| ファイル | 関数 | 周期 |
|---|---|---|
| Import1007SafeBatch.js | tickImport1007Auto | 5分毎 |
| LibraryV2FastAutomation.js | LIB_V2_FAST_HANDLER | 5分毎 |
| LibraryV2UnifiedFastAutomation.js | scheduledLibraryV2UnifiedFast | 5分毎 |
| LibraryV3.js | scheduledLibraryV3 | 10分毎 |
| LibraryV3Morning.js | scheduledLibraryV3Morning / continueLibraryV3Morning | 毎日6時台 / 5分後継続 |
| LibraryMetadataBackfillV1.js | （fn） | 1時間毎 / 60秒後 |
| LibraryOfficialRssEngine.gs | scheduledLibraryOfficialNew / Backfill / 日次 | 1時間毎 / 2時間毎 / 毎日(15分頃) |
| LibraryOfficialNative.gs | scheduledLibraryOfficialNativeNew | 1〜2時間毎 |
| AutoUpdateAutomationV1.js | 即時/日次/バックフィル | 周期は設定値依存 |
| PlaylistAutoThemeReview.js | THEME_REVIEW_AUTOMATION_HANDLER_ | 設定値依存 |

GitHub Actions（これは実在・コードで確認）: `sync-playlists.yml` が 毎時17分・47分（cron `17,47 * * * *`）に公開スプレッドシート（プレイリスト）を読んでPagesを更新。他に `pages.yml`, `pages-pr-check.yml`, `library-public-check.yml`。

COPY側: Phase14 COPYシートに朝2トリガー（約05:15/06:15 JST）設置との報告あり（10/27文書）。実行ログ確認は文書上「未済」。

## 4. 外部API・外部サービス（鍵の値は一切記録しない）

| サービス | 目的 | 必要な権限 | 秘密の保管場所(種類) | 状態 |
|---|---|---|---|---|
| Spotify Web API（api.spotify.com / accounts.spotify.com） | エピソード・プレイリスト情報取得、OAuth | クライアント認証＋ユーザー認可(refresh) | GASのスクリプトプロパティ | コード有。実運用は未確認 |
| Apple（itunes.apple.com 検索API / podcasts.apple.com 公開ページ） | Apple Podcasts URL・補強 | 鍵不要（公開API） | なし | コード有（Phase22 probe） |
| 公式RSS（Omny: api.omny.fm / omnycontent / traffic.omny.fm、Megaphone: feeds.megaphone.fm、pdst.fm） | 公式配信データ取得 | 鍵不要 | なし | 収蔵ロボが使用(報告) |
| LISTEN（rss.listen.style） | LISTEN URL | 鍵不要 | なし | PodcastPlatformSync.js |
| Pocket Casts（pocketcasts.com） | Pocket Casts URL | 鍵不要 | なし | 同上 |
| Podcast Index（podcastindex.org） | 補助照合 | 未確認（鍵の有無不明） | 未確認 | LibraryV2/V3内に参照 |
| Google Sheets API（sheets.googleapis.com） | 台帳読書き | GAS実行者のOAuth | Googleアカウント | RssEngine内 |
| Cloudflare Worker（worker/index.ts, drizzle/） | 画像変換・静的配信・DB(drizzle) | Cloudflareアカウント | Cloudflare側 | コード有。デプロイ状態は未確認 |
| GitHub Pages / Actions | 公開サイト | リポジトリ権限 | GitHub | 実在 |

Apple Podcasts / Amazon Music / Pody / YouTube はURLを台帳列(M, AO, AQ, AR)に持つ。URLの充足率は台帳側の計測が必要（**未計測**）。

## 5. スクリプトプロパティの「キー名」（値は不記録・約40個）

- Spotify系: SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET / SPOTIFY_OAUTH_STATE / SPOTIFY_USER_REFRESH_TOKEN / P25_COPY_SPOTIFY_ACCESS_TOKEN（**秘密**。GAS外に出さない）
- 自動化の状態: LIB_V2_*（UNIFIED_ENABLED, CHECKPOINT_V1, LEASE, FAILURES）、LIB_V3_*（CONFIG, BASELINE, LAST_ID, FAILURES, AUTO, CURSOR, MORNING_*）、LIB_OFFICIAL_*（CONFIG, CHECKPOINT, *_REPORT, NEW_LAST_SUCCESS, NATIVE_*）、I1007_AUTO(_FAILURES)
- 承認ゲート: P26_APPROVAL, RECOMMENDATION_WRITE_APPROVED, RECOMMENDATION_WRITER_AUDIT_APPROVED
- Phase15/16: P15_INGEST_SINCE, P15_TICK_UNTIL, P16_LAST_COMPLETE_SCAN_UTC, P16_ENABLE_MEDIA, P16_LAST_RUN, P16_LAST_LOG_ERROR

## 6. 台帳の主な列（本番「エピソード台帳」）

A=EP-ID / V=概要原文 / W=概要清掃済み / X=出演者・スタッフ / J=公式個別URL / K=LISTEN / L=Spotify / M=Apple / AO=Amazon / AP=Pocket Casts / AQ=Pody / AR=YouTube / AS=番組RSS / AT〜AX=出演者1〜5 / AY=出演者確認根拠。

## 7. データの流れ（誰が読み、どこへ書くか）

1. 公式RSS・Spotify等 → （収蔵ロボ/GAS）→ **COPY** で検証 → 承認後のみ **PROD台帳**
2. PROD台帳 → （GitHubでJSON生成）→ `public/library/data` → 朝リスの田サイト(Pages) ／ 宇宙 (`asarisu-universe`, 読み取りのみ)
3. 作業台（プレイリスト）→ sync-playlists（毎時17/47分）→ Pages
4. 共同編集用シート（外部所有）→ 出演者データ。取り込みは過去に1007コピーで完了済み。現在の同期経路は**未確認**

## 8. Claudeから台帳は読めるか（2026-11-10 実測）

- URLだけでは読めない（URLは権限を与えない。公開共有は不要・推奨しない）。
- Driveコネクタ（管理人さんのGoogleアカウントに接続）では、**本番台帳のメタデータ（名前・更新日時・サイズ）は取得できた**。つまり権限上は見える。
- ただし内容の取得は「ファイル全体をそのまま会話に返す」形で、14MBの台帳は実用にならない。**範囲指定（A609:D809のような）で読む手段が当方にはない**。
- 推奨ルート（公開せず、管理人の手作業不要）:
  1. 司令塔(ChatGPT)のSheetsコネクタが範囲読みできる（既に実証）。台帳の確認はそちらで、結果の数値だけGitHub(Issue #283)に記録する。
  2. 当方にも範囲読みさせたい場合は、特定アカウント1つに「閲覧者」権限、または読み取り専用のGoogle OAuthコネクタ（Sheets API）を接続。**公開リンク共有はしない**。
  3. 台帳本文は公開リポジトリに置かない。

## 9. 検出した問題・要注意（提案のみ。本番は変更しない）

| # | 内容 | 重大度 | 提案 |
|---|---|---|---|
| 1 | `tests/copy-gas-bundle.test.mjs` の `PROD_SHEET` が `1lgLzgDNk…`（本番IDは `1lLgLzgDNk…`。文字の並びが違う誤記） | 低。テストの定数で本番に触れない。ただし「本番IDを開かないこと」を検証する意図なら無効 | 定数を正しい本番IDに修正し、バンドルに本番IDが含まれないことを検査（別Draft PRで） |
| 2 | Phase2「隔離検証」GASが実台帳に接続 | 中。名前が「隔離」でも本番台帳に触れうる | 管理人の承認なしに触らない。実際のトリガー有無をApps Script画面で確認する |
| 3 | 旧Phaseの `P26Entry.gs` は COPY ID を埋め込み。本番IDを開かない設計（scriptId照合） | 情報 | 現状維持 |
| 4 | 本番GAS(`1Ywoelv…`)はDrive検索で見つからない | 中。権限/所有が別の可能性 | 未確認として管理人確認項目へ |
| 5 | COPYと本番のタイトルが似ている（Phase14コピー検証 と 本番） | 中 | 下記の更新ルール(ラベル必須)で運用 |
| 6 | 外部所有の共同編集シートが毎日更新されているが、コードとの接続が不明 | 中 | 取り込み経路の確認（司令塔） |

## 10. 更新ルール

1. シート/GAS/APIを追加・変更したら、同じPRでこの文書を更新する。
2. 行には必ず **PROD / COPY / BACKUP / 検証済終了 / 旧** のラベルを付ける。ラベルなしの追加は不可。
3. IDを書くときは名称と一緒に書く。名称がPRODでないIDを「本番」と書かない。
4. 秘密（鍵・トークン・パスワード・refresh token）は書かない。キー名と保管場所の種類だけ。
5. 実機で確認していないことは `[コード]` または `未確認` と明記し、推測で埋めない。
6. 台帳本文（概要・出演者の中身）をこの文書やリポジトリに貼らない。
7. 再走査: `node scripts/ops/scan-resources.mjs` で新しいIDが出たら、この表に未登録のものを追加する。

## 11. 未確認一覧

1. 本番GAS(`1Ywoelv…`)・投稿受付GAS・Phase2隔離GASの実トリガー設置状況と最終実行
2. COPYの朝2トリガーの実行ログ
3. 本番GASの所有者・共有設定
4. 共同編集用シート(外部所有)から現在の台帳への同期経路
5. Podcast Index・Cloudflare Worker/DBの実運用状態（鍵・デプロイ）
6. Amazon/Pody/LISTENの過去の個別EP取得実装の有無（Spotify 97.6%・Pocket Casts 97.3%・Apple 11.2%・LISTEN 0.5%は2026-11-10に実測済み）
7. 本番台帳の最新件数（10/26時点の6,632件以降）

## 11b. Apple個別EP URLの過去成果と所在（第38号・2026-11-10 実測）

本番Apple(M列)の751〜752件は、**Phase21（2026-11-04）の本番書込**で入ったもの。別のテストシートに保存された「過去URL一覧」は存在しない。

| 項目 | 実測・出典 |
|---|---|
| 書込の仕組み | iTunes Lookup（番組ID→`entity=podcastEpisode&limit=200`）→`episodeGuid`＝台帳GUIDで厳格一致→M空欄のみ書込。累計717件（33+20+100×6+64）、`skipped=0`。Issue #265 コメント6622963231〜6623325915 |
| 結果の保存先 | 本番台帳M列そのもの＋Issue #265のログ。COPYには未保存（Phase14 COPYのM列は2件のみ、本番と同値） |
| 200件の壁 | Lookupは最新200件で打切り。offset/limit300は無効（Issue #265 6648943747） |
| 公開HTML | `P22ApplePublicPageProbe20261105.gs`：3番組で15〜16件の`?i=`ID＝最近分のみ。古い回の新規発見0 |
| Search API（突破済み） | `P22AppleSearchOldEpisodeProbe20261105.gs`：現場の2022/23/24各1件を`term=タイトル`で検索→**3/3 episodeGuid完全一致・同一collectionId・trackViewUrl取得**（6649481234）。大量取得率は**未測定** |
| 未実施 | 層化30〜50件の測定（発見率・429・誤照合）。Geminiリゾルバ案(V1〜V6)は本番未導入・司令塔監査で未受入（#271） |
| 過去3件のURL | EP-02052→`i=1000568160883` / EP-02530→`i=1000618788571` / EP-02968→`i=1000660649003`（いずれもM空欄。台帳J列のitemidとGUIDが一致） |
| 実装パス | `scripts/google-apps-script/PodcastApple.js`・`PodcastResolve.js`（番組メタ補完。エピソードURLは返さない）、`scripts/google-apps-script-risu-apple-enrichment.gs`（おすすめPodcast＝番組単位・別シート）、`P22*Probe*.gs`（ブランチ `fix/p15-lite-recovery-20261103` のみ） |
| 空欄（7番組の合計） | M空欄4,708件。うちJ列にitemid(=GUID)あり4,670件、G列GUIDあり543件。現場2,627／MEDIA TALK 1,727／学校305／報談26／ドーナツ6／スポンジ4／こども13 |
| 番組が違うもの | SDGs・アルキキ・AJW・朝ポキTVはAppleの番組IDが台帳に無い（番組レベルの探索から必要） |

## 12. 件数サマリ

- スプレッドシート12（実機確認12）＋Form1（コード記述）
- GASプロジェクト5（実機1、コード記述4）
- コード定義トリガー 16件、実設置の確認 0件
- 外部サービス 9種、スクリプトプロパティのキー名 約40
- 検出した問題 6件（うち誤記1）
