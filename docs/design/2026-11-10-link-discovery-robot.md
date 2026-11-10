# マルチプラットフォーム個別EP URL探索ロボット（第36号）: 設計と実測

READ ONLY。台帳・Sheets・GAS・トリガー・OAuthは変更しない。新しい正本/DB/GASは作らない（既存の台帳列とPR #297〜#298の照合基盤を再利用）。

## 現状の台帳カバレッジ（本番6,691件・2026-11-10 21時台、全件計測）
| サービス | 列 | 保有 | 率 |
|---|---|---|---|
| Spotify | L | 6,531 | 97.6% |
| Pocket Casts | AP | 6,508 | 97.3% |
| Apple Podcasts | M | 752 | 11.2% |
| LISTEN | K | 34 | 0.5% |
| Amazon Music | AO | 0 | 0% |
| Pody | AQ | 0 | 0% |
| YouTube | AR | 15（朝ポキTV全件） | — |
最近100行: Apple 72 / LISTEN 33 / Spotify 83 / Pocket Casts 73。→ **最大の欠損はApple・LISTEN・Amazon・Pody**。SDGs・アルキキ・AJWにはApple番組IDが台帳上に無い。

## 共通インターフェース（`public/library/link-discovery.mjs`）
1 EP-ID → サービス別候補 `{state, basis, url}`。状態: CANDIDATE / SAME / URL_CONFLICT / HOLD / CONFLICT / NOT_FOUND / REJECTED（承認後に written）。
- URL形状検証（個別EPのみ）。番組トップ・検索結果・音声(mp3)URLは拒否（`rejectReason`）。
- 強キー: Apple `episodeGuid` == 台帳外部ID。タイトル+配信日のみは HOLD。既存の非空値は上書きしない。
- ポリシー: 1秒間隔・最大3回リトライ・429/5xxバックオフ・24時間キャッシュ・NOT_FOUND/HOLDは7日後再探索。

## 代表EP実測（GitHub Actions・READ ONLY・2026-11-10。開発環境は外部通信が遮断されているため）
| サービス | 実測 |
|---|---|
| Apple lookup | 7番組すべてHTTP 200。**全エピソードに episodeGuid あり**、閲覧URL(trackViewUrl)は個別EP形状。**ただし1回200件まで**（新しい順）。小番組は全件取得（こどもそうだんしつ40/38、スポンジ185/183、ドーナツ83/80）、大番組は最新200件のみ（現場2,665件、MEDIA TALK 1,768件、学校500件） |
| Apple × 台帳 全件dry-run | 台帳の既存M列 746件のうち **745件がApple側と一致**（SAME）、1件のみ別ID（こどもそうだんしつ）。**空欄を埋める候補27件**（現場6・MEDIA TALK4・こども1・スポンジ4・学校4・ドーナツ6・報談2）。番組名不一致0、複数一致0 |
| 既知URLの実在 | Spotify 6/6・LISTEN 3/3・Apple 6/6 が HTTP 200。Pocket Casts は 403（bot遮断。形状検証のみ可能） |
| LISTEN | 番組ページ4件とも200、各ページから個別EPリンク8件を取得（1ページ分）。台帳に番組コードが既知の4番組のみ（現場tvzppbdm・学校pkvcigu2・こどもyhap2rfc・スポンジgqkauao0） |
| Pody | 例の個別ページ200（制作会議 #114）。番組ページ(MEDIA TALK)から個別EPリンク21件を取得。Podyの番組IDと台帳の番組の対応が未整理 |
| Amazon Music | 公式Search APIはclosed betaで利用前提にしない。公開エピソードページ探索は**未実測**（次段） |

## 限界と次の一手
1. Appleの200件上限: 大番組の古い回（現場2,621・MEDIA TALK 1,723・学校305・報談26）は lookup では取れない。別経路（番組ページ/RSSのApple情報/他のAPI）を比較実験する。
2. LISTEN/Pody: 番組ページのEP一覧→題名+配信日で台帳と照合（強キー無し→全件HOLD扱い、人の確認前提）。GUIDが取れるか調べる。
3. Amazon: 公開EPページの探索と形状検証を代表EPで実測。
4. 新着: 台帳に新しい行ができたら、その行だけをApple（GUID強キー）で補完候補化する増分運用（トリガー追加は別途承認）。
5. 出力は候補JSON止まり。台帳への書込は管理人承認後に、#298と同じ書込プロトコル（再読込→空確認→1セル書込→読み戻し→監査ログ）で行う。

実装: `scripts/probe-link-services.mjs`（代表実測）、`scripts/dump-apple-episodes.mjs`、`scripts/match-apple-dump.mjs`（全件dry-run）、`tests/link-discovery.test.mjs`（3件）。候補: `docs/release/2026-11-10-apple-fill-candidates.json`（27件, expectEmpty）。
