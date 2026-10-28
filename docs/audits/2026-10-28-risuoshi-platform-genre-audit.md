# リス推し｜配信先・ジャンル自動補完 監査（2026-10-28）

対象: リス推しのみ。ポすすめ、朝ポキの蔵、EP収蔵・補填GASを変更しない。

## 現象
公開iPhone画面（2026-10-28）で「AIニュースブリーフィング / WINSLAJA」（紹介配信日2026-10-27）のサービスアイコンはApple Podcastsのみ。ジャンル表示もなし。これは公開画面の観測であり、バックエンド空欄やSpotify未配信そのものの証明ではない。

## 実装確認（main）
- `scripts/google-apps-script-risu-apple-enrichment.gs`: `RISU_applyAllPlatforms`、`RISU_installDailyEnrichment`（1日1回、プロジェクトTZの4時台）。
- Apple検索API: RSS `feedUrl` 完全照合のみ採用。ジャンルは `primaryGenreName` の生文字列。
- 他サービス: RSS channel内に明記されたURLのみ抽出。Spotify・Amazon等のカタログ照会なし。
- RSSが空欄の行は検索をスキップ。`normalizeFeed` はqueryを無視するため、署名付きFeedの同一性判定に注意。
- `PodcastPlatformSync.js` に `syncRecommendedPodcastPlatforms`、Spotifyタイトル検索、ジャンル正規化の別系統が存在。定期起動とデプロイ状況未確認。
- `docs/risu-apple-enrichment-2026-10-21.md` は実GAS配備・トリガー未確認と記録。GitHub保存だけでは自動実行しない。

## 対応優先順
1. 既存の本番GASに対して読み取り専用で実配備ソース、プロジェクトID、トリガー（旧hourlyを含む）、直近実行ログ、失敗と権限を照合。
2. 「おすすめPodcast」実シートで対象番組のRSS、Apple/Spotify/Amazon/LISTEN/Pocket Casts/stand.fm/Pody/YouTube/ジャンルのセルと公開API A:Rレスポンスを照合。
3. 番組の確実な同一性確認（RSS、Apple feedUrl、Spotify show ID等）に基づく複数ディレクトリ探索を設計。URLをタイトルだけで採用しない。曖昧一致・取得失敗はログへ。
4. Appleの `primaryGenreName` を利用した日本語ジャンル正規化（`normalizePodcastGenre_` 相当）と、意図された表示カテゴリを確認。「その他」だけは確実な上位分類で再判定可能とする。ユーザー指定ジャンルは保全。
5. リス推しのみに統合、単一日次トリガー、差分反映と再発防止テスト。無関係GASは編集不可。
6. 実シート→公開API→iPhone画面まで確認し、サービス別取得成功/未取得理由、最終実行日時を報告。

## 未確認
- 本番GASでのコード配備、トリガー存在、実行成功。
- 対象番組のSpotify公式URL（ウェブ検索では未確認）。
- 実シートの現在値、APIの公開レスポンス。
- クライアント表示が欠落の原因かどうか。

本書はREAD_ONLY監査結果。デプロイ、トリガー操作、本番シート書込みは未実施。
