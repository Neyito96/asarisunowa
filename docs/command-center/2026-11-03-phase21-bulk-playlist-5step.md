# Phase 21｜番組ページ一括照合 — 5-step progress 2026-11-03

## 5 steps completed
1. **朝公式のリンク定義を実査**。GitHub `app/community.tsx` の `officialPrograms` から公式番組7件のSpotify/Apple/Amazon/Pocket Casts/LISTEN/Pody/Omnyボタンの値を確認。対象外アルキキ/AJWは除外。
2. **台帳の配信先URLを照合**。本番スプレッドシート `配信先URL` の7番組の番組リンクと照合。主要リンクは揃う。例外：`こどもそうだんしつ` Amazon Musicの番組リンクは**旧SDGsアーカイブ**を指すため保留。報談Appleは2件あるため自動選択禁止。スポンジPocket Castsは短縮URLなのでリダイレクト確認必須。サイト上のないリンク（ニュースの学校Pody等）は存在しないと断定しない。
3. **再利用するコードを点検**。`scripts/google-apps-script/PlaylistAutoPageMatching.js` に既存のページ照合ユーティリティ。別途本番Phase15の `P15_PLATFORMS.listingEntries` / `classify` を再利用する。**番組ページが個別記事を一括公開する場合だけ**取得可能。無限ページ送りや認証不要を仮定しない。
4. **独立した読取専用実装**：`P21BatchPlaylistPreview20261103.gs` を作成。A:M＋AO:AQから6,661件の台帳索引を1度構築。公式配信先2ページを `UrlFetchApp.fetchAll` で取得して、既存アダプタで検出した個別URL候補を照合。重複タイトルは保留、既存値を保護し、厳格ページ同一性未確認の候補は候補としてのみ報告。**実装の配布ファイルはこの環境の生成成果物であり、現時点でGitHubにはコード全文未保存**。
5. **模擬テスト**：`node --check` と `test-p21.cjs` がPASS。タイトル全角数字正規化、旧SDGsアーカイブ保留、1件の候補発見、書込0を確認。

## 実施禁止／次のゲート
- 既存Phase 16・18・19のGAS/トリガー/本番台帳は変更なし。
- `P21_BULK_PREVIEW` を本番GASに新規ファイルとして導入し、READ_ONLYで実機ログを取得するのが次。
- 実際の番組ページが表示するエピソード数、ページ送り、HTTP 403/429等、GUIDとの個別ページ照合は**未検証**。100倍達成は未実証。
- コードで候補が見つかっても本番補填は実施しない。Phase18/P15の厳格検証を通す。
