# 司令塔監査・是正指令｜ポすすめ・リス推し日次巡回 PR #264
日付：2026-10-28
監査対象：PR #264（Draft、起動コード）、コミット 4940829 の実装報告、scripts/google-apps-script/PodcastPlatformSync.js、Spotify.js。
判定：**HOLD / Draft継続。自動書込トリガーの設置・PRマージは未承認。** 表示修正PR #263や本番シートF19/Q19の実施報告と混同しない。

## 確認した成果
- 共通入口 runRecommendationPodcastDailySync() は syncListenerPodcastPlatforms() と syncRecommendedPodcastPlatforms() を別々に呼び、失敗を集約する。
- installRecommendationPodcastDailySync() は同名トリガーの重複登録を防ぎ、列挙された旧ハンドラー3種を検出すると中止する。
- PR #264のコード差分は PodcastPlatformSync.js の追加52行と報告書。朝ポキの蔵の統合GAS・EP台帳のコード変更はない。
- SpotifyのF19登録は利用者提供URLに基づき、Spotify APIによる独立同一性検証は未了。

## P0 是正事項
1. **Spotifyの誤照合禁止**：PodcastPlatformSync.js の resolveListenerPodcastPlatforms_() はタイトルだけを findSpotifyShowByTitle_(title) に渡す。Spotify.js の同関数はタイトル一致した最初の候補を返す。配信者・RSS・公式サイトとの同一性照合がない。タイトルだけで自動書込する経路を停止し、Spotify候補の show ID、タイトル、配信者、公式RSS/既存のApple feedUrl等の独立根拠を組み合わせて一致を確認できた場合のみ空欄へ書く。不一致・曖昧・API欠落は未取得/REVIEW。ユーザー提供のF19 show ID 033KOuSUvlldfHUcl3aQXKを基準に、同名異番組・配信者不一致・RSS不一致・認証失敗を回帰テスト。
2. **Appleの誤照合禁止**：findExactApplePodcast_() はタイトル一致を条件とするが、makerが空なら配信者照合なし、makerが設定されてもAPI側のartistNameが空なら通過する。RSSのfeedUrlと既知のRSS/公式ソースを突合し、候補が複数なら保留。Apple候補のfeedUrlで既存RSSを無検証に置換しない。
3. **「既存値を守る」の例外を明示**：queuePodcastGenreUpdate_() は現在「その他」を具体ジャンルで上書きできる。手動確定「その他」を自動変更しないよう、出典/手動フラグのある行を保護。ジャンルの日本語正規化を両棚で共通化し、原語ジャンルを根拠として残す。
4. **旧トリガーと旧writerを完全棚卸し**：現行installerは RISU_applyAllPlatforms / RISU_applyAppleEnrichment / syncAllPodcastPlatforms のみ検出。syncListenerPodcastPlatforms / syncRecommendedPodcastPlatforms / その他ラッパー、別プロジェクト/別所有者のトリガーは対象外。READ_ONLYでプロジェクト・所有者・全ハンドラー・タイムゾーン・実行ログを確認し、停止対象を限定。ScriptLockは別プロジェクトに効かない。
5. **両棚で列と正本を厳密に区別**：朝リスPodcast と おすすめPodcast は列構造が異なる。ポすすめ＝朝リスPodcast、リス推し＝おすすめPodcast。列名/列数/ヘッダーを実読み検証し、誤シート・誤列ならSTOP。既存の手動値を保護。配信先は番組URLであり、朝ポキの蔵のエピソード個別URLとは別。
6. **同一GAS内の競合・途中失敗対策**：現在の共通入口は各同期関数のロックを個別取得し、2棚を通じた排他ではない。日次起動中の旧トリガーや手動実行との重複を防ぐ運用/ガードを追加。書込直前の空欄再確認、値/数式/保護範囲の確認、再読込、監査・エラー理由を追加。失敗後の再実行は既存値を変更しない。
7. **候補探索の費用管理**：現行関数は全行を走査し、行ごとにSpotify/Apple/RSSのHTTPを呼び得る。時間・HTTP数・再試行時刻・カーソル/処理済みキャッシュを設け、取得失敗で他の棚を停止させない。Podyを含むサービス別の未取得理由を記録。
8. **RSS/URL安全性**：URL取得先は信頼できるHTTPSホストに制限し、リダイレクト・ローカル/内部アドレス・巨大応答・任意URLの無制限取得を避ける。RSSに載る外部リンクを即同一番組とみなさず確認。Pocket Casts follow URLは番組への登録導線であり、実際の番組固有URLと区別する。

## 受入条件
- 回帰テストに、同名異番組、空配信者、複数候補、異なるRSS、Spotify show ID 033KOuSUvlldfHUcl3aQXK、既存F19/Q19保護、手動「その他」保護、両棚列ずれ、旧トリガー重複、途中失敗再実行、URL安全性を含める。
- PR #264はDraftのまま是正コミットを追加。コード修正とテスト結果を提示し、未検証を明記する。
- 本番GASのプロジェクト/ソース/Script Properties/トリガーをread-onlyで確認。本人の承認前に新規トリガーを設置しない。
- 本番GAS試運転はまずREAD_ONLY、次に限定行の書込と再読込・監査。2棚の成功/保留/失敗、各サービスの取得/未取得理由を報告。
- GitHub Pages実表示はPR #263のmainマージと別に実機確認。
- 朝ポキの蔵（EP台帳、収蔵・補填統合GAS、P15_*、15分トリガー）を変更しない。必要なら別プロジェクト/関数境界を確認してから作業する。

## 司令塔の現状
PR #264の差分とソースはGitHub上で直接確認した。GASオンライン実機、現行トリガー、GoogleシートF19/Q19の独立再読込、公開画面はこの監査では未確認。よって実機成功とは主張しない。
