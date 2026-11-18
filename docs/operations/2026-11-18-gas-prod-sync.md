# 本番GAS → GitHub 取り込み記録（2026-11-18）

対象: 本番GAS「朝リスの輪 プレイリスト投稿受付」（scripts/google-apps-script/ の正本）
方針: **本番を正**とし、GitHubを本番に合わせた。本番GAS・トリガー・台帳・公開サイトには一切書き込んでいない（読み取りとバックアップのみ）。

## バックアップ
- Driveにプロジェクトの複製を作成: 「BACKUP 2026-11-18 朝リスの輪 プレイリスト投稿受付（本番GAS・トリガーなし）」
  - 複製にはトリガーは付かない（動かない控え）
- 書き出し: Drive API の script+json エクスポート（107ファイル）

## 取り込み前の差分（GitHub main と本番）
- 同一 47 / 内容差 25 / 本番のみ 35 / GitHubのみ 3（.js）
- 本番のみ・内容差の主なもの
  - ポすすめ配信先探索の新版: `PodcastPlatformPipeline.js`（本番のみ）、`PodcastPlatformSync.js`（旧関数名は新版へ委譲）、`PodcastPody.js`、`PodcastSubmission.js`、`PodcastApple.js`、`HttpFetch.js`（取得を予算付きの共通関数へ）
  - Spotify番組判定の修正（2026-11-18）: `findMissingSpotifyPodcastV2_` — 配信者名が朝リスネームと違っても、番組名が完全一致する番組が1つだけなら採用
  - 確認用 `PODCAST_PREVIEW_LOG`（書き込みなし）
  - 自動更新まわりの本番パッチ群（AutoUpdate*V1、PlaylistAutoSpeaker*、ThemeRuntimeV2、SpotifyBudgetV2 など）

## GitHubのみだった3ファイル
本番に存在しないため `scripts/google-apps-script-not-in-prod/` へ移動（削除はしない）。
- AutoUpdateAutomationV1Tests.js / LibraryPhase8ReadOnlyStatus.js / PlaylistAutoPolirebiAudit.js
- 関連テストの参照先だけ変更（tests/library-phase8-readonly-status.test.mjs）

## 取り込み後の一致確認
`node scripts/gas-prod-compare.mjs <書き出しJSON>` → **一致 107/107**、本番のみ・GitHubのみ 0。

## 既知の注意（本番の現状。今回は変更していない）
- 同じファイル内で同名関数が2回宣言されている: ApiCommon.js（normalizeUrl ほか）、AutoUpdateRecoveryPatchV1.js、PlaylistAutoSpeakerTerashita.js。GASでは後の宣言が使われる。
- `launchSatoYoOnsaEpisodesIndividual` が ApiCommon.js と PlaylistAutoSatoYoIndividual.js の両方にある。
- `node --check` はこの3ファイルで「二重宣言」と出るが、本番では動いている。整理は別PRで行う。

## 今後
- 本番エディタで直したら、同じ日のうちに書き出し→照合→PRで取り込む。
- GitHubから本番へ貼るときは、貼る直前に本番と照合し、本番側に未取り込みの変更がないことを確かめる。
