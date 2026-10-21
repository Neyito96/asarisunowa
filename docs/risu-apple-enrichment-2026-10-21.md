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
