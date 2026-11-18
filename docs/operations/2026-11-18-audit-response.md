# 監査指摘への回答（2026-11-18 19時・読み取りのみ）

監査メモ「5. Claudeに実行させるべき具体的作業」1〜4 への回答。本番GAS・台帳への書込、マージ操作はしていない（この記録と照合出力の項目追加のみ）。

## 1. 統合先ブランチ feat/v2-ingestion-preflight-20261111 と main の差分の性質
- 分岐点: fbe7b06（2026-11-11）。「173進・182遅れ」はコミット数。ファイルで見ると次のとおり。
- base枝だけの変更: 127ファイル（+18,600 / −11）。ほぼ全部が**新規追加**。
  - scripts/ledger-v2（31）、docs/audits（21）、docs/operations（15）、docs/release（13）、gas/p25v2-copy（8）、gas/summary-cleaner（6）、tests（数件）、.github/workflows（2: p18-p19-reconcile-tests / v2-rss-readonly）
  - scripts/google-apps-script に5ファイル追加（.claspignore、AsarisuSpotifyV2Bridge.js、P25V2HealthAuditReadOnly.gs、P25V2IngestAdapter.js、P26V2PlatformBridge.gs）。**どれも本番「朝リスの輪」GASには無い**（別プロジェクト用）。このまま main に入れると、本番照合（107/107一致）が「GitHubのみ」5件で崩れる → 統合時は別フォルダへ移す必要あり。
- 両方で変更（衝突候補）: 4ファイルだけ
  - app/community.tsx（base枝 +61/−9）、app/desktop-top-nav.css（+55/−1）、app/PlaylistEntryModeBridge.tsx（+10）、public/library/library-core.mjs（+1/−1）
  - いずれも main 側で後から大きく変わっている（タブ統合・検索など）。base枝の古い画面変更は**取り込まず main を正**とするのが妥当（要・管理人判断）。
- main に `gas/` フォルダは無い。
- 「次回 main からデプロイすると巻き戻る」について: 清掃ロボ（COPY）・V2収蔵ボットへの自動デプロイの仕組みは無い（clasp も Actions も無し。反映は毎回エディタへの手動貼り付け）。main には清掃ロボのコード自体が無いので、main から清掃ロボが古いコードに戻ることは起きない。
  - ただし**正本が Draft ブランチにしか無い**のは事実で、ブランチを消すと失われる・レビューされない、という運用上の負債はある。→ Issue を立てて統合方針を決める。

## 2. Spotify 新着の定時実行
- `.github/workflows/spotify-new.yml`: `cron: '40 21 * * *'`（06:40 JST）、`cron: '40 3 * * *'`（12:40 JST）
- main マージは 2026-11-18 18時台のため、**定時の初回は 2026-11-19 06:40 JST**（GitHub の定時は数分〜十数分遅れることがある）。
- 手動実行（workflow_dispatch）と定時実行は同じ手順（取得→照合→変更があればコミット）。違いは起動方法だけ。

## 3. P32 台帳書込→読み戻しのコード（ブランチ feat/p28-patrol・未反映）
- `gas/summary-cleaner/src/CleanerMain.js` の `p32Spotify_()`: matches.json の確定分のうち、台帳の番組・題名が同じで Spotify 欄が空の行だけを計画に入れる。
- 書込は既存の `p29Write_('Spotify', …)` → `p27Write_()`: 書く前に履歴（P27・反映履歴）を PENDING で記録 → 書込 → **台帳を読み直して1件ずつ照合** → 不一致があれば停止旗。取消は `p27Undo_()`（既存）。
- URL の形の確認: `P27_NEW_RE_('Spotify')` = `^https://open.spotify.com/episode/[A-Za-z0-9]{22}$`

## 4. 保留件数の定義（「未確定4件」「HOLD 3」「空欄9件」）
3つは別の数え方で、矛盾はない。

| 数 | 何を数えたか |
|---|---|
| 未確定4件 | EP-06700〜06751（今回の依頼範囲）で Spotify が空のまま残った台帳の行 |
| 空欄9件 | 台帳（公開対象 6,126行）全体で Spotify が空の行 |
| HOLD 3 | Spotify 側の回のうち「保留」と判定した数（台帳の空欄とは別物） |

空欄9件の内訳（matches.json の emptyRows）:
- 範囲内4件: EP-06714・06729・06740（報談・長さが約60秒違う）、EP-06723（スポンジ・約18分違う）
- 範囲外5件: EP-00128・EP-00130・EP-06677・EP-06686（報談・長さが合わない）、EP-06692（MEDIA TALK・Spotify の取得範囲に同じ題名の回が無い）

HOLD 3 の内訳（台帳に空欄は無い）:
- EP-00093 / EP-00686（ニュースの学校「水道料金」）: 同じ番組に同じ題名の行が2つ
- EP-01082・EP-01083（スポンジ）: 台帳に**別の** Spotify URL が入っている（上書きしない）→ 台帳側の値が正しいか、管理人確認の候補
