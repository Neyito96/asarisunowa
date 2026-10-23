# Phase 6｜Mac一度だけ接続する「貼り替え不要」実装パッケージ

**現在の完成物**：`scripts/gas-safe-stage.mjs` は、オンライン隔離GASから正規にpullしたプロジェクトを**ローカルで安全にステージングするだけ**のツール。GAS本番・隔離・トリガー・Properties・スプレッドシートを変更しない。自動配備機能ではない。

## Macでの使い方（実行前に接続・権限確認）

1. Macで最初の一度だけ `clasp` を公式手順に沿って認証し、**隔離スクリプトID**の専用作業ディレクトリへ`clasp pull`。本番GASには決して接続しない。
2. Pullされたディレクトリ（`.clasp.json`, `appsscript.json`, `LibraryV3.gs` を含む）を削除せず保存。現在のオンライン35ファイルと名前・ハッシュを比較。35ファイルは旧監査時点であり、現行が違う場合は**停止し再監査**。
3. GitHubブランチ `feature/library-v3-archive-core-readonly-20261018` の対象 `scripts/google-apps-script/LibraryV3.js` をローカルに取得。未公開ブランチがある場合はGitHub CLI/ZIP等の正式な認証済み取得を使用。
4. 同じレポジトリの `scripts/gas-safe-stage.mjs` を使う。下記は**読み取りとローカルの新しいステージディレクトリ作成だけ**で、オンライン反映は行わない。

```bash
node scripts/gas-safe-stage.mjs \
  --online-dir /path/to/isolated-gas-pull \
  --candidate scripts/google-apps-script/LibraryV3.js \
  --out-dir /path/to/isolated-gas-phase6-stage \
  --script-id 1eLqB-k1XIQz5qqOxamvUlinqld7jwSDO6AkWLx9Zg0ePGsuU7pE4rec-
```

出力: `isolated-gas-phase6-stage.stage-report.json` の `status=STAGED_NOT_DEPLOYED`, `changed=["LibraryV3.gs"]`, `nonTargetUnchanged=true`, `manifestUnchanged=true` をチェック。候補コードに `previewLibraryV3MacHandoff` と関連記事関数がなければ拒否。二重関数宣言、scriptId不一致、既存の出力先、未知のファイル追加・削除は拒否。**何度も貼り付けない**。

**注意：このツールを使うだけでデプロイしてはいけない。** clasp pushは指定ディレクトリの全GASファイルを同期しうるため、対象1ファイルの差分だけと思わないこと。オンライン現状を再取得して、全ファイル/マニフェスト差分とテスト結果を確定した後、特定変更と実行関数について別途承認する。

## テスト状況

- 保存済みGitHubスクリプト本文をV8上で評価し、Nodeファイルシステムの操作部分をインメモリで模擬（ファイル構造4件のモック）。成功シナリオ：1ファイルだけ変更、他ファイルと元コピー保持。異なるscriptId：停止。出力先既存：停止。**3シナリオ期待どおり**。
- `tests/gas-safe-stage.test.mjs` のNode実行ファイルを追加。現環境からプライベートGitHub→ローカルコンテナへ直接ファイル配布できないため、**Node実環境での全テストは未実行**。V8モックは実機claspの保証ではない。
- 旧1007のO/KやRSSを清掃するコードは作業ブランチに残るが、書き込みwriter、GAS実オンライン実行、Spotify・音声を含めた完全自動収蔵は完成していない。

## 原則

一度目のMac操作は**隔離GASのバックアップ/pull→ローカルstage→レポート確認**で止める。オンラインの修正は行わない。その結果を#222にまとめれば、後続はGitHub上で修正し、ローカルの差分・テストを通した同期に一本化できる。
