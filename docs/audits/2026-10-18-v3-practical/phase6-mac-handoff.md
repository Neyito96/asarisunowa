# Mac実機作業までの引き継ぎ — Phase 6

2026-10-18 / branch `feature/library-v3-archive-core-readonly-20261018`

## この時点の到達点

- 実GAS、元図書館6,591件、コピー台帳、Properties、トリガー、Spotify、公開サイト、本番は**変更していない**。
- GitHubの `scripts/google-apps-script/LibraryV3.js` に、既存RSS・原文・清掃・人物抽出を呼ぶ **手動専用READ_ONLY関数** `previewLibraryV3MacHandoff()` を追加。
- この関数は既存 `previewLibraryV3SchoolCandidates()` を1回呼び、照合成功した先頭の1EPについて、V原文の一致/別版、W清掃生成の安全条件、リンクURL、出演者根拠を要約して返す。**保存はしない**。既存50件プレビューの処理時間（過去約34秒）に依存。
- JS/V8スモークテストを2件実行、成功。継続テスト `tests/gas-library-v3-mac-handoff.test.mjs` を追加。Nodeの全テスト・196テストと実GASのテストは**この段階で未実施**。
- ファイルは現行の隔離GAS `18af81a` に対して直接貼り付ける前に必ず差分と依存を確認すること。作業ブランチは `71114be` の追加内容とPhase6拡張があるため、既存`18af81a`へ単純な差分50行扱いで貼り付けない。

## Macでの次の唯一の操作（ユーザーの新規承認後）

1. GitHub #222の最新記録を確認し、同検証を重複実行しない。
2. 隔離GAS `朝リスの田_Phase2_隔離検証` の `LibraryV3.gs` 全文を退避。オンライン現行を `18af81a` と全文照合する。**不一致なら停止**。
3. 作業ブランチの `scripts/google-apps-script/LibraryV3.js` を取得し、関数名の重複と他ファイルとの依存関係・ガードを点検。保存後、GitHub対象全文との一致を検証。改変対象はこの1ファイルのみ。
4. READ_ONLY `previewLibraryV3MacHandoff()` を手動で**1回のみ**実行。失敗したら再実行せずログと原因を保留。
5. 出力 `mode/status/inspected/matched/held/selected.epId/originalRelation/cleanCandidateSafe/relatedLinkUrls/castNames/writes/propertyWrites` を取得し、 `writes=0`、`propertyWrites=0` を確認。詳細ログは誤って個人情報を公開しないこと。
6. #222に実測結果を記録。コード差分・副作用・例外で停止する。コード復旧先は照合済み `18af81a`。**復旧操作には作業前の退避とオンライン内容の突合が必須**。

**この手順だけではコピー1件の保存は行われない。** 現writerは旧 `libV3Clean_` と `libV2CpParse_` を用いるため、実保存に進む前にwriter変更の分離実装、排他制御、別版サイドカー/関連記事の格納先、逆操作・試験対象EP-ID・セルの承認が必要。

## 実務的な次の作業（Mac不要のコード側）

- 合成テストに加えて、保存済み7番組RSSフィクスチャと6,591台帳の**適切に匿名化したREAD_ONLYスナップショット**で、原文・清掃・関連記事・出演者の構造化候補を比較。
- 本番新着取得はV1/V2・V3を区別した最新実行ログとRSS先頭を確認するまで稼働・停止を断定しない。
- 新着の未一致は台帳再配信・旧GUID等の可能性があるため、新規登録判定 `VERIFIED_NEW` 前に一意照合と除外履歴を評価。

## 実際の安全境界

隔離GASでのコード更新・手動実行はまだ**未承認**。元台帳への書込、コピー台帳/補助タブへの書込、Properties、トリガー、自動運転、Spotify、公開サイト、本番、mainマージは変更禁止のまま。
