# 6サービスURL補完ボット (Issue #280) — 調査・設計・実装範囲

状態: **READ_ONLY/fixtureベース。本番Sheet・GAS・Spotify書込・OAuth・トリガー・main・既存非空欄は未変更。** #279(基本台帳v1)の上に積んだ独立ブランチ(`PR base = feat/issue-278…`)。#279 の `base-ledger.mjs`(個別EP形式判定・固定順)を再利用し、判定ロジックの重複を作らない。

## 1. 現行取得経路の調査(repo内。本番GASがrepoと違う場合は未確認)
| 経路 | 場所 | 対象 | 個別EP? | 備考 |
|---|---|---|---|---|
| Spotify番組/EP解決 | `Spotify.js`, `PodcastResolve.js`(`resolveSpotifyEpisode`), `PodcastSpotifyResolve.js`(PR #276) | おすすめPodcast・Spotifyリンク入力 | EPリンク→番組へ解決 | #276で全プラン判定/AMBIGUOUS/INCOMPLETE |
| Apple検索 | `PodcastApple.js`(`itunes.apple.com/search`) | タイトル検索で番組メタ/アートワーク、`entity=podcastEpisode`は1関数 | 番組単位に偏る | 番組IDからのエピソード列挙(lookup)は未使用 → 本PRで実装 |
| 6社番組URL同期 | `PodcastPlatformSync.js` | 「朝リスPodcast」シートの**番組**URL | いいえ | 台帳EPのURLではない |
| 台帳EPの6社URL補完(P15) | 本番GAS(ALIB_AUTO_tick/P15_*) | 台帳K〜M,AO〜AQ | はい | **repo外で未確認**。本番P15_PLATFORM_STATUS実測: 候補18EP中 UNAVAILABLE 102/EXISTING_VERIFIED 6、理由 NO_MATCH_IN_DISCOVERED_PAGE 74・BUDGET_DEFERRED 21・HTTP_403 6 |
→ 重複システムは作らず、**本ボットは P15 と同じ `EP×platform×state×evidence` 契約を持つREAD_ONLYの探索・照合コア**として置き、本番GAS側へ移植/呼出するかは別承認。

## 2. 失敗の原因別分類(再現はfixture。実環境の再現は未実施)
`#265 補完0` 候補0/呼出ゼロ/API失敗/確証不足を区別: `NOT_FOUND:NO_CANDIDATE` / `ERROR:NO_VERIFIED_ROUTE`・レポート警告「API呼出0」 / `ERROR:HTTP_429・TRANSIENT・HTTP_403` / `HOLD:*`。`#274 Spotifyあるのに未表示`: 番組URL(/show/)を個別EP列に入れない(`HOLD:NON_EPISODE_URL_IN_EPISODE_CELL`)、後から個別EPが現れたら再探索で確定(retry_after)。表示経路(ポすすめ)の不具合は本ボットの範囲外で別Issue。Apple番組偏り: lookupによるエピソード列挙で解消(**実API未検証**)。

## 3. 共通インターフェース (`scripts/lib/platform-resolver.mjs`)
入力: `epId, showTitle, title, guid, publishedAt, officialUrl, existing{platform:url}, showUrls, showIds{platform}, knownExternalIds`。
出力: `ep_id, platform, entity_type(show/episode), url, external_id, evidence[], checked_at, status(VERIFIED/HOLD/NOT_FOUND/ERROR), reason, retry_after`。
探索順: 既存URL(保護) → 強ID(GUID/外部ID一致) → 完全正規化題名+日付(日精度±1日/時刻±12h)+同一番組+唯一候補 → それ以外はHOLD。類似のみ(改題)・日付違い・複数一致・再配信語(`（再）`等)はHOLD。番組URL/検索結果URL/別ホスト/別番組は候補から除外し個別EP列に入れない。題名だけでは確定しない。数字(#15/#16)・かな漢字は正規化で残す。

## 4. 再試行・レート制限
429は `Retry-After`尊重+プラットフォーム共有クールダウン(後続EPは呼ばずERROR:COOLDOWN)、5xx/タイムアウトは指数バックオフ(上限24h)、404=NOT_FOUND、NOT_FOUNDの再探索間隔は新着6h/60日以内24h/それ以降7日。`state.json`(attempts, retry_after)で再開、成功で解除。新着優先、過去欠損は `--backfill-limit` で低負荷。Spotifyは`next`で全ページ、marketはJP指定(market影響の実測は未実施)。

## 5. 6社の実態(実測できたもの/できていないもの)
- Apple: iTunes Lookup(公開API)でエピソード列挙。**fixtureのみ検証、実API未検証。最大200件のため古い話は返らない可能性。**
- Spotify: Web API(要トークン=Secrets、本セッションでは未使用)。ページネーション/429はfixture検証のみ。
- LISTEN / Amazon Music / Pocket Casts / Pody: 公式/公開の個別EP検索APIを実測できておらず**アダプタ未実装**(存在しないAPIは仮定しない)。`ERROR:NO_VERIFIED_ROUTE` として可視化し成功扱いしない。個別EP形式のみ #279 の判定で受入れ。P15の発見ページ(番組ページ内リンク抽出)は本番側にあり、同等のrepo実装は次段階。

## 6. 出力・運用
READ_ONLY単一CLI `scripts/platform-url-bot.mjs`: `proposals.json`(空欄のみ・`write:false`)、`records.json`、`report.json`(媒体別 対象/空欄試行/VERIFIED/新規VERIFIED/HOLD/NOT_FOUND/ERROR/API呼出/retry予定/前日差/警告)、`state.json`、`manifest.json`(入力SHA256)。Actions: `platform-url-bot-dryrun.yml`(手動実行のみ・Secretsなし・成果物アップロード)。定期実行・本番書込は別承認。
**Before/After実測: 未取得**(台帳CSVと実APIがこの環境にないため数値は作らない)。

## 7. 回帰テスト(`tests/platform-resolver.test.mjs` 15件)
#274(茶会の番組Spotify URL `show/7dDe6p…` を個別EPにしない/遅延出現)、#265(EP-06642〜44の他列不変・入力CSV不変・429のretry state)、同名異話・日付ずれ・別番組・改題・再配信・GUID違い・複数一致、空欄/非空欄保護、429/404/5xx/403/タイムアウト、冪等再実行(提案重複0)、再試行、新着優先、レポート警告、Spotify/Appleアダプタ。

## 8. ROLLBACK
本PRは新規ファイルのみ・書込なし。リバート=ファイル削除/PRクローズで完了。本番影響なし。
## 9. 管理人に必要な操作(最大3)
1. 台帳の本番CSV(A:AS相当・READ_ONLY)をrepoまたはCOPYに用意(実Before/After・形式確定のため)
2. Spotify/Apple実API試験を許可する場合、COPY/READ_ONLYでのトークン付与(Secrets。ログ非公開)
3. 本番GAS(P15)側への移植・定期実行・Spotify書込は別途承認
