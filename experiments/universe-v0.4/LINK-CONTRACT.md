# 朝リスの宇宙｜配信先リンクの責任分担（V0.4）

## 役割
- **図書館 / 別司令塔・Work**：EP-IDに対応するSpotify、朝日新聞、Pocket CastsなどのURLを収集・検証・公開JSONの `details/*.json` の `links` 配列へ収録する。既存のリンクがどれだけ収蔵済みかは未監査。
- **宇宙**：EP-IDを使って図書館の詳細JSONを読み、`links` をプラットフォーム別に表示する。独自のURL収集や台帳更新はしない。
- **共通キー**：`EP-00001` 形式のEP-ID。
- **詳細ページ**：`https://neyito96.github.io/asarisunowa/library/?ep=EP-00001` のようにEP-IDで直接リンクできる。

## 実装
`episode-links.mjs` は `libraryEpisodeUrl(id)`、`platformLinks(detail)`、`fetchEpisodeLinks(id)` を提供する。
`fetchEpisodeLinks` は公開 `manifest.json` の `detailBucketSize` から対象 `details/{bucket}.json` を計算し、対象EP-IDの配信先URLだけを抽出する。HTTP(S)以外は無視し、欠落URLは補完しない。

## 次の実装
V0.3のエピソード一覧をリンク付きにし、クリックで図書館詳細へ遷移。さらに「配信先を表示」操作で上記アダプターを遅延実行し、存在するSpotify・朝日・Pocket Casts等のURLを表示する。全エピソード分の詳細JSONを最初から取得しない。

## 受入条件
1. EP-IDが正しい場合のみ図書館詳細リンクを生成する。
2. 収蔵されていない配信先リンクは表示しない。
3. URLは安全なプロトコルのみ許可し、外部リンクは `rel="noopener noreferrer"` で開く。
4. 図書館公開JSONが更新されれば、次回取得時に新しいリンクを参照できる。
5. 図書館の台帳、GAS、Spotifyへの書き込みは一切しない。
6. V0.4のUI結合とブラウザ動作確認は未実施。

## 図書館側への依頼
EP-ID単位の `links` に、Spotify・朝日新聞・Pocket Casts等のエピソード直リンクを保持し、重複・無効URL・番組トップURL混入を監査してほしい。既存公開JSONのリンク収容率は未確認であり、「ほとんど収容済み」は現段階では検証できていない。
