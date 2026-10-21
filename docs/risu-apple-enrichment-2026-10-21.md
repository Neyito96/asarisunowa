# リス推し Apple Podcasts・カテゴリー補完 — 2026-10-21

## 目的
リス推しだけを対象に、Apple Podcastsリンク、Appleカテゴリー、アートワーク、配信者情報を軽量に補完する。他ページのロードや音声URL自動転記には影響させない。

## 実装
- `scripts/google-apps-script-risu-apple-enrichment.gs` を追加。
- `RISU_previewAppleEnrichment`: READ ONLY、最大8行、Apple Search APIを利用。
- `RISU_applyAppleEnrichment`: 承認後の手動書き込み。既存値を上書きしない。
- RSS URLがAppleの `feedUrl` と正規化後に完全一致したときだけ採用。同名だけの一致は禁止。
- 今回はApple以外のプラットフォームのURLを推測生成しない。各プラットフォームの公式識別子と照合が取れたものだけを将来補完する。

## 現状
2026-10-21朝時点、「おすすめPodcast」シートに8件。最新の「ホンマのホンネ」はRSS `https://feeds.megaphone.fm/TAC5984069945` とSpotify URLが登録済み、Apple Podcasts URLとジャンルは空欄。
GASの本番配備・実行・トリガー登録は未実施。コードをGitHubに保存した段階。

## 実行前の確認
1. 既存GASへ追加し、`RISU_previewAppleEnrichment` を実行してログを確認。
2. 一致があれば `RISU_applyAppleEnrichment` を手動実行。
3. 「おすすめPodcast」シートの更新と、リス推し表示を確認。
4. 定期自動化は実測後に検討（初回からトリガーは作らない）。

## 制約
Apple Search APIに収録されない番組やRSS表記差異は保留。Appleカテゴリーは原語で記録される場合がある。Spotify以外の配信先は未対応。既存の他ページの更新ポリシーは維持。

## 2026-10-21 11時台の追加監査・改修
- 実シート見出しA:Rを確認。F=アートワーク、H=RSS、L=Apple Podcasts、R=ジャンル。新着投稿のRSSは登録済み。
- 重要な不具合を発見: `scripts/google-apps-script-playlist-submit.gs` の `readPodcastSheet` はA:Eしか読み込まず、保存済みのアートワーク、RSS、Apple、ジャンル、他プラットフォームを公開APIに返していなかった。
- 同関数をA:Rの18列返却に修正（commit 02db2ab）。GAS実運用へのデプロイは未実施。
- Apple RSS一致照合の補完GASに専用1時間トリガー登録 `RISU_installHourlyEnrichment` と停止 `RISU_stopHourlyEnrichment` を追加（commit 44e377c）。未配備、未起動。
- リス推しの画像遅延は、閲覧ブラウザーが空欄画像をAppleから取得してもシートへ永続化しないことが一因。F列をバックエンドで補完し、公開APIから返す方式が必要。
- LISTEN / Amazon Music / stand.fm / Pody 等の空欄を正確に自動探索する実装は未完成。推測URLの書き込みはしない。
- 次の必須作業: 実GASの現行コードと比較してA:R返却を反映・デプロイし、Apple補完GASのPREVIEWログを確認、問題なければ手動補完、最後に1時間トリガー登録。別GASプロジェクトに誤適用しない。

## 運用方針の変更（2026-10-21）
ユーザー判断により1時間巡回を取りやめ、**1日1回**の空欄補完へ変更。コードの登録関数は `RISU_installDailyEnrichment`、停止関数は `RISU_stopDailyEnrichment`。毎日4時台（GASプロジェクトのタイムゾーン基準）に実行する設計。空欄がない番組はAPI照会しない。Apple照合はApple関連の4列に限定され、他プラットフォームの空欄は現状まだ補完しない。GAS実環境へのデプロイ・トリガー登録は未実施。前版の1時間トリガーが万一登録されている場合は別途停止確認が必要。

## 全プラットフォーム統合（2026-10-21）
- ユーザー指示によりApple以外の巡回も先送りせず同一の1日1回補完処理に統合（commit 6518558、修正 b4a2c84）。
- `RISU_previewAllPlatforms` / `RISU_applyAllPlatforms` を追加し、専用日次トリガーのハンドラを `RISU_applyAllPlatforms` に変更。
- AppleはApple Search APIの `feedUrl` 一致を根拠にする。Spotify、Amazon Music、YouTube、Pocket Casts、LISTEN、stand.fm、PodyはRSSチャンネルの明示的URLのみ採用。推測検索結果やエピソード内リンクは採用しない。複数候補は保留。
- RSSに明示的リンクがないプラットフォームは空欄が残る。全サービスのディレクトリ検索やサイトスクレイピングを実装したわけではない。補完済み列は上書きしないが、別の空欄が残る番組は日次照会の対象。
- 既存GAS未配備・トリガー未登録。実行前に `RISU_previewAllPlatforms` のログを確認すること。既存のApple専用トリガーがある場合は重複を避けること。

## 2026-10-22 追加依頼・トップページ修正と日次RSS巡回の引き継ぎ
- PR #245: 未精査の独立エピソード図書館へのトップページリンクを削除しmainにマージ。図書館URLそのものは非公開化していない。
- PR #246: 「リス推し／おすすめPodcast」のアートワークを全画面幅で正方形に固定し、日次トリガー停止関数の対象を実ハンドラ `RISU_applyAllPlatforms` に修正。mainにマージ。画像URL自体の恒久補完・表示速度の実機検証は未完。
- 新規登録された番組も含め、「おすすめPodcast」シートの全有効行を**毎日1回**巡回する。各行のRSSを一次的な番組同一性の根拠として、Apple Podcasts、Amazon Music、LISTEN、Pocket Casts、Spotify、YouTube、stand.fm、Pody、番組公式サイトなどのURLと、ジャンル・配信者・アートワークの空欄を安全に補完する。ユーザー発話の「Podcastandhem」はサービス名の確認が必要で、推測で別サービスに置換しない。
- 現行実装 `scripts/google-apps-script-risu-apple-enrichment.gs` はApple Search APIでfeedUrl一致、他サービスはRSSチャンネルに**明示されたURLのみ**採用する。外部ディレクトリを網羅検索する機能ではなく、RSSにリンクがない場合は未補完のまま。各プラットフォームを見つけたふりをしない。
- 新規投稿のRSSが欠損する場合、同名検索だけでURLや画像を確定しない。既存セルは上書きせず、競合・複数候補・不一致は保留。新規登録行も翌日以降に検出できるよう全行走査する。
- **本番未確認:** GitHubの補完GASとA:R列返却修正が稼働GASへ配備されたか、日次トリガーが存在するか、Apple・Amazon・LISTEN・Pocket Casts等の補完が実行されたかは未確認。今の時点で「毎日巡回中」とは報告しない。
- 次回Macで実GASのソース/実行履歴/トリガーをREAD_ONLY照合し、`RISU_previewAllPlatforms` の結果とシート空欄を確認。既存の同名/旧Apple専用トリガーの有無も確認し、二重実行を防ぐ。承認後に既存GASへ差分を適用して1日1回のトリガーを設定し、実シート→公開API→iPhone表示の一連の検証を行う。
- 「ホンマのホンネ」はRSS `https://feeds.megaphone.fm/TAC5984069945` を台帳に持ち、Apple URL・ジャンルが未登録と以前の監査で判明。Apple側の番組ID/リンクはRSS一致の実照合が済むまで書き込まない。画像の遅延はブラウザ側の補完検索に依存している可能性があるため、F列の恒久保存とAPI返却を優先。
