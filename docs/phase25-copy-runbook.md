# Phase25 COPY 実機試験の手順(2026-11-09)

COPY 専用 GAS(スクリプト ID `16qdHt_nojvK…`)だけで行います。本番 GAS・本番シート・本番トリガーには触れません。
各ステップの「承認」は、管理者が事前に承認した場合のみ実行します。

## 本番用と COPY 用の違い(誤接続の防止)

| 項目 | 本番 `P25ProdIo.js` | COPY `P25CopyAdapter.js` |
| --- | --- | --- |
| 状態の保存先 | 本番のスクリプトプロパティ | COPY ブックの `P25_STATE` タブ |
| 依頼元 | 本番の「自動更新申請」 | COPY ブックの「自動更新申請」 |
| 台帳 | 読み取り(本番の台帳) | 同じ台帳を読み取り専用で参照 |
| Spotify トークン | 本番のトークン | COPY のスクリプトプロパティ `P25_COPY_SPOTIFY_ACCESS_TOKEN` |
| 対象プレイリスト | 所有者が P25 のもの | 設定に書いた 1 本だけ。**名前が `[P25-COPY]` で始まらないと拒否** |
| 書き込み | 書き込みスイッチ + 所有者 | `write:true` + 旧処理停止の確認 + 1 本 + 1 回 1 件のみ |
| 所有者・緊急停止 | あり | なし(設定の `write` を false に戻せば止まる) |

- COPY に反映するのは `P25LibraryPipeline.js`、`P25CopyAdapter.js`、`P25CopyOwnership.js`、`P25CopySession20261107.js` の4つだけです。
- `P25ProdIo.js`、`P25Ownership.js`、`P25SpotifyTarget.js` と、本番の他のファイルは COPY に反映しません(本番の ID を参照するため)。
- 本番の状態シート・依頼シートを指定すると、`COPY_ISOLATION_REQUIRED` で止まります。

## 手順

### 0. 準備(管理者の作業)
1. 運用アカウントで、**名前が `[P25-COPY]` で始まる新しい空の非公開プレイリスト**を Spotify で作る。
2. COPY ブックの「自動更新申請」に、そのプレイリストの行を入れる(方式: series または speaker、キーワードを入れる)。
3. COPY プロジェクトのスクリプトプロパティ `P25_COPY_SPOTIFY_ACCESS_TOKEN` に、試験用のトークンを入れる(チャットや GitHub には書かない)。
4. `P25CopySession20261107.js` の `copyPlaylistIds` に、そのプレイリスト ID を 1 本だけ書く。

### 1. 読み取り専用の試験(Spotify への書き込みなし)
| 関数 | 予想される結果 |
| --- | --- |
| `P25_COPY_PREFLIGHT_20261107` | `isolation: PASS`、`requests: 1`、`playlistConfigured: true`、`spotifyWrite: false` |
| `P25_COPY_SEARCH_20261107`(キーワードを編集) | 一致した回の一覧。AM 列「人間除外」と「削除・除外履歴」に該当する回は一覧に出ず、`humanExcluded` に入る |
| `P25_COPY_VERIFY_IDS_20261107`(EP-ID を編集) | `ok` / `missing` / `unplayable` / `notVerifiable` に分かれる(Spotify の GET のみ) |
| `P25_COPY_PREVIEW_20261107` | `members: 0`、`wouldAdd: []`(自動追加は未設定)、`ruleRevision` を表示 |

### 2. 新着自動追加の確認(承認が必要。書き込みなし)
`autoAdd` に `{since:"基準日", revision:"手順1の ruleRevision", shows:["番組名"]}` を設定して、
`P25_COPY_PREVIEW_20261107` を再実行。`wouldAdd` に、基準日より後の同じ番組の回だけが出れば成功です。

### 3. Spotify への追加を最大 1 件(承認が必要)
`write:true`、`legacyWriterDisabled:true`、`maxAdditions:1` に設定し、`P25_COPY_ONE_ADD_20261107` を 1 回実行。
- 予想: `addedVerified: 1`、プレイリストが 1 件、`spotify: VERIFIED` か `READY`(残りがある場合)。
- 続けて 1 回実行しても、同じ回は追加されない。
- 手動で 1 件削除して再実行しても、その回は戻らない(手動削除の確認)。

### 停止と復旧
`write` を `false` に戻せば止まります。追加した回は、試験用プレイリストから手動で削除できます。

## 必要な承認(順番)
1. COPY への 4 ファイルの反映(対象: COPY スクリプト ID `16qdHt_nojvK…` のみ)
2. 試験用プレイリストの作成と、トークンの設定
3. 設定の編集(`copyPlaylistIds`、`autoAdd`)
4. `write:true` での 1 件追加(手順 3)
