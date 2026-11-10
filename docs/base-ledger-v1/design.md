# 基本台帳v1 設計書 (Issue #278)

状態: **設計+非破壊ツールのみ。本番のタブ・列・EP-ID・GAS・Spotify・シートは一切変更していない。**

## 0. 最優先の受入条件: プラットフォームURL探索・補完の維持
基本台帳のスリム化は「画面(View)」の話であり、探索メタデータの削減ではない。

1. 対象: 朝日公式 / LISTEN / Spotify / Apple Podcasts / Amazon Music / Pocket Casts / Pody / Omny・Megaphone(+音声URL。YouTubeは正規音声EPに紐づく公式動画URLとしてのみ補助保持)。
2. 内部に `EP_ID × platform × URL × status × evidence × last_checked` を保持する(実装: `buildPlatformLinks`, 出力 `ep-platform-links.csv`)。本番では既存 `P15_PLATFORM_STATUS`(EP-ID/SERVICE/COLUMN/STATE/REASON/URL/EVIDENCE_URL/CHECKED_UTC/NEXT_UTC)が同じ役割を既に果たしているため、**別の新タブを作らずこれを正本とする案を第一候補**、台帳URL列(11,12,13,41,42,43列=LISTEN/Spotify/Apple/Amazon/PocketCasts/Pody。P15_PLATFORM_STATUSの実測で確認)はGAS互換のため現位置のまま維持。
3. status: `confirmed / candidate / hold / not_found / unavailable(一時エラー・再探索) / not_supported`。**空欄≠存在しない**(空欄は `not_found, probed=false` で再探索対象)。
4. 誤リンク防止: 番組URL(/show/)・ホスト不一致・個別EPでないURLは `confirmed` にしない(`hold`、原文保持)。段階照合順: GUID → 公式ID → 配信日時 → タイトル → 番組。
5. 既存の有効URLは1件も失わない(`checkInvariants` のURL消失検査)。URL関連列(8,9,10,11,12,14,28,32,40,41,42 ※0始まり)は棚卸しで「不要」に分類しない(`classifyColumn`)。
6. 11/17までURL探索パイプラインへの破壊的変更はしない。

## 1. 除外設計(アルキキ・AJW・朝ポキTV/YouTube由来)
- 単位: **番組(タブ/番組名) → 台帳行 → リンク列** の3層。除外は「掲載判定=対象外」の付与であり、行・EP-IDは削除しない(監査アーカイブとして旧EP-ID・参照・除外根拠を保持)。
- 音声EPに付いた補助YouTube URLは除外理由にしない(`auxVideoUrls`として保持)。音声版がある同一話は音声版を優先。YouTubeのみで音声URL・非YouTube公式URLがない行だけ `youtube_origin` で除外。
- 凍結済み10/22判定(`docs/audits/2026-10-22-publication-scope/decisions.json.gz`, 6,591行)の集計:

| 系統 | 件数 | 内訳 |
|---|---|---|
| 対象外番組 | 140 | アルキキ100 / AJW25 / 朝ポキTV15(掲載対象への漏れ0件を確認) |
| 重複 | 161 | 対象外 |
| 再配信(確定) | 76 | 対象外 |
| 再配信候補 | 149 | 保留 |
| 同一性保留 | 217 | 保留 |
| 日時差分(掲載は維持) | 598 | 対象 |
| 通常 | 5,250 | 対象 |

対象5,848 / 対象外377 / 保留366。表示差分(掲載への影響): 対象外番組は既に0件掲載で、11/17の公開差分は新たに増えない(PR #277の「新100件」判断は別管理)。

## 2. 再配信判定
おんさ speakers3.js の表示計数ルール(ルールのみ再実装、AGPLコード・データは複製しない): `（再）` `（ふりかえり）` `（深掘り）` `再放送です` `duration<=0`。
- ルール一致 = **再配信候補(HOLD)**。同一GUID・元URLの証拠、または凍結判定「再配信」がある場合のみ「再配信」確定=通常表示から除外(`classifyRedistribution`)。続編・リマスター・編集版は自動削除しない。
- 根拠と取得時刻を保持。おんさのAPIが使えない場合は共同編集シート/公開JS(ReadOnly)で代替し、原情報は保持。APIの件数ギャップは警告扱いでブロッカーにしない。
- 再配信判定の全件一覧は凍結判定の `removed-from-publication.csv.gz`(再配信76+候補149)を一次資料とする。

## 3. 基本台帳v1 (View, 13列)
`EP-ID, 番組, タイトル, 配信日時, 公式GUID, Omny/公式URL, Spotify URL, 概要(清掃済み), 出演者, 再配信フラグ, 掲載判定, 理由/根拠, 最終更新日` (`buildBaseView`)。
- 元データから**非破壊に生成**(入力不変をテスト)。全55列は raw/detail としてEP-IDをキーに残す。既存GASの列位置参照は壊さない(列の移動・削除なし。Viewは別タブ/別ファイル)。
- 未確定: 出演者の正準列(`castCol`は指定式。本番55列ヘッダ未取得のため空出力)、必須列、掲載判定の正本(現在は「図書館・宇宙 検索対象判定」タブD列)。

## 4. 依存関係棚卸し
`scripts/base-ledger-deps.mjs` → `dependency-inventory.json`(repo 112ファイル走査、25列・11タブ参照を検出)。
**限界(正直に)**: 本番GAS(ALIB_AUTO_tick/P15系)はrepo外、Driveコネクタも台帳本体タブ・全タブ一覧・55列ヘッダを返さないため「55列/44タブの網羅棚卸し」は未完。`--extra <dir>` に管理者がread-onlyでexportしたGASソースを渡せば同じスキャナで完成させる。走査はヒューリスティック(`row[N]`/getSheetByName)で、repo内の別用途の配列参照も含む可能性がある。refs=0 の列は「削除候補」ではなく「未確認(本番GAS未取得)」とする。
削減候補表は、本番GAS取得後に `表示維持/運用必須/アーカイブ後非表示/移行候補/削除候補` へ確定する。現時点で確定「削除候補」は0。

## 5. 回帰テスト(`tests/base-ledger-v1.test.mjs`, 11件合格)
URL全種保全 / 誤リンク非確定 / 空欄の再探索性 / 一時エラー・未対応・未発見の区別 / P15根拠の反映 / #274(ポッドキャスト茶会Spotify遅延)再現 / 除外(補助YouTube保持) / 再配信ルールHOLD / View13列・非破壊 / EP-ID・URL・GUID不変条件 / URL列を不要に分類しない。
未実施(承認・COPY環境が必要): 自動新着収蔵・Spotify補完・概要欄・出演者・サイト検索の実環境差分、旧EP-ID不変の本番照合、本番台帳件数照合、GASトリガー差分。

## 6. 切替手順とROLLBACK
1. `write:false` モック(本PRのCLI) → 2. COPY環境(19Dv6c…)で生成・差分試験 → 3. **別承認**で切替。
- 切替前: 原本シートの複製(バックアップ)、`manifest.json`(入力SHA256・行数・不変条件)、依存一覧を保存。
- ROLLBACK: Viewタブ/生成物を削除し原本タブは無変更のため、View無効化のみで元に戻る。GAS・列位置・EP-IDには触れないので復旧対象は生成Viewのみ。

## 7. 11/17の最小公開変更 / 公開後の整理
- 11/17: 公開側の変更は不要(除外は既に掲載0件、基本台帳v1はView生成のみで公開に影響しない)。
- 公開後: 本番GAS依存確定 → アーカイブ後非表示→移行→(別承認で)削除の順。URL探索系は最後まで残す。
