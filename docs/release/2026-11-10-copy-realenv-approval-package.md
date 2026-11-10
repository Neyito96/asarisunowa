# COPY実機試験 一括承認書(第19号最終統合・第三指令)

**この文書の作成だけではCOPY GASへの導入もCOPYシートへの書込も行っていない(未実行)。実行は管理人の一括承認後。** 本番GAS・原本台帳・本番Spotify・トリガー・公開サイト・main・有料APIは対象外。

## 1. 承認を求める操作(すべてCOPYのみ)
| # | 操作 | 実体 |
|---|---|---|
| A | PR #285 の書出ガード版を導入し、旧 `P25_COPY_EXPORT_NEW_ROWS_20261110` を置換 | `P25CopyExportGuarded.js`(承認記録必須・承認1回=出力1ファイル・行数上限200・対象EP-ID固定・作成前`creating`マーカーで二重作成防止)。**この承認までは派生Sheet作成関数の再実行は禁止のまま** |
| B | 試験用コードの導入(2ファイル) | `scripts/copy-gas-proposal/P26Bundle.gs`(生成物・約64KB。`scripts/build-copy-gas.mjs` が public/library の純粋モジュールを束ねたもの)＋`P26Entry.gs`(入口。約190行) |
| C | COPY Sheetへ専用タブを作成(下記§2) | `P26_` で始まる7タブのみ。台帳タブには書かない |
| D | Script Property `P26_APPROVAL` の設定 | 承認者・承認日・期限・関数の範囲。無い/期限切れ/範囲外なら全関数が STOP |
| E | 手動実行のみ(トリガーは作らない)。順序: `P26_recordApproval` → `P25DailyReadOnly` → `P26Verify` → `P26PlaylistConfigDryRun` → `P26Verify` | 各関数は最大1 run(2回目は `STOP:MAX_RUNS_REACHED`) |
| F | (承認不要の読取確認)既存6トリガーの実在・間隔・最終実行・所有者をApps Script画面で確認 | コード導入なし。確認結果は§6の分類表を更新する材料 |
Spotifyの読取・書込、トークン使用、トリガー作成/削除、Driveの共有、メール、COPYの台帳タブへの書込は**含まない**(`tests/copy-gas-bundle.test.mjs` の静的検査で不在を確認)。

## 2. 書込範囲・最大件数・保持期限
| タブ(COPY Sheet) | 内容 | 最大 | 備考 |
|---|---|---|---|
| `P26_JOURNAL` | 追記専用: LEASE/COMMIT/RELEASE(owner,token,runId,version,payloadHash) | 100行 | 超過は STOP |
| `P26_REGISTRY` | 収蔵レジストリ(公開RSS由来: id/guid/feedKey/show/title/pubDate/状態。**説明文は保存しない**) | 3,000行 | Omny 2,672件を想定。超過は書かず STOP |
| `P26_FEEDS` | 入力設定(feedKey/URL/番組名)。許可ホスト: www.omnycontent.com, api.omny.fm, omny.fm のみ | 10行 | 初期行は既存COPYで成功したOmny取得先を転記(承認範囲内) |
| `P26_PLAYLIST_CONFIG` | 設定表(17列)。初期9行(`docs/release/2026-11-10-playlist-config-initial.csv`、全行DRY_RUN・writer=legacy)＋切替試験用1行 | 50行 | |
| `P26_PLAYLIST_SNAPSHOT` | 任意。プレイリストごとの既存曲URI(あれば候補を確定、無ければ照合結果のみ) | 任意 | Spotify読取は本承認に含まない |
| `P26_PLAYLIST_DRYRUN` | DRY_RUN候補とスキップ理由(runId/ルール/エピソードURI/状態)。毎回上書き | 200行 | 氏名・説明文なし |
| `P26_REPORT` | 実行ごとの件数サマリ(JSON) | 追記のみ | 件数・状態のみ |
読取: COPYの台帳タブ(`getValues`のみ)最大20,000行・直近14日分を候補生成に使用。RSS取得: 1フィード最大20MB・最大10フィード。
**保持期限**: 2026-11-24(暫定。承認の`expiresOn`も同日)。削除は管理人がDriveで行う(Claudeは削除しない)。派生Sheet `1axvdSRr…` も同日まで保持(削除は別承認)。

## 3. 試験項目と合格基準(第三指令)
1. 公式RSSを読取専用で取得(HTTP 200・件数=既成功値と整合)
2. 厳格解析・GUID照合(隔離件数・不正日付の扱いを記録)
3. EP-IDは採番しない: 台帳にGUIDがあれば**読取結果のEP-ID**、無ければ `TMP-<16hex>`。`epIdsMinted=0`
4. `P26_JOURNAL` へ最大1 run(LEASE→COMMIT)
5. COMMIT後に読み戻し(`readbackOk=true`)
6. 同一runIdの再実行で追加0(`sameRunRerun=NOT_COMMITTED`、レジストリ行数不変)
7. 設定表の**行だけ**を差し替えて別プレイリストの照合結果/DRY_RUN候補を生成(コード変更なし)
8. Spotify・本番・台帳への書込0(`spotifyWrites=0`、台帳タブの書込0)
ローカルのGAS模擬(`tests/copy-gas-bundle.test.mjs`、5件合格)で上記の論理は確認済み。**実機の結果ではない。**

