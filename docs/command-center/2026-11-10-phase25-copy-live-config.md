# COPY GAS 実機設定の記録 (2026-11-10 15:05 JST、秘密値なし)

COPY GAS のみ変更。本番GAS/シート/Spotify/トリガー/main は未変更。

| 項目 | 変更後 |
|---|---|
| `copyPlaylistIds` | `["1N0T7tMxPMKxXy77C0RPMw"]`(1件) |
| `officialFeedUrls` | omnycontent の朝日 Omny フィード1件(下記で実証) |
| `playlistNamePrefix` | `朝リス Phase25 COPY試験`(実プレイリスト名「朝リス Phase25 COPY試験 2026-11-07」に合致。実コードは未設定時 `[P25-COPY]` 既定のため、キー削除ではなく実名prefixへ置換) |
| `write` / `legacyWriterDisabled` | `false` / `false` のまま(READ_ONLY完了まで書込み不可) |
| 追加ファイル | `P25CopyPlaylistCheck`(PR 47d2dca版 + `P25_COPY_FEED_CHECK_20261110`) |

## 実機結果
- `P25_COPY_PREFLIGHT_20261107`: isolation=PASS、requests=0。
- `P25_COPY_FEED_CHECK_20261110`: feed HTTP 200、items=2672、**EP-06678 の GUID が存在 (targetGuidFound=true)**、spotifyWrite=false。
- `P25_COPY_VERIFY_PLAYLIST_20261107`: STOP / HTTP_401(保存済みトークン無効)。要 Spotify 本人再認可。
- 未実施: プレイリスト実ID/所有者/非公開/membership のGET検査、EP-06678追加。
