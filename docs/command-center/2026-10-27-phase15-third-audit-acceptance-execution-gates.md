# 司令塔｜Phase15 第3次監査受入・限定COPY試験への実行ゲート
2026-10-27 JST / **本書はGitHub監査記録のみ。GAS/Sheets/公開環境の実書込を許可しない。**

## 根拠
- 宇宙/蔵とは別の補填収蔵ロボ成果: `Neyito96/asarisunowa` branch `audit/phase15-megaphone-copy-dryrun-20261027`。
- GitHub `docs/command-reports/2026-10-27-phase15-150-structural-screening.json` blob `baa6ce332ec3cd335ee4b533a548cb38a2cb277d`：150件の層化機械構造検査。quota: missingSchool40, missingOther20, bothWithLinks55, bothNoLinks13, sdgs20, regression2。W空欄60、追加精査5、他85（担当集計）。層化標本は全体の不良率推定ではない。構造検査に意味・人物・文脈の完全判定は含まれない。
- `docs/command-reports/2026-10-27-phase15-copy12-dryrun.json` blob `b08b1b236709290e084a24082c4010cc6b7fe62a`：`status=READ_ONLY_DRY_RUN_BLOCKED_NO_ACL`、writes0、6EP×L/AP12セル。COPY／本番GUID、EP-ID、元URLの一致と空欄を確認。**candidate records のdate_match=false がある**ので日時一致済みと誤記しない。
- `docs/command-reports/2026-10-27-phase15-vw-cleaning10-proposals.json` blob `0fcfc0ba2c70ba98e02c014889cdf15654d97072` のレコード7件、`...addendum1.json` blob `13fc606055ca3b714e2209286084e6ce54f2af69` 1件、`...addendum3.json` blob `e70a39cb5dbbf28b4e534a5ff004db9eebb5acc6` 3件。複数成果をEP-IDでdedupeし固有10件の暫定清掃案。V原文は不変、実書込0、SHA256と意味品質未検証。
- GitHubファイル本文を司令塔が直接読み確認したが、台帳Google Sheetsの全行・COPY ACLやプラットフォームHTTPはこのターンで独立検査していない。正式な実機PASSと混同しない。

## 決裁
150件**機械的構造検査**を成果として受け入れる。150件人手相当/意味品質合格とは認定しない。
10件V→W清掃案を**品質審査対象**として受入。既存V/W、旧判定、公開への自動転記不可。
COPY12セルは`READ_ONLY_DRY_RUN_BLOCKED_NO_ACL`のまま。COPY実書込、まして本番実書込の承認なし。

## 次工程A: 清掃10件を独立に仕上げる（P0）
1. 7+1+3=11レコードから同じEP-IDを一意化して10件とし、候補の競合や内容差をmanifestで説明する。Vの正しいraw hashと候補WのSHA256を実際に計算（できない場合null）。GitHub公衆領域にV全文を今後広く複製しない。
2. Megaphone由来の`\\n`文字列と実改行の相違、HTML entity `&nbsp;`、Markdown改行、区切りの正規化、関連記事見出しとURLの分離、広告除去、意味が残っているかをテスト。媒体特有の情報が消えたらSTOP。
3. 代表10件で `EP-ID,GUID,Vhash,W_before_empty,W_candidate_hash, retained_topic, article_headline_url_pairs, host_guest_links, policy_version, reviewer_status`を保存。2名相当の独立検査かチェックリストで意味正確性を確認し、再実行結果が不変になることを示す。
4. `ニュースの学校`466件の系統的なW欠損原因は、取込/清掃コード・ログ・ソース別フローから実証する。原因未確定でも、既存Vを使う安全な清掃器のCOPY検証準備は可能。AJWなど公開対象外は混入禁止。
5. 承認前にCOPYの10件W列を再読、EP-ID/GUID一致、実際のセル空欄・保護ACL/数式/書式/入力規則/豊富テキストとV原文ハッシュ一致を確認。まずwrite0の正式DRY_RUN、実書込は承認申請と別扱い。

## 次工程B: リンク12セル独立ゲート（P0）
1. EP-00001/2/3/21/22/23 L(Spotify)/AP(Pocket Casts)の共同編集B日付（RFC UTC）→JSTと本番D日付を**時刻付きで**正規化し、ずれが残ればHOLD。EP-00023の題名番号違いを注記。
2. 原本A URL・番組・タイトル・GUIDを複数軸で照合。共同編集内の同じURLの別番組/複数エピソード競合を明示し、後勝ちで上書きしない。
3. Spotify/Pocket Castsの個別リンクにHTTP到達・redirect・episode identity根拠を記録。403/429は削除と断定しない。返却ページの同一エピソードが検証不能ならHOLD。
4. Google SheetsのCOPY保護範囲/ACLを取得できる方法で確認し、読み取れない場合はSTOP。12セルの対象COPYが空欄でも、本番/他COPYと同時進行している可能性を踏まえ、直前に再読。
5. `candidate_manifest`に `status,GAS execution evidence,writes=0,stop_reason`を含め、完全にPASSしたセル数を報告。存在しないHTTP結果、ハッシュ、保護結果を作らない。次の明示承認まではCOPYにも実書込しない。

## 次工程C: 150件の質的審査と年月マトリクス（P1）
- Wの空欄60、追加5、他85の実測標本を意味面から再審査：V/W/X/ACで記事の要点、記事見出し×URL、出演者、固有リンク、収録日時を合わせて保持しているか。対象外・真正欠損・保留・問題なしの件数を別計上。
- おんさ6番組、Spotify/Pocket Castsと本番の候補47/61をUTC→JSTで番組×年月に整理、リンク未記載とリンク切れを区別。SDGs旧情報を逆流させない。
- 審査用スナップショット・再現手順とGitHub repo/branch/path/commitを報告。

## 蔵・宇宙への連携
清掃Wの承認済み更新についてのみ、`EP-ID,GUID,Vhash,oldWhash,newWhash,policy_version,source,reason,preserved_links,approval`を差分通知。蔵では非公開検索/詳細をテスト、宇宙はAI意味分類レビューキューへ（人間承認109件を破壊しない）。現行公開5848のID集合変更と新着本番移行は別ゲート。

## 絶対停止線
本番/COPYセル書込、W既存非空の上書き、GAS/トリガー/Properties編集、元おんさシート、採番、main/Pages/公開JSON/Spotifyは今回すべて不許可。
