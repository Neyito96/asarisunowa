# 2026-10-22 JST — ポすすめ・リス推し・独立図書館の配信先照合

P0はPR #247 / #248に先に保存。本変更はmain58a9977起点の独立PRで、収蔵/V3/Morning/公開ブリッジへ新しい実行エンジンを足さない。#246の正方形CSSと停止関数は変更しない。以下はGitHubコードと実シートの読取結果であり、実GASへの配備証拠ではない。

## 調べて再利用した資産

| 系統 | 既存資産・確認結果 | 今回共通化 | 固有のまま維持 |
|---|---|---|---|
| 旧ポすすめ/朝リスPodcast | `community.tsx`のdiscoverPodcastArtwork、parsePodcastLinks、sortPodcastLinks。GAS PostWrite/PodcastResolve/PodcastUrlResolve/PodcastApple/PodcastPlatformSync | 配信先のドメイン・階層判定、整列順、Apple同一性。既存readPodcastFeedLinks_/Metadata_のXmlService解析を再利用 | listenerPodcastの17列、投稿・推薦文、メール通知、入力URLの保存、既存番組詳細resolver |
| 現リス推し/おすすめPodcast | GAS補完.gs、PostWriteの18列、SheetDataのA:R返却、main #246 | 同じ純粋照合規則と同じRSS解析、番組RSS/Apple ID一致による画像/ジャンル/配信者補完 | 対象シート、空欄書込み、既存日次handlerと停止関数、ブラウザーsnapshot |
| 独立エピソード図書館 | V3/Morning、GUID/UUID・EP-ID・除外履歴、既存exporter | 同じURL階層判定とRSS+GUID/音声+日時/タイトルのREAD_ONLY個別照合API | 採番・台帳書込み・ALIB競合防止・公開承認・JSON/Pages運用 |

`lib/podcast-platform-evidence.mjs`が正本。ブラウザーとNodeは直接importし、GAS用`PlatformEvidence.js`は`node scripts/generate-platform-evidence.mjs`で生成する。CIが生成物の一致を確認し、手編集した別実装を増やさない。GAS Adapterは既存のチャンネル構造解析を呼び、広告説明文・item本文から配信先を探索しない。Atom self/enclosureを番組HPにしない。

旧画像関数は番組名が同じ検索結果の先頭を採用していた。明示Apple番組IDに一致した一意なlookup結果のみへ修正。投稿フォームのApple lookup/slug検索にも同じ判定を使い、`results[0]`で別番組を確定しない。既存のURLからのタイトル候補入力と手入力は維持する。整列順は従来どおりYouTube→Spotify→Amazon→Apple→Pocket Casts→LISTEN→stand.fm→Pody。

リス推し閲覧時のブラウザー画像検索を取り除き、APIの永続画像F列→既存preset→既存placeholderで表示する。旧listener表示でのApple ID lookupは残す。正方形CSSは#246のまま。GAS未配備でF空欄の場合、画像未補完のカードはplaceholderとなるため、公開前にF/APIのPREVIEWと適用承認を先に行う。

## 同一性・URLルール

- RSSはprotocol/host/path/queryを保持（hostだけ小文字化、fragment除去）。パスの大小文字やqueryを捨てて別feedを一致にしない。リダイレクトによる同一性は証明がない限り保留。
- 番組はRSS完全一致または入力されたApple番組IDで一意に照合。両方がある場合は両方の一致を要求。タイトルだけの候補、複数、ID競合はHOLD。
- 個別話は同じRSSに加えGUIDまたは音声URL、正確な公開日時、タイトル、個別URL階層の一致を要求。矛盾/複数/人間除外はHOLD。URLやSpotify IDを推測生成しない。
- YouTube playlistのlist query、Apple個別話のi queryを保持。番組URLと個別話、Pocket Casts follow/importを区別。未知のPody/短縮URLは判定契約を確認するまで保留。
- 原文、EP-ID、GUID、音声URL、既存の補完済みセルは変更しない。関連記事/概要清掃はP0既存経路の担当。

## 公開ディレクトリ/APIの実装範囲

| 配信先 | 今回の取得方法 | 未実装/保留 |
|---|---|---|
| Apple | 公開Search/lookupの番組情報。RSS完全一致/明示番組IDで画像・ジャンル・配信者も確認 | Search上位25候補に出ないfeed、曖昧/取得失敗。番組名だけの確定は禁止 |
| Spotify | RSS channelの明示showリンク/投稿入力のshow URL、既存確定IDの再利用 | 認証APIの利用権限/2026年のアプリ制限未確認。新しい検索/書込みは実行しない |
| Amazon Music | channelの明示podcasts URL | 公開ディレクトリ検索APIを利用できると仮定しない |
| LISTEN | channelの明示/p/番組URL | RSSなしのタイトル検索はしない |
| YouTube | channel/@/playlistの明示リンク | 動画URLは個別、Data API認証の追加なし |
| stand.fm | 明示channels URL | episodesは個別。公開検索API未接続 |
| Pocket Casts | 種別判定のみ。既存入力は保存 | pca.st短縮先の番組確認未実装。followはimportであり同一番組検証済みURLとして書かない |
| Pody | ドメインの判定と原入力保存 | 番組/個別の公開URL契約と公開検索API未確認、自動補完を保留 |