## 4. 異常時の停止と復旧
| 事象 | 挙動 | 復旧 |
|---|---|---|
| 承認なし/期限切れ/範囲外/COPY以外のscript・sheet | 何も書かず STOP | 承認記録を設定 |
| 他の実行がロック保持 | `SKIPPED` で何も書かない | 時間を置いて再実行(最大1 run制限は未消費) |
| RSS取得失敗/不正XML/別番組/不正日付 | 巡回失敗として記録、該当分は隔離、レジストリを壊さない | 次回再実行 |
| COMMIT拒否(runId重複/FENCED/期限切れ) | 永続化しない(Registryは書換えない) | 新runIdで再実行 |
| 行数上限超過 | 書く前に STOP | 上限見直しは再承認 |
| async処理が実機で途中終了(マイクロタスクが排出されない場合) | 状態は書込済みの範囲で止まり、`P26Verify` で journal/registry/report の整合を別実行で確認。COMMIT無しの run は「未完了」として再実行で収束 | 同上 |
| 後始末 | JournalはCOMMITのみ有効(最後のCOMMIT以降は無効扱い)。追加タブはCOPY内のみ。コードはclasp版で前版へ戻す | 管理人がタブ削除(期限後) |

## 5. 実機で初めて確認される前提(未検証・リスク)
LockServiceの原子性/GASでのasync・Promise完了(`P26Verify`で別実行確認)/Omnyフィードの実ホスト名が許可リストに入っているか(外れたら `HOST_NOT_ALLOWED` で止まり、承認範囲内でリストを調整)/COPY台帳タブの名称・列位置・日付セルの型/UrlFetchのクォータ/6分の実行上限(ローカルで2,700件の解析・収蔵は約1.8秒、GASでは数倍でも上限内の見込み)。

## 6. 既存6トリガー対応表(暫定・コード根拠。停止/変更なし)
`docs/design/2026-11-10-spotify-config-engine.md` §7 を参照。要点: 共通日次=使用中・統合先、共通初回補完=使用中・統合予定(エンジンの`bootstrap`段階)、`syncKinoDouga/IsshoShinbun/Toyohide`=統合予定(ロックなしで日次と同じリストに書ける競合リスク)、`syncListenerPodcastPlatforms`=使用中・削除禁止(別責務)。実トリガーの有無・間隔は承認項目F(読取確認)で更新。

## 7. 実測と模擬の分離(第四指令)
| 区分 | 現状 | 実環境で測るもの |
|---|---|---|
| フィクスチャ再生(台帳を真値) | Phase26 e2e・181セル一致・概要/リンク反映・出演者候補の精度 | — (これは実測ではない) |
| 旧GAS照合との差分(ロジック) | 5,945件で9規則一致(RSS由来の台帳行) | 実プレイリスト内容との差分(Spotify読取が必要=別承認) |
| 実公式RSS | COPYでの取得成功(2,672件)のみ | 本承認の試験1〜6 |
| サービスAPI(Spotify/Apple/LISTEN) | 未実施 | 次段(再認可・別承認) |
**Spotify未発見18件の切り分け計画**(実読取は再認可・別承認後): 各番組のSpotify側エピソード一覧を読み取り専用で取得し、(1)一覧に一致する回がある=**取りこぼし(探索経路の問題)**: 照合キー(正規化タイトル・配信日±1日・再生時間±数秒)で一致 (2)一覧に無く公式RSSには有る=**未公開または未反映の疑い**: 24h/72h後に再照合し、継続すればHOLDのまま管理人へ(断定しない) (3)番組自体が一覧に無い/別市場=**探索経路・番組ID設定の問題**(A群16件=11/06以降、B群2件=こどもそうだんしつは番組単位で確認)。**台帳のURL空欄は「サービス未公開」を意味しない。**

## 8. 本番移行に向けた段階切替・ロールバック
0. 現状(旧GAS方式のみ稼働)。1. 本承認: COPYで読取専用・DRY_RUN試験(旧に影響なし)。2. COPYでSpotify読取(再認可・別承認)→実プレイリストとの差分一致を連続確認。3. COPYで1曲の実書込(別承認・COPY用の別プレイリスト)。4. 本番へ移行する前に管理人が旧3関数のトリガーを停止、設定表の行を `writer=engine / LIVE`(1行ずつ)。5. 全行移行後、毎時補完を`bootstrap`段階へ統合。
ロールバック: 行を `writer=legacy` に戻す(エンジンは即時に読取専用)。台帳(seen/tombstone)は追記のみで保持。旧方式は削除曲を戻すため、戻す前にtombstone一覧を管理人へ提示。各段で本番Spotify・本番台帳へ変更しない段階(0〜3)を明示。
