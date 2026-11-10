# Spotify巡回の設定駆動化(第19号): 設定表＋共通エンジン＋単一writer

**状態: コード・モック・READ_ONLYのみ。COPY GAS新規コード・COPY Sheet追記・トリガー操作・Spotify実書込・本番・main・公開サイトは未実施(管理人の一括承認まで実行禁止)。**
最重要の合格条件「新しいプレイリストは設定1行で対応」: `docs/release/2026-11-10-playlist-engine-e2e.json` の `addOneRow` で、設定表に1行足すだけ(コード変更0・新規トリガー0・エラー0)で有効な規則になることを確認(モック)。

## 1. 構成(最小)
| 部品 | 実体 | 役割 |
|---|---|---|
| 設定表 | Sheetの1タブ(1行=1プレイリスト)。列: key/有効/プレイリストID/名称/方式/対象番組/キーワード/除外キーワード/照合範囲/照合モード/特別照合/承認状態/段階/実行モード(DRY_RUN\|LIVE)/writer(legacy\|engine)/1回の追加上限/レビュー済のみ。初期行は旧9規則から自動生成(`docs/release/2026-11-10-playlist-config-initial.csv`、全行 `DRY_RUN`・`writer=legacy`) | プレイリストID・対象番組・照合ルール・承認状態・有効フラグ |
| 共通エンジン | `public/library/playlist-engine.mjs`(+`playlist-config.mjs`)。純粋ロジック、IOは注入 | キュー集約→差分判定→追加計画→(許可時のみ)単一writerで追加 |
| 単一writer | 既存 `journal-lease.mjs`(#290のfencing token・COMMIT・runId一意)をそのまま使用 | 同時に1実行だけがSpotifyへ書く |
入口は共通日次巡回1本(既存・4時台)。毎時の初回補完は同じエンジンの`bootstrap`段階として整理(統合先、§5)。**プレイリストごとの専用GAS関数・専用トリガーは不要。**

## 2. 10要件への対応
| # | 要件 | 実装・状態 |
|---|---|---|
|1|入口原則1本|既存の共通日次巡回へ集約(§5)。毎時補完は`段階=bootstrap`の再試行|
|2|設定表で管理|`parseConfig`。不正行はその行だけ無効化、**同じプレイリストを2行が有効で指すと両方停止**、条件なし行は拒否、テーマは「レビュー済のみ」必須|
|3|追加は1行|上記。`series-code:#52-` のような旧`seriesTitleCode`相当は内蔵戦略(注入不要)。旧の個別照合(ノーミライ/太田/佐藤)は名前付き戦略として既存GAS関数を呼ぶ|
|4|変更を共通キューへ|`enqueue`(RSS/フォーム/回復走査を1本化、同一エピソード1件、承認は引き継ぎ・取り消さない)|
|5|差分判定|`affectedRules`: 新着にマッチしたプレイリストだけ読む。`sweep`(回復走査)のみ全有効リスト|
|6|writer単一化|リース保持中のみ `addItems`。`writePermission`が理由つきで許可判定: 有効・承認済・行がLIVE・全体LIVE・`writer=engine`・引継ぎ確認済のすべて|
|7|429/認証/ページング/再開/重複追加防止|`ApiError`と共通クールダウン(fill-queue と同方針)、`readPlaylist`はカーソル付きで再開、完全スナップショット無しは書かない、既存リスト照合で重複しない、クラッシュ後の再実行で追加0(試験済)|
|8|**ユーザー削除曲を戻さない**|台帳 `seen/absent/tombstones`。完全読取で**2回連続**欠けたらtombstone、1回目の疑い中も戻さない。解除は管理人の明示関数 `reinstate` のみ(自動では呼ばない)|
|9|フォーム投稿だけで追加しない|フォーム由来は `approved:false` で入り `AWAITING_APPROVAL` のまま。承認は別経路(申請シートの承認)|
|10|旧GASと二重書込しない切替|§6(`writer`列＋引継ぎ4条件。旧がwriterの間は新は読取専用)|

## 3. 既存資産の再利用(重複実装の回避)
- 追加ロジックの既存GAS(`PlaylistAuto*.js`, `AutoUpdateAutomationV1.js`)は**変更しない**。照合は旧関数をvmで実行して比較。人間削除tombstone(申請単位)・Theme V3・申請シートは現状維持。新エンジンは「エピソード単位のtombstone」「単一writer」「設定表」を足すだけ。
- Phase25 / 6サービスURL補完(#281)/日次増分(#288)/Phase26補完ロボ(#289): キュー・リース・429制御・EP-ID非採番は共通。新規の取得ロボは増やさない。

## 4. 試験結果(いずれもモック/READ_ONLY。Spotify実機は未接続)
- 単体: `tests/playlist-engine.test.mjs` 13件(設定1行追加/不正行の個別停止/DRY_RUN不書込/人間削除不復活/不完全スナップショット/除外・保留・未レビュー・未承認フォーム/キュー重複/429→再開で1回だけ/単一writer/影響リストだけ読む/フォーム取込/照合互換/series-code)。
- E2E(`playlist-engine-e2e.json`): 台帳5,945件を配信順に流し、11/06以降の新着20件→追加候補。対象3プレイリストで**旧GAS照合関数の期待値と3/3一致**、DRY_RUNでのSpotify書込0。フォーム: 既登録は重複させず不足(Spotify URI)のみ補完、除外は尊重、新規は収蔵候補(未レビュー)、承認前の追加0。**人が消した3曲**: 新エンジンは5回の巡回で再追加0、旧方式(`syncOneAutoPlaylist_`の「不足=追加」)は次回に3曲を戻す(コード上)。クラッシュ再実行: 同一runIdのCOMMIT拒否、後続runで追加0。

## 5. 旧GAS方式とのREAD_ONLY差分比較
`scripts/compare-playlist-legacy.mjs`(`playlist-legacy-vs-engine-readonly.json`): 旧固定9規則を設定行へ自動変換し、旧`matchesAutoPlaylistRule_`(個別戦略含む)と新`matchEpisode`を5,945件で比較 → **全9規則で判定・対象番組範囲が完全一致、設定エラー0**。
限界: 入力はRSS由来の台帳行で、SpotifyのAPI応答・実プレイリスト内容ではない(照合ロジックの比較であって実環境一致ではない)。実プレイリストとの差分は COPY/READ_ONLY の次段で測る(§7)。

## 6. 単一writerと切替・復旧
現状(コード上の事実): 旧3関数(`syncKinoDougaPlaylist`/`syncIsshoShinbunPlaylist`/`syncToyohidePlaylist`)は `syncConfiguredAutoPlaylist_` を呼び、**LockServiceを取らない**。共通日次の固定ルール巡回(`syncDailyManagedAutoPlaylistsV1_`)も個別ロックなし。固定7キーに上記3規則が含まれるため、**同じプレイリストに複数経路が書ける**(競合リスク)。いずれも既存のため停止・変更しない。
切替手順(プレイリスト単位、1行ずつ):
1. 設定表の当該行を `DRY_RUN / writer=legacy` で運用(エンジンは候補のみ出力)。
2. READ_ONLY比較が**連続して一致**(候補=旧方式の追加対象、新規の差分0)。
3. COPYで安全性実証(§7の項目)。
4. 管理人が旧経路を停止(トリガーの手動無効化は管理人のみ)し、`legacyDisabledConfirmed`を記録。
5. `writer=engine / LIVE` に変更。`writePermission`は「比較一致」と「旧停止確認」の両方が記録されるまで書込を許さない。
復旧: 行を `writer=legacy` に戻す(エンジンは即時に読取専用)。台帳(seen/tombstone)は追記のみで残り、旧へ戻しても失われない。ただし**旧方式は削除曲を戻す**ため、戻す前に tombstone 一覧を管理人へ提示する。
旧トリガーを新エンジンへ置き換える順序(提案): 重複3関数 → 共通日次へ統合(固定ルールは設定表の行へ) → 毎時補完を`bootstrap`段階へ。

## 7. 既存6トリガーの整理(第二指令)
分類は**リポジトリのコードのみ**に基づく暫定。本番トリガー一覧・実行ログ・実行間隔は未確認(Phase25の過去実機監査はリポジトリに保存された記録が無く、管理人提示の6件と本番ALIB_AUTO_tickの存在以外は照合できない)。**削除・停止・変更は一切しない。**
| トリガー | 分類(暫定) | 責任と書込経路(コード上) | 競合リスク |
|---|---|---|---|
| 共通日次巡回(4〜5時) `runAutoUpdateAutomationV1` | **現在使用中・統合先** | 申請処理→補完1件→承認済み申請の増分→テーマV3→固定7規則の最新20件巡回。Spotifyプレイリスト追加、申請シート状態、作業台の最終更新日、Script Properties(境界) | 固定ルール巡回部は個別ロックなし。旧3関数と同一リストへ書ける |
| 共通初回補完(毎時) `runAutoUpdateBackfillHourlyV1` | **現在使用中・統合予定**(エンジンの`bootstrap`段階) | 新規申請の確認＋初回補完を1回最大50件。日次時間帯(3:30–5:30)はスキップ。ScriptLock | 日次と時間帯分離。ロック有 |
| `syncKinoDougaPlaylist` | **統合予定**(固定規則 kino-douga=日次の固定ルール巡回と対象重複) | `syncAutoPlaylistByPlaylistId_`→全件走査→「不足=追加」。**ロックなし** | 日次との同時実行、削除曲の再追加 |
| `syncIsshoShinbunPlaylist` | **統合予定**(issho-shinbun) | 同上 | 同上 |
| `syncToyohidePlaylist` | **統合予定**(toyohide。speaker型・全公式番組走査) | 同上(`addIndividually`、最終更新日書込あり) | 同上＋API負荷 |
| `syncListenerPodcastPlatforms` | **現在使用中・削除禁止**(別責務: 朝リスPodcastシートの配信先URL補完、Spotifyプレイリストは書かない) | シート書込のみ。ScriptLock有 | プレイリスト系とは独立。本件の統合対象外 |
- 「未使用候補」: 手動関数 `syncAllAutoPlaylists`(定期実行の記録なし)、V2本番同期(`AUTO_PLAYLIST_V2_PRODUCTION_ENABLED_=false`)は本番では無効のコード。いずれもトリガー実在を確認できていない=候補止まり。
- 「削除禁止」: 共通日次・共通初回補完(切替前は唯一の稼働経路)・`syncListenerPodcastPlatforms`・(6件外)本番`ALIB_AUTO_tick`(EP-ID採番器と推定、未確認)。
- 管理人に確認したい事実(質問ではなく次段の前提): 3旧関数の実トリガー有無・間隔(Apps Script画面で確認可能)。

## 8. COPY実機試験 一括承認案(**承認までは実行しない**)
- **新規コード導入(COPY GASのみ)**: ①`P25DailyReadOnly`(公式Omny RSS読取専用、件数・GUID照合のみ) ②`P26PlaylistConfigDryRun`(COPY Sheetの`プレイリスト設定`タブを読み、**DRY_RUN限定**で追加候補を計算・書出) ※Spotifyへの書込関数・addItems・トークン使用コードは含めない。
- **COPY Sheet追記(専用タブのみ)**: `P25_JOURNAL`(run記録/COMMIT)、`プレイリスト設定`(初期9行+試験用1行。全行`DRY_RUN`)、`プレイリスト候補(DRY_RUN)`(追加候補とスキップ理由。氏名・個人情報なし)。台帳タブ・本番Sheetには書かない。
- **トリガー**: 設定しない(手動実行のみ)。
- **検証項目**: ①公式RSS読取専用取得→件数とGUID照合 ②journalへ最大1 run追記→COMMIT後の読み戻し ③同じrunIdの再実行で追加0 ④異常時の停止・復旧(ロック保持を模擬) ⑤本番EP-ID非採番(TMPのみ) ⑥**設定表の行だけ**を切り替えて異なる対象プレイリストのDRY_RUN候補を生成(コード変更なし) ⑦旧方式との差分(行単位で一致か)。
- **安全条件**: COPY isolation検査(scriptId/Sheet ID)通過、本番GAS/台帳/Spotify/トリガー/公開サイト/main不触、ログは件数のみ、追記専用・fencing・runId一意、1回1 run・行数上限、失敗時停止・再実行で重複なし。
- **復旧**: journalは追記専用(最後のCOMMIT以降を無効扱い)、COPY GASはclasp版で戻す、追加タブはCOPY内のみで本番影響なし(削除は承認後)。
- **Spotify実書込はこの段階では行わない**。実書込へ進むには別途: ①Spotify再認可(管理人のみ) ②別承認(COPY用の別プレイリストで1曲) ③切替手順(§6)。

## 9. 新着投稿への即応(第四指令)
`intakeFormPost`: 蔵(GUID/Spotify URI/EP-ID)に照合 → 既登録は重複登録せず不足(Spotify URI等)の補完候補のみ、除外・保留は尊重、新規は収蔵候補(仮・未レビュー)でキューへ。追加は承認後。取りこぼし・遅延配信の回復は `sweep`(全有効リストを対象にした巡回)と、日次の最新N件走査の両方で行う設計(実機では未検証)。

## 10. 「ニュースの学校」MC(第五指令)
- 「過去499件の出演者空欄だから該当なし」は撤回済み(第18号①で実装)。さらに**番組の固定MC(番組レベル)とエピソード固有の出演者を分離**: `ctx.showFixedHost`(状態: `ADMIN_STATEMENT_UNVERIFIED`/`CONFIRMED_OFFICIAL`)と `exceptionsIdentified`/`exceptionEpisodeIds`。
- 補完候補になる条件(すべて必須): 公式の番組情報で裏付け(`CONFIRMED_OFFICIAL`)かつ例外回が特定済み、かつ当該回が例外ではない。それまでは `UNKNOWN_UNDOCUMENTED`(要確認)で、候補にならない。候補も**提案止まり**(自動書込なし)。
- 実測: ニュースの学校499件の公式概要に**MCの記載は0件**。したがって現時点では「神田大介さん」を公式根拠で裏付けられる回は0件。管理人の認識は `ADMIN_STATEMENT_UNVERIFIED` として記録し、**499件の一律自動補完はしない**。
- 例外回の発見の手がかり(`news-school-mc-candidates-counts.json`): 概要に人物語(さん/氏/教授/記者等)がある39件、ゲスト・特別語1件、再生時間の外れ値6件、いずれかに該当46件。IDと理由は非コミットのCSV(管理人確認用)にあり、これは例外の断定ではない。

## 11. 未確認・限界
- Spotify実API・実プレイリスト・実トリガー・LockServiceの原子性・本番ALIB採番器は未確認。差分比較・E2Eはモック/ロジックのみ。
- 戦略関数(ノーミライ/太田/佐藤)はGAS側の既存関数を呼ぶ前提(vmで同一ソースを実行して一致を確認)。GASへの移植は未実施。
- tombstoneの「連続2回欠け」は、Spotify読取の取りこぼしを避ける保守的な設定(`confirmAbsent`)。値の妥当性は実測で調整。