一次資料: [Apple Search API](https://performance-partners.apple.com/search-api)、[Spotify rate limits](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)、[Spotify 2026 migration](https://developer.spotify.com/documentation/web-api/references/changes/february-2026)。Appleは1実行内のメモ化と3.1秒間隔。429を受けたら同実行の追加Apple要求を停止し、後続行をDEFERREDにする。Retry-Afterを短縮して再試行しない。恒久画像はシートへ保存し、画像バイナリのコピーや閲覧ごとの外部検索はしない。

## リス推し日次処理と接続手順（未実行）

1. 実GASのソース・プロジェクトID・配備版・所有者別トリガー・実行履歴をREAD_ONLY取得。今回は管理画面が未認証で取得不能。コード上の想定を「毎日巡回中」と報告しない。
2. 対象シートの最新バックアップと空欄・式・行同一性の差分を保存する。本版の依存は`PlatformEvidence.js`、`PlatformEvidenceAdapter.js`、既存`PodcastPlatformSync.js`/RSS解析の依存（XmlService/normalizePodcastGenre_）、リス推し.gs。旧単独.gsだけの貼り付けでは動かない。稼働ソースとの比較後にまとめて配備する承認が必要。
3. `RISU_previewAllPlatforms()`はセル/Properties/トリガーへの書込み0。8登録行（最新native XLSX、A:R見出し確認）が現在の観測値。データ全行を毎回読み、100行制限を撤廃。新投稿も次回対象。任意の既存`巡回状態`列に除外/無効/停止/inactive/excludedがあれば尊重する。本版は列を新設しない。
4. PREVIEWの候補値、対象セル、根拠、競合とバックアップ/復旧手順を具体化して別途承認後に`RISU_applyAllPlatforms()`。既存ScriptLockを使用。行のURL/タイトル/RSSを再確認し、候補全セルをpreflight、各セルの空欄/数式を直前再検証し、書込み後に読戻す。競合/失敗で停止、verifiedCellsとattempt座標を記録する。RSS/Appleからの文字列を式として書かない。
5. 実行時間予算240秒、対象全行のeligible/deferredを区別する。時間/429で残った行は保留。APPLY時だけ専用`RISU_ENRICH_NEXT_ROW`を保存して次回は続きから開始（既存リス推しPropertiesへの追加変更として承認対象）。全行読取、新着検出を妨げる固定100行制限や無断の継続タイマーは作らない。大量登録時には全API補完が当日完了すると保証しない。
6. `RISU_installDailyEnrichment()`は既存handler `RISU_applyAllPlatforms`を再利用。旧Apple/旧sync handlerとの競合、同名複数なら停止。既存同名1件は追加しない。ただしAPIから既存cadenceを確定できないため管理画面で1日1回か確認する。新規登録は毎日4時台（プロジェクトtimezone基準、正本manifestはAsia/Tokyo）。本番の設定/追加は承認後のみ。
7. 停止は#246済みの`RISU_stopDailyEnrichment()`。無関係・他所有者のトリガーを削除しない。古いhandlerを無断で消さない。復旧は対象セルのバックアップと候補値を照合し、今も自分の書込値のセルのみ個別復元を承認、GASソース/配備版を戻す。継続位置の修正/解除も承認対象。
8. F画像/API18列返却→既存Pages同期→iPhone表示の読戻しを確認。図書館のRSS収蔵/P0公開ブリッジとは独立して運用する。

旧`syncRecommendedPodcastPlatforms`などの書込みループは別の既存運用であり、今回の新しい日次入口として起動しない。旧resolvePodcastUrl/Spotify系に残るtitle由来の補助取得まで一括置換していない。共有したresolveListenerPodcastPlatforms_は上記安全adapterへ委譲するが、古い他入口の全面移行・オンライン一致は未確認。投稿通知/Spotify OAuth・更新の変更なし。

## 回帰テスト

生成GAS一致、8配信先のURL階層、RSS大小文字/queryの衝突、曖昧一致、エピソード人間除外、105行+新投稿、PREVIEW無書込、空欄限定/数式/競合/読戻し、429停止、専用cursor、既存投稿17/18列契約と補完失敗時の投稿継続をNode mockで検証。フロント変更はPages buildと既存UI/GAS/図書館回帰で検証。外部API実照会や本番GASの書込み試験ではない。
