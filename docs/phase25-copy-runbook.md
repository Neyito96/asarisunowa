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

## COPY への安全な反映方法(clasp)

`scripts/google-apps-script/` で `clasp push` すると、本番用の約90ファイルが COPY に上がり、COPY にだけあるファイルが消えます。**この方法は使いません。**
代わりに、COPY を空フォルダへ取得し、4ファイルだけを重ねます(`scripts/p25-copy-stage.mjs`)。

1. 空のフォルダを作り、COPY プロジェクトを `clasp pull`(スクリプト ID は COPY のもの。本番 ID なら中止)。
2. 点検: `node scripts/p25-copy-stage.mjs <そのフォルダ>`(書き込みなし)。`files` に add / update / same、`preserved` に「触れない既存ファイル」、`deletes` が空であることを確認する。本番の ID・本番専用ファイル(`P25ProdIo.js` など)・`appsscript.json` 欠落があると `ok:false` で止まる。
3. 重ね書き: `--apply` を付けて再実行(4ファイルだけをコピー。`appsscript.json` と既存ファイルは触らない)。
   `--apply` は、反映の前後で全ファイル(サブフォルダ含む)のハッシュを比べ、**変わったのが4ファイルだけ・消えたファイルが0** であることを確認します。違えば中止します。COPY に残るファイルと同名のグローバル関数・定数を4ファイルが定義している場合(`GLOBAL_NAME_COLLISION`)も、コピー前に中止します。
4. `clasp status` で差分を確認し、管理者の承認後に、**そのフォルダから** `clasp push`(`--force` は使わない)。承認依頼には、手順2の点検結果(`files`/`preserved`/`deletes`)と、手順4の `clasp status` の出力を添付する。push 対象に4ファイル以外が含まれていたら中止。

## 旧 `コード.js`(410行)の退避と置換(24関数の重複解消)

調査結果: 旧 `コード.js` は新4ファイルの古い版を連結したもので、定義24件がすべて新4ファイルと同名です(18件は同一、6件は新が上位互換)。
そのため、新4ファイルを足すだけでは同名の関数が二重定義になります(`GLOBAL_NAME_COLLISION` で止まります)。解消は「旧 `コード.js` を COPY プロジェクトから外す」ことで行います。

1. バックアップ: `~/p25-copy-backup/コード.js`(SHA-256 `c3ebf68a692e2fba48d62c1052761de4a4f570c029038c1d9d67742d7a07aa50`)は確保済み。変更しない。
2. 点検(書き込みなし):
   `node scripts/p25-copy-stage.mjs <取得フォルダ> --retire コード.js --backup ~/p25-copy-backup/コード.js --expect-sha c3ebf68a692e2fba48d62c1052761de4a4f570c029038c1d9d67742d7a07aa50`
   `ok:true`、`deletes` が `["コード.js"]` だけ、`retire.replacedByNew` が `retire.definitions`(24)と同数であること。
   バックアップ不一致、SHA が想定と違う、新4ファイルに無い定義が消える(`RETIRE_ORPHAN_DEFINITIONS`)、いずれも中止。
3. 適用(ローカルの取得フォルダのみ): 同じコマンドに `--apply` を付ける。旧ファイルは `<取得フォルダ>-retired/` に複製(SHA 検証つき)してから取得フォルダから外し、4ファイルを重ねる。終了時に「変わったのは4ファイルだけ」「消えたのは コード.js だけ」「全ファイルを通して重複する名前が 0」を検証する。
4. `clasp status` の出力が「4ファイルの追加/更新と コード.js の削除」だけであることを確認。**COPY 上の `コード.js` の削除は `clasp push` で実行されるため、別承認が必要。** `--force` は使わない。
5. 戻し方: push 後に問題があれば、バックアップの `コード.js` と、旧4ファイルを外した状態で再度 push すれば元に戻る(旧ファイルは `-retired/` とバックアップの両方にある)。

## 実機(COPY)での必須条件
- 台帳の AM 列「人間除外」と「削除・除外履歴」シートが読めない場合、処理は停止する(`LEDGER_SCHEMA_MISMATCH` / `EXCLUSION_SHEET_MISSING` / `EXCLUSION_SOURCE_REQUIRED`)。除外データなしでの実行はできない。
- 旧バージョンで保存された状態に `plan.skipped` が無い、または配列でなくても、例外にならず 0 件として扱う。

## 読み取り専用の試験で確認する項目
- 蔵検索(`SEARCH`)、AM 列「人間除外」と「削除・除外履歴」の除外、Spotify ID 照合(`VERIFY_IDS`)、候補プレビュー(`PREVIEW`)は、いずれも Spotify への書き込みも本番データの変更もない。
- テーマ別プレイリスト(管理シートがあるもの)は P25 に切り替えられない(`THEME_MANAGED_BY_V3`)。二重投稿を防ぐため。

## 承認の明確化(Spotify への追加)
手順3は、次の3点を管理者が書面で承認した場合だけ実行します: 試験用プレイリスト 1 本(`[P25-COPY]` で始まる名前)/ 追加するエピソード 最大 1 件(EP-ID を指定)/ `write:true` への変更。EP-00028 は HOLD のまま追加しません。

## 必要な承認(順番)
1. COPY への 4 ファイルの反映(対象: COPY スクリプト ID `16qdHt_nojvK…` のみ)
2. 試験用プレイリストの作成と、トークンの設定
3. 設定の編集(`copyPlaylistIds`、`autoAdd`)
4. `write:true` での 1 件追加(手順 3)
