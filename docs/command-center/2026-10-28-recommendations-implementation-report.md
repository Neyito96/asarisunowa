# 司令塔報告｜ポすすめ・リス推し表示修正・配信先補完・日次巡回整備
日付：2026-10-28
担当：推薦機能専任開発室
対象：ポすすめ（朝日新聞ポッドキャストで紹介された朝リス番組）／リス推し（リスナーのおすすめ）
原則：推薦元と台帳は区別し、アートワーク・配信先補完・ジャンル判定の品質ルールは共通。朝ポキの蔵／EP収蔵・補填エンジンは変更対象外。

## 成果とエビデンス
1. 過去PR #202〜#206を監査。すべてマージ済み。PR #203のCSSクラス流用事故が#204で専用 `.risuoshiSubmitJump` へ修正され、mainでも残存を確認。
2. アートワーク修正 PR #263（https://github.com/Neyito96/asarisunowa/pull/263）をmainへマージ。merge SHA `3c4bfb5fa23b642173b7e85661e5ba46a72259c4`。両棚に専用 `podcastArtworkCard` を付け、正方形枠／画像 `object-fit: contain` を共通化。差分は `app/community.tsx`／`app/globals.css` と監査文書のみ。GitHub Pagesの実公開・iPhone描画は未検証。
3. 正本の「朝ポキ プレイリスト一覧表（作業台）」 `1KSzoIkOsjUagNBLt3IbKIvgWEmez4f0XISQ-jkUjmwQ` を実読み。『AIニュースブリーフィング』／WINSLAJAは「リス推し」の『おすすめPodcast』ではなく「ポすすめ」の『朝リスPodcast』19行目。紹介配信日2026-10-27。F19にSpotify `https://open.spotify.com/show/033KOuSUvlldfHUcl3aQXK` をユーザー提供URLから追跡パラメータ除去して直接登録、Q19にジャンル『ビジネス』を登録。G19 Apple `https://podcasts.apple.com/jp/podcast/aiニュースブリーフィング/id6788020075`、N19 RSS `https://anchor.fm/s/11499d594/podcast/rss`、M19アートワークは既存。最終実読みでF/G/Q値保存を確認。Spotifyページ内部の独立照合はできておらずURL根拠は利用者提供。
4. リス推し専用 `scripts/google-apps-script-risu-apple-enrichment.gs` はApple Search APIのfeedUrl照合とRSS channel内の明示リンク抽出に限定。Spotify等の外部カタログ探索は非実装。コードの存在は本番配備・トリガー稼働を意味しない。
5. 両棚の既存 `syncListenerPodcastPlatforms()` と `syncRecommendedPodcastPlatforms()` を順次呼ぶ共通入口 `runRecommendationPodcastDailySync()`、旧トリガー存在時に登録を中止する `installRecommendationPodcastDailySync()` を `scripts/google-apps-script/PodcastPlatformSync.js` に追加。PR #264（https://github.com/Neyito96/asarisunowa/pull/264）はDraft・未マージ、GitHubコミット `399efcdb0f398d96eb291d92ccea7250571339e2`。稼働GASへの配備もトリガー作成も未実施。

## 重大な残課題／司令塔に求める判断
P0: 本番GASのプロジェクト、現行デプロイ・コード、日次/旧時間トリガー、実行ログをread-only照合。朝ポキの蔵と混同禁止。
P0: Spotifyの同名タイトル検索に誤照合危険性あり。今回のshow ID `033KOuSUvlldfHUcl3aQXK` を回帰事例とし、RSS/配信者/エピソードに基づく確実な同一性チェックを追加してから自動書き込みを有効化。
P1: Apple原語 `primaryGenreName` と共通日本語ジャンル正規化を調整。既存の手動確定値は保持。
P1: 単一日次トリガー、必要なら新着投稿直後の安全な補完。既存トリガー重複・権限/タイムゾーン/失敗ログをチェック。
P1: 実シート→公開API→iPhone画面でアイコンとアートワーク確認、再発防止テスト、成功/未取得理由をサービス別に記録。

## 厳密な状態区分
- 本番反映済み：PR #263のmainマージ、ポすすめF19 Spotify URL、Q19ジャンル。
- 開発ブランチのみ：PR #264共通入口（Draft）。
- 未確認／未完成：公開サイトの表示検証、本番GAS配備、稼働トリガー、全サービス網羅探索、Spotify独立同一性検証。

司令塔への報告は本ファイルの保存であり、司令塔チャットへの自動転送やPR #264の承認・マージを意味しない。
