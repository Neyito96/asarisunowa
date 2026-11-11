# 再生可能性チェッカー設計（第41号）— DRAFT・未実装

作成: 2026-11-11 / 状態: **設計のみ。実装・巡回・台帳書込なし。** サービス別の手段は「候補」であり、効果と規約適合は標本試験で確認するまで **未確認**。

## 1. 目的
台帳の各URLについて「ページが開く」と「実際に再生できる」を区別して記録する。HTTP 200 は再生可能の証拠にしない。

## 2. 状態（第41号の定義を採用）
| 状態 | 意味 | 根拠の例 |
|---|---|---|
| DISCOVERED | URLを発見しただけ | 候補JSON |
| EPISODE_VERIFIED | 個別EPと強キーで同定 | GUID完全一致＋日付±1日（マニフェスト） |
| PAGE_REACHABLE | ページが応答 | HTTP 200 + 個別EPページの形 |
| PLAYBACK_VERIFIED | 再生可能性を確認 | 下記「再生の根拠」を満たす |
| PLAYBACK_UNVERIFIED | 確認を試みたが根拠不足 | ログイン要求・JS必須で判定不能 |
| UNKNOWN | 機械的に確かめる方法がない | DRM・アプリ専用 |
| 失敗理由（別欄） | LOGIN_REQUIRED / GEO_BLOCKED / HTTP_403 / HTTP_404 / HTTP_429 / REMOVED / AUTOPLAY_BLOCKED / TIMEOUT | 1回の失敗では状態を下げない |

「再生の根拠」= 次のいずれか（サービスごとに標本で妥当性を確かめる）:
- 音声ファイル（RSS enclosure 等）への **Range リクエスト（先頭数KBのみ）** で 200/206 と音声の Content-Type が返る、かつそのEPページがその音声を指している
- 公式の埋め込み/oEmbed 情報が「そのEPが提供中」を示す
いずれも取れなければ PLAYBACK_VERIFIED にしない。

## 3. サービス別の確認手段（候補・未確認）
| 列 | サービス | 候補手段 | 予想される限界 |
|---|---|---|---|
| J | 公式（asahi.com） | 個別ページ到達＋Omny音声URL(O列)の Range 確認 | ページ仕様変更 |
| K | LISTEN | RSS enclosure の Range 確認＋EPページ到達 | ページはJS描画の可能性 |
| L | Spotify | oEmbed で提供中か確認 | 実再生はアプリ/ログイン依存 → 多くは PLAYBACK_UNVERIFIED の可能性 |
| M | Apple | iTunes Lookup API の episode 情報（第39号の既存プローブ流用） | 地域差 |
| AP | Pocket Casts | 個別ページ到達＋音声URL参照の有無 | — |
| AQ | Pody | 音声URL内 Omny clip GUID（既存標本検証）＋Range | 報談(Megaphone)は GUID なし |
| AO | Amazon | 正当な取得経路が未確立 → UNKNOWN | — |
| AR | YouTube | oEmbed で公開状態確認 | 地域・年齢制限 |
規約（robots.txt・利用規約）に反する取得や制限回避はしない。各サービスの可否は標本試験の前に規約を確認して記録する。

## 4. 実行方式（既存の仕組みを再利用・AI不使用）
- 実行: GitHub Actions（既存 `url-reach.yml`/`link-probe.yml` の流儀）。**READ_ONLY**。重複起動はコミットマーカー（例 `[play-run]`）とconcurrencyで防ぐ。
- 入力: 台帳スナップショット（EP-ID・URL列・O列音声URL）。台帳本文は公開リポジトリに置かない。
- 出力: 結果JSON（EP-ID・列・状態・失敗理由・HTTPコード・確認日時・証跡ハッシュ）を Actions artifact / docs/release に保存。
- 台帳への反映は別工程・別承認。台帳には既に Q「ページ状態」R「音声URL状態」S「再生状態」列があるが、**現状の値の意味を確認してから**、ロボット（LedgerFillRobot）経由で空欄のみ記入を提案する。既存値は上書きしない。

## 5. 量と頻度（無料枠内）
- 1リクエスト/2〜3秒/ホスト、429/503 で指数バックオフ、連続429で当日停止・翌日再開。
- 音声は Range で先頭数KBのみ。全件ダウンロードはしない。
- 初回: 第40号の36セル → 層化標本（番組×年代×サービス、各30件）→ 全件を数日に分割。
- 再確認: PLAYBACK_VERIFIED は月1回、失敗系は週1回。**2回以上連続で同じ失敗**になって初めて「要確認」に上げる。URLの削除・上書きはしない。

## 6. テスト計画（実装時）
モックで: 200だが音声なし→PAGE_REACHABLE止まり／音声206＋audio/mpeg→VERIFIED／403・429・タイムアウト→理由別記録で状態維持／ログイン画面→PLAYBACK_UNVERIFIED／1回失敗で状態を下げない／重複起動拒否。

## 7. 未決事項
- [ ] サービス別手段の規約確認と標本試験（未実施）
- [ ] 台帳 Q/R/S 列の現行値の意味確認（未確認）
- [ ] 結果の保存場所（台帳列 か 別タブ か）の決定（要承認）
- [ ] 実装着手時期（司令塔の指示待ち）
