# 朝リスの宇宙｜独立公開サイト移行パッケージ

## 目的
GitHub Pages で公開する独立サイト `Neyito96/asarisu-universe` を用意する。
図書館 `Neyito96/asarisunowa` とは別リポジトリで管理し、図書館公開JSONのみ読み取り専用で利用する。

## 公開候補
`https://neyito96.github.io/asarisu-universe/` （**未公開・未検証**）

## 現時点の移行素材
- `index.html`：V0.6 宇宙探索ラボの独立動作版。外部npm依存なし。
- 図書館JSON: `https://neyito96.github.io/asarisunowa/library/data/manifest.json`
- 各星を選ぶと `/asarisunowa/library/?ep=EP-xxxxx` に遷移。
- 言葉の抽出は暫定の正規表現。星の位置は意味的類似性ではなく配置用計算。出演者のcast欠損に注意。

## 公開手順（新リポジトリが作成された後）
1. GitHubで公開リポジトリ `Neyito96/asarisu-universe` を作成。README付きで初期化し、既定ブランチ `main` を作る。
2. `index.html` を新リポジトリのルートへ追加。
3. Settings → Pages → Build and deployment → Deploy from a branch → `main` → `/(root)` → Save。
4. GitHub Pagesのデプロイ完了を待ち、実URLで表示・リンク・スマホ操作を検証。
5. 公開後、V0.7の改善を独立リポジトリに反映する。

## 実施状況
2026-10-22：既存リポジトリの実験ブランチに移行素材を準備。**独立リポジトリ作成、Pages設定、公開サイト起動は未実施**。
