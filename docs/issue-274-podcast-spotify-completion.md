# Issue #274 ポッドキャスト茶会のSpotify欠落と補完器の改善(2026-11-10)

## 原因の分類(コードで確認できたことと、未確認のこと)
| 区分 | 内容 |
| --- | --- |
| 確認(コード) | 旧 `findSpotifyShowByTitle_` は、番組名の単発検索(`limit=10`、1ページ)で、正規化後の完全一致だけを採用。HTTP エラー、認証失敗、429、候補なし、名前不一致のすべてが `null` で、理由が残らない。 |
| 確認(コード) | 旧 `normalizeTitle` は NFKC を使わず、全角・半角の英数字や半角カナの違いを吸収しない。 |
| 確認(コード) | 検索は公式リンク(元URL・RSS)の適用より前に走り、失敗しても理由が残らないため、同じ失敗が毎回黙って繰り返される。 |
| 確認(テスト) | 実データの J 列(10列目) → API `source.spotify`(`readPodcastSheet`) → サイトの Spotify リンク、の経路は正しい。サイトのローカル保存(24時間)は API の再取得を止めない。つまり、J 列が空なら Spotify リンクは出ず、J 列が埋まればリンクが出る。 |
| **未確認** | PODCAST 19 で実際に何が起きたか(名前の不一致 / 検索結果なし / 429 / 認証 / 同期が未実行)。この環境からは本番シート・Spotify・LISTEN ページに届かないため、断定していない。 |
| **未確認** | 候補 `7dDe6pPYCdUUDQ2AL40xtE` が「ポッドキャスト茶会」の番組かどうか。Issue にある第三者ページの掲載だけでは同一性の証拠として弱い。下の読み取り専用の確認で、Spotify 側の番組名・配信者と照合する。 |

## 変更
- 新規 `PodcastSpotifyResolve.js`: NFKC 正規化、検索語の変形(括弧書き除去・区切りで分割・空白除去、最大5つ)、2ページ目の取得、呼び出し上限、失敗理由の分類(`AUTH` `RATE_LIMIT` `HTTP_ERROR` `NETWORK` `NO_RESULTS` `TITLE_MISMATCH` `AMBIGUOUS`)、429 は `Retry-After` が10秒以下なら1回だけ待って再試行、それ以外は保留。名前が似ているだけの候補、同名で配信者が決まらない候補は**確定しない**。別名表(`PODSP_TITLE_ALIASES_`、既定は空)は管理者が明示した別名だけを認める。
- `PodcastPlatformSync.js`: 公式リンク(元URL・RSS)を先に適用し、見つからないときだけ Spotify 検索を行う(公式リンク優先)。空欄にだけ書く既存の動作は変更しない。同期結果に `spotifyUnresolved`(行・番組名・理由)を追加。
- `Spotify.js`: `findSpotifyShowByTitle_` を、MATCH のときだけ URL を返す互換ラッパーに変更(他の呼び出し元への影響なし。理由はログに残る)。
- 読み取り専用の監査: `auditRecommendedPodcastSpotifyGaps`(LISTEN あり・Spotify 欠落の全件抽出)と、番組同一性の確認 `podSpVerifyShowIdentity_`。番組 URL とエピソード URL を区別する。

## 管理者が GAS エディタで実行する確認(すべて読み取り専用。シートへの書き込みなし)
1. `AUDIT_PODCAST_SPOTIFY_GAPS` — Spotify を呼ばずに、LISTEN あり・Spotify 欠落の件数と行を出す。
2. `AUDIT_PODCAST_SPOTIFY_GAPS_LOOKUP` — 先頭15行を Spotify 検索で分類(MATCH / TITLE_MISMATCH / NO_RESULTS / AMBIGUOUS / RATE_LIMIT / AUTH)。429 や認証失敗で自動停止。
3. `DRYRUN_PODCAST19_SPOTIFY_FILL` — 候補番組の Spotify 上の番組名・配信者を取得し、シートの「ポッドキャスト茶会」と照合する(ドライラン)。`identity: MATCH` なら同一。`TITLE_MISMATCH` の場合は、Spotify 上の番組名を人が確認し、同一なら別名として明示する。

## 承認が必要な操作(未実施)
- 本番 GAS への反映(`PodcastSpotifyResolve.js` の追加、`PodcastPlatformSync.js` / `Spotify.js` の変更)。
- PODCAST 19 の J 列への書き込み。`fillRecommendedPodcastSpotifyOne` は、既定がドライラン。実行には `apply: true` と `confirmShowId`(番組ID)、同一性の確認、J 列が空であることが全て必要で、1セルだけ書く。既存値は上書きしない。

## 司令塔レビュー対応（2026-11-10 第2指令）

- 検索の**早期MATCH廃止**: 計画した全クエリ（全タイトル変種 × 1ページ目、満杯なら2ページ目）を終えてから判定する。後続ページ/変種に同名の別番組が出れば、出版社証拠で一意に絞れない限り `AMBIGUOUS`（URLなし）。
- **部分結果は採用しない**: 429 / 401・403 / 5xx / ネットワーク / 呼び出し上限（`INCOMPLETE`）で打ち切られた場合は理由コードのみ返し、`url`/`id` は空。途中の一致は `tentative`（人の確認用）としてだけ保持し、シートには書かない。
- 監査関数は `asOf` / 母数(`total`,`withListen`,`missingSpotify`) / `classified` / `unclassified` / `window` / `nextStart` を分けて返す（先頭15件=全体分析ではない）。
- **READ_ONLY経路**: 本番GASに未反映の監査関数は管理者に実行依頼しない。代わりに `node scripts/podcast-spotify-gaps.mjs export.csv` でシート書き出しCSVをオフライン集計できる（ネットワーク・Sheets・GAS不使用）。READ_ONLY限定のGAS反映は管理者の個別承認事項として別途提示する。
