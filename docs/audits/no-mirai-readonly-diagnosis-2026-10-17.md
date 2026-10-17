# ノーミライ自動更新｜READ_ONLY診断・修正仕様（2026-10-17）

Issue: https://github.com/Neyito96/asarisunowa/issues/227

## 現象
- 対象プレイリスト `4FBXSFf2nLjLb3qaRoSdoD` に #9 が反映されていない。
- 対象エピソード `13zpJygdFNMMi6WtHbkocV` は公開済み。
- 公開サイトの表示日は10/9のまま。
- ユーザー提示の10/17実行ログで自動処理は完了しており、別連載（ポリレビ）の追加成功も確認できる。
- ログの `ok:true,addedCount:0` は別の増分更新ルート由来の可能性があるため、固定連載ルートの結果と混同しないこと。

## 正しいマッチ条件（ユーザー指定）
取得元は既存のShow ID `0341I5UOUrJgm7KEvNGInZ` に限定し、**タイトル**が次のいずれかを含むなら対象。
- `ノーミライ`
- `農MUSIC`
- `猟LIFE`

OR判定。エピソード番号、括弧、先頭一致は不要。Unicode NFKC、英字の大文字小文字を正規化する。

### 提案コード（未適用）
```javascript
function matchesNoMiraiTitle_(title) {
  const text = String(title || "").normalize("NFKC").toUpperCase();
  return ["ノーミライ", "農MUSIC", "猟LIFE"].some(function(keyword) {
    return text.includes(keyword.normalize("NFKC").toUpperCase());
  });
}
```

`PlaylistAutoRules.js` の `no-mirai-title-prefix` を新しい戦略に切り替える案。ほかのルールの既存動作は変えない。

## テストケース（未実行）
| タイトル | 期待 |
| --- | --- |
| `（ノーミライ #9）ひとりでやっとるチキンレースにライバル登場？というお話` | true |
| `ノーミライ 番外編` | true |
| `農MUSICを語る` | true |
| `猟LIFE の日常` | true |
| `今夜は農music` | true |
| `ドーナツ通常回` | false |
| `ノー ミライ` | false（空白揺れは未承認） |
| 空欄 | false |

## 最優先のREAD_ONLY診断
1. **本番GASの実コード**とGitHubの該当ファイルが同一か確認（GitHubが本番を表すとは限らない）。
2. 本番と同じユーザートークンで `GET /v1/shows/0341I5UOUrJgm7KEvNGInZ/episodes?market=JP&limit=20` の返却IDを確認し、#9の有無を記録。
3. 取得全件数、キーワード一致件数、既存プレイリスト内のID、追加候補件数を別々に記録。
4. `getAllSpotifyPlaylistItems_` のプレイリスト取得HTTP成功と、番組API成功を区別する。
5. 固定連載 `syncDailyManagedAutoPlaylistsV1_` とフォーム申請 `syncApprovedAutoUpdateRequestsV1` のログを区別する。
6. #9が返らない場合、Show ID、地域 `market=JP`、配信反映遅延、ページングを順に検証する。

## 安全条件
このブランチには**仕様・調査資料のみ**保存。本番GAS、トリガー、Properties、Sheets、Spotify、公開サイト、独立図書館V3には変更しない。実際の追加・反映には別途承認を要する。
