# Phase15｜最新3件RESTアダプター受入・独立試験GASへの安全追加ゲート
2026-10-28 JST。LABコミット e4d217b35d0a65ce2c2755acee9fb643de3572dd。
司令塔が LiteLatestThreeGas.gs、latest-three-rest.mock.test.js、検証レポートをGitHubから取得して静的審査。Sheets REST v4 / ScriptApp.getOAuthToken / GET 2範囲、必要ヘッダー、403停止を確認。合成36/36 PASSは担当ロボ実行報告であり、Node CLIや実GASのend-to-end合格ではない。

## 受入範囲
- LAB最新3件選定とREST adapterコードの受入。
- 実機は前日までの試験専用 `Phase15_Lite_READ_ONLY_TRIAL` に限る。既存本番GASやCOPYではない。
- 本番書き込み・採番・トリガー設置は一切許可しない。

## 次工程：最小実機差分の提示
1. 既存試験GAS `LiteCore.gs` と動作済み `LiteGas.gs` を保持し、上書き・削除せず、追加ファイル `LiteLatestThree.gs` / `LiteLatestThreeGas.gs` のみを準備する。
2. 今朝動いた `phase15LiteFetchRss_` と新LABの `phase15LiteFetchWithDeps` は名称が異なり、そのまま追加すると未定義関数になる。新アダプターから既存実機の `phase15LiteFetchRss_` を確実に呼び出すか、同等のRSS処理を独立追加する。新関数の依存関係を完全に提示。
3. `LiteLatestThreeGas.gs` の台帳ヘッダー A/G/I/J の文字列は実機で未照合。読み取り後にSTOPを返す可能性がある。実際の列見出しについて前段の確認証拠がなければ未確認と記載し、編集権限拡張で解決しない。
4. RSSの同一番組内GUID重複・日時不正・多件数の取扱いをレビュー。3件選定の正確性を追試したコードだけを実機へ提示する。
5. 試験用GASへの設置、実行についてはユーザーの明示的承認を得る。コード提示/手順案までは可。実行した場合は最大21件の番組/タイトル/配信日時/登録状態/EP-ID、所要時間とエラーをログで取得。
6. GitHub LABへ最終GAS貼付版（変更が必要なら）と最小手順・コミットを保存。ユーザーに旧`LiteGas.gs`を上書きさせない。トリガー無し、Sheets readonly、RSS GETのみ。

## 判定
LAB_REST_ACCEPTED / ONLINE_TRIAL_ADD_PENDING_APPROVAL / PRODUCTION_WRITER_NO_GO。
