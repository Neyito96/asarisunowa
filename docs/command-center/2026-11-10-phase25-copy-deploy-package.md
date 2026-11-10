# Phase25 COPY 導入パッケージ (2026-11-10)

現状(上書き): COPY GAS・COPY Sheet・試験プレイリスト `1N0T7tMxPMKxXy77C0RPMw`・Client ID・2 scope・token プロパティは **既に存在**。「未設定/作成が必要」の旧記述は無効。ただし token は露出扱い(runbook §7)。保存されていることを成功とはみなさず、GET 結果で判定する。

## 追加するもの(これだけ)
| 項目 | 内容 |
|---|---|
| COPY GAS への追加 | **1ファイル** `scripts/google-apps-script/P25CopyPlaylistCheck.js` を新規ファイル `P25CopyPlaylistCheck`(.gs)として追加。既存ファイルは編集しない |
| 挿入場所 | ファイル一覧の末尾(順序は無関係、関数宣言のみでトップレベル実行なし。`var P25_COPY_CHECK_TARGET_` のみ) |
| 依存(既存) | `p25CopySessionConfig20261107_`(Session)、`p25CopyIo_`(Adapter、隔離ガード)、Script Property `P25_COPY_SPOTIFY_ACCESS_TOKEN` |
| 所有者ID | 管理人入力不要。`GET /v1/me` の id と `owner.id` が一致した場合のみ PASS(別アカウントなら STOP→その時だけ確認) |
| 実行入口 | `P25_COPY_VERIFY_PLAYLIST_20261107`(引数なし) |
| 期待結果(ログ) | `{"status":"PASS","problems":[],"spotifyWrite":false,"memberCount":0,"targetPresent":false}` |
| STOP時 | `problems` の状態コード(HTTP_401/403/429、OWNER_NOT_AUTHORIZED_ACCOUNT、NOT_PRIVATE、SNAPSHOT_CHANGED_OR_MISSING 等)のみ。値・token は出ない |
| 未検証事項 | `/me` が scope 無しで id を返すかは実機未検証。返らなければ ME_UNAVAILABLE で STOP(その場合のみ追加対応を提案) |

## 試験(モック)結果
`node --test tests/gas-*.test.mjs` = 43 件中 43 PASS(新規 5: PASS/membership/各STOP/ページング/entry の GET のみ・token 非出力)。クロスrealm 比較は JSON 正規化に修正。**実機 READ_ONLY は未実施。**

## 実機試験までの残作業(順序固定)
1. [管理人・1回] 承認(下記)+ token 失効・再認可(runbook §7→§5A)。
2. [Claude] 追加ファイル導入 → `P25_COPY_PREFLIGHT_20261107` → `P25_COPY_VERIFY_PLAYLIST_20261107` → PASS 確認。
3. [Claude] EP-06678 の事前確認(GUID/Spotify ID/除外履歴)。公式フィード等 `officialFeedUrls` 設定、`write:true`/`legacyWriterDisabled:true`(COPY のみ)。
4. [Claude] 既承認の最大1件 POST → readback → 再実行 POST 0。
