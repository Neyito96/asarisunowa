# Phase 19｜6サービス個別URL発見ロボ（2026-11-03）

## 位置づけ
- Phase 18は**候補を個別ページで検証・本番台帳に補填する処理**。約6分間隔の起動を予約済みであり、変更しない。
- Phase 19は**候補URLの新規発見**のみ。公式の番組ページから見つかったタイトル一致リンクを `P15_PLATFORM_CANDIDATES` に蓄積する。候補は未検証であり、台帳への直接書込は禁止。
- 対象6サービスはSpotify、Pocket Casts、LISTEN、Apple Podcasts、Amazon Music、Pody。SpotifyとPocket Castsを巡回順で優先する。
- 実施コード（ローカル成果物）`P19PlatformDiscovery20261103.gs` とモックテストを作成、構文テストと基本安全条件のテスト合格。**GitHubにコード全文は未アップロード。ローカル配布物を本番GASへ追加して使用すること。**

## 安全制約
1. 新規GSファイルに追加し、`Phase15AutonomousBundle.gs`、`P16LiteRecovery20261103.gs`、`P18PlatformUrlBot20261103.gs` を変更しない。
2. 公式7番組のみ。人間除外を尊重、番組＋タイトルの完全一致、重複タイトルを除外。
3. 検証済みの個別URLは既存セルを保護。候補の重複登録を防ぐ。
4. 1巡回で2番組ページまで、候補追加40件まで。全件探索ではなく段階的・保守的な走査。
5. P18に候補シートの1万件制限があるため、P19は9,800件で止めて運用上限を明確化。
6. 本番台帳のK/L/M/AO/AP/AQをP19自身は絶対に書き換えない。Phase18が既存アダプタを用いて検証する。
7. 新規トリガーは**`P19_PREVIEW` 実機結果をレビューしてから** `P19_ENABLE_15MIN` を操作する。P19独自の15分トリガーで動かす。停止は `P19_STOP`。

## 作成済み関数
`P19_PREVIEW`（読み取り専用）、`P19_RUN_ONCE`（候補台帳のみ追加）、`P19_ENABLE_15MIN`（定期化）、`P19_STATUS`、`P19_STOP`、`P19_TICK`。

## 確認すべきログ
`status`、`directories`、`listingPages`、`failedPages`、`candidatesFound`、`candidatesAppended`、`writesToEpisodeLedger:0`。

## 現状と次のゲート
2026-11-03 時点では本番シートに6サービス公式番組ページの一覧がある。台帳は6,661エピソード、6サービス空欄27,118セル（単純空欄であり配信有無は未確認）。本番GASへの追加・実機の `P19_PREVIEW`・トリガー設定は未実施。**Phase 18の自動実行成否もまだ別途要確認**。
