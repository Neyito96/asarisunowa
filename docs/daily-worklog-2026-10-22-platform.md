# 2026-10-22 JST — Phase12 旧ポすすめ再利用・独立共通化

P0 PR #247/#248を先に保存し、main58a9977から別ブランチで実装。#230/#243/#244は未マージ、#246はマージ済みを確認。#246の画像CSS/停止関数の再実装なし。本番台帳・GAS・トリガー・OAuth・Spotify・メール・PR merge・公開の変更0。

## 実測と証拠

最新native台帳6591保存行、既存export定義の公開可能6466行（アルキキ100/AJW25を除外）をREAD_ONLY集計。これは母集団精査の確定値ではない。SDGs1092と後継こども31を別番組のまま集計。全番組の日付範囲・外部ID空欄/公式UUID・再配信タイトル候補・動画媒体候補は`audits/2026-10-22-platform/population-readonly.json`。外部ID空欄をGUID不存在と断定しない。

おんさ検索ページはspeakers3.jsを読み、実データ先は`asapoki.yoshimoto.workers.dev`と確認。データ先はHTTP403/error1010。通常のOrigin/Referer付き確認も拒否されたため、それ以上の迂回はしていない。外部の現在件数/定義/行差分はnull・未確認。過去の5429/5449などを現在件数にせず、件数差を削除/追加の根拠にしない。別チャットの監査確定を待つ。行別比較は許可されたエクスポートが必要。

おすすめPodcastはnative XLSXで見出しA:R・8登録行を確認。正本SheetDataは既にA:R返却済みなので旧.gsのA:E修正を再実装しない。実GASの管理画面は未認証で、配備・日次稼働・実行ログは未確認。

## 実装と検証

詳細は[配信先照合と運用手順](platform-evidence-2026-10-22.md)。純粋ルール1正本→GAS生成、旧構造RSS解析再利用、安全なApple照合、番組/個別/取り込みURL区別、既存整列順維持、リス推し閲覧時の画像検索廃止、日次全行/新投稿/空欄/競合読戻し/429/続行cursorを実装。P0には依存させない。

`npm run build:pages`成功、`node --test tests/*.test.mjs`77/77 PASS（新規39+既存38）。生成GASの一致とNode構文確認、git diff --check成功。full tscは既存Cloudflare環境型3件（cloudflare:workers/Fetcher/D1Database）で停止し、今回の変更ファイル由来の診断はない。Pages buildは成功している。GAS実環境/実Spotify/メール送信のテストは実行していない。

残件: GASの現行ソース/トリガー/配備設定を確認し、具体的なPREVIEW値とセル差分/バックアップを提示して配備・適用・日次設定の承認を得る。未知サービスの公開検索API/URL階層を確認する。P0本番接続に必要なbaseline/allowNew/ALIB状態の確認を最優先のまま維持する。
