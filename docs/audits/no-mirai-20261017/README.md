# ノーミライ #9 実地READ_ONLY調査（2026-10-17）

Issue: https://github.com/Neyito96/asarisunowa/issues/227  
起点: `500e5e775b5d875a6763ff0696780e4d608629bf` / `investigate/no-mirai-keyword-readonly-20261017`

## 結論

**最も有力なのは、#9の実配信が4時台の日次巡回より後だったこと。タイトル判定の不一致は今回の原因として再現しない。**

Spotify公開ページの `music:release_date`、Spotify Show埋め込みの `releaseDate.isoString`、公式RSSの `pubDate` が一致した。

| 対象 | Spotify / RSSのUTC時刻 | 日本時間（Asia/Tokyo） |
| --- | --- | --- |
| #7 | 2026-10-02 19:00 | 10月3日（土）04:00 |
| #8 | 2026-10-09 19:00 | 10月10日（土）04:00 |
| #9 | 2026-10-16 21:35 | **10月17日（土）06:35** |
| 今回の日次実行（ユーザー提示ログ） | — | **10月17日04:38開始、04:39台終了** |
| ポリレビ#15（Spotify埋め込み・RSS） | 2026-10-16 19:00 | 10月17日04:00 |

#9は巡回開始の約1時間56分後、終了後にも約1時間55分後の配信。#7・#8およびポリレビ#15とは巡回との前後関係が異なる。SpotifyのJSON-LDは `datePublished:2026-10-16` という日付だけも返すため、「16日配信」から17日4時台に取得可能だったとは判断できない。

ただし公開メタデータは**現在の値**であり、当日4時台の認証付きSpotify Show API実応答は取得できていない。予約配信がAPIに先出しされる可能性、当時のメタデータ変更、本番コードの相違は未排除。したがって原因は「可能性が高い」とし、確定とはしない。

## 確認済み

1. 現在のSpotify公開プレイリスト埋め込みは#1〜#8の8件。#9 URIは含まれない。Show埋め込みは#9を返し、`isPlayable:true`、`relatedEntityUri:spotify:show:0341I5UOUrJgm7KEvNGInZ`。取得元Show IDの現在の関連は一致。
2. 公式ドーナツRSSはHTTP 200、63件。#9は先頭、#8は7番目、#7は12番目。**RSSの順位はSpotify最新20件に含まれる証明ではない。**
3. 公開シートAPIのGET `?type=playlist` と公開サイトHTMLはいずれもノーミライ `latestDate:2026-10-09`、ポリレビ `2026-10-16`。今回の表示は元データと整合し、ノーミライについてサイトだけの表示遅延を示す証拠はない。
4. GitHub調査ブランチと取得時点のデフォルトブランチの `AutoUpdateAutomationV1.js` / `PlaylistAutoRules.js` はblob SHAが一致。これは**オンライン本番GASとの一致確認ではない**。
5. GitHubコードをVMで実行し、#7・#8・#9の従来タイトルはいずれも既存判定でtrue。#9をShow応答に含め、プレイリストに未登録とすると既存の日次経路・個別追加ヘルパーは#9 URIを1回追加する（通信はモック）。既存URIありなら追加なし。
6. 401/403等のShow取得失敗は例外になる一方、HTTP 200でitemsがない応答は空配列になり成功0件になる。後者の診断不足はローカルで再現したが、本番で発生した証拠はない。

## 問題のコードと実行経路

- `AutoUpdateAutomationV1.js:runAutoUpdateAutomationV1` は activation → bootstrap → 申請由来sync → theme → 固定managedの順。
- `syncDailyManagedAutoPlaylistsV1_` は固定7ルールを巡回する。no-miraiはここに含まれる。
- `syncRecentManagedAutoPlaylistV1_` はShowごとに先頭20件取得 → `matchesAutoPlaylistRule_` → IDで集約 → プレイリストURI差分 → 上限10件 → シートリンク確認 → 個別追加 → 成功分のlatestDate更新。
- `fetchAutoUpdateShowFirstPageV1_` の実URLは `/v1/shows/0341I5UOUrJgm7KEvNGInZ/episodes?market=JP&limit=20`。`fetchAllPages:true` がルールにあっても、この固定日次経路は2ページ目を読まない。途中境界や人間削除の扱いは申請経路と異なるため、同じものとして説明しない。
- `runAutoUpdateBackfillHourlyV1` は申請の活性化・bootstrap専用。補完済み固定ノーミライを毎時巡回する経路ではない。従って6:35配信後、毎時処理が動くだけで#9が拾われるとは限らない。
- `PlaylistAutoRules.js:matchesAutoPlaylistRule_ / extractNoMiraiEpisodeNumber_` はNFKC後の番号付き先頭一致。今回の#9は一致するが、指定されたOR仕様とは異なる。
- `PlaylistAutoSpotify.js:getAllSpotifyPlaylistItems_` はHTTP 200と全ページ取得を確認するが、既存の `Playlist page status:200` 行だけでは対象ルール・Show取得の成否・候補数は分からない。

### 10月17日の実行ログの扱い

過去アップロード「スクリーンショット 2026-10-17 14.28.52.png」「14.29.00.png」の抽出テキストを参照。`runAutoUpdateAutomationV1` 完了とポリレビ#15追加成功はユーザー提示記録と整合。`playlistId/ok/addedCount` の5件配列は、GitHubコードの `syncApprovedAutoUpdateRequestsV1` のログ形式と一致し、固定managedの `key/ok/addedCount/failedCount` とは形式が違う。

**この配列を根拠に「固定no-miraiがok:trueで0件だった」とは確定しない。** Issue本文のその表現はユーザー提示情報として保持しつつ、実際の固定ルート到達は本番全文ログで未検証とする。GASの関数戻り値は既存コードでは自動でLoggerへ記録されない。

## 他の固定連載

| 連載 | 実データ確認 | 判定 |
| --- | --- | --- |
| ポリレビ | 公式RSS最新#15、Spotifyプレイリストにも同回あり。公開シートも10/16 | 今回の最新回欠落なし |
| きのどう | MEDIA TALK RSS最新は「動画**見た**？#50」（9/29 19:00 UTC）。プレイリスト49件中に存在 | 現時点の最新回欠落なし。ただし設定「動画**みた**？」では同タイトルがfalseになる別の再発リスクを確認 |
| 一緒に新聞をめくろう | 公式RSS最新#201（10/4 19:00 UTC）と公開シート日付10/4が整合 | 日付上の更新漏れなし。Spotify埋め込みは古い先頭100件のみのため#201存在・全件一致は未確認 |
| 豊秀一・太田匡彦・佐藤陽 | 同じ固定日次20件経路を共有 | 今回は全7Showの概要・出演者根拠・全プレイリストの認証取得がなく、欠落の有無は未確認 |

## 未確認・アクセス上の制約

- この調査ブラウザーにGASのログインセッションがなく、`script.google.com/home` は一般紹介ページへ遷移。本番「朝リスの輪 プレイリスト投稿受付」のコード・Properties・実トリガー・全文実行ログは取得していない。
- 認証なしで指定Show APIをGETした結果は401。これは**調査側の未認証**であり、本番の認証不具合の証拠ではない。Spotify秘密情報は取得・転記していない。
- 認証付き最新20件への#9含有、当時の返却タイトル・URI、既存URI集合、追加リクエストと結果、本番とGitHubのファイルハッシュ一致は未確認。
- #7・#8のプレイリスト存在と公開時刻は確認。実際にどのハンドラーが何月何日に追加したかの履歴は未確認。
- 本番タイムゾーンは未検証。GitHubのmanifestはAsia/Tokyo。表はユーザー提示ログを日本時間として比較したもの。

## 最小修正案（未適用）

`proposed-only.patch` はレビュー用資料。`scripts/google-apps-script/` の実ファイルは変更していない。

1. no-miraiだけ新戦略 `no-mirai-title-keywords` へ。タイトルに `ノーミライ / 農MUSIC / 猟LIFE` のどれかを含む、NFKC・英字大文字化。番号・括弧・位置は不問。Show取得範囲・プレイリストID・他ルールは変更しない。番号抽出関数は初回#2〜#4専用処理のため残す。
2. 固定巡回に、HTTP status、Show ID、market/limit、cache hit、返却ID、ルール一致ID、既存URI数、追加候補ID、追加成功/失敗数、観測UTC時刻を構造化ログとして追加。トークン・ヘッダー・本文全体は記録しない。
3. ShowのHTTP 200でitems配列がない場合は異常として止める。

このパッチは**配信後に巡回がないという時間差自体を解消しない**。まず本番読み取り確認後、次の日次巡回（10/18 4時台想定）の実結果を確認するのが最小対応。即日反映を要件とするなら、承認後に固定巡回を配信後にも実行する設計を別途検討する。今回はトリガー追加・停止・変更、手動再実行、Spotifyへの#9追加は一切していない。

旧テストの「農M,猟L」という略称だけのタイトルを許容する期待値は、新しい厳密OR仕様とは違う。適用前に旧テストの期待値更新が必要。略称を追加キーワードとして勝手に広げていない。きのどうの表記差対応も今回のパッチには混ぜていない。

また既存固定経路は申請側のhuman_deleted管理を直接参照しない。復旧や巡回経路の拡張前には、人間が削除・停止した対象を再投入しない条件を本番状態と照合する必要がある。この資料はその保護を迂回する実操作を含まない。

## テストと再現

リポジトリのルートで実行：

```sh
node --test docs/audits/no-mirai-20261017/regression.test.mjs
```

Node v24.19.0、**25/25 PASS**。依存パッケージの追加不要。テストは元コードをVMで読み、提案パッチはOSの一時ディレクトリのコピーにだけ適用して読み込む。GAS Properties / Spreadsheet / ScriptAppアクセスは例外で遮断し、Spotify GET/POSTはすべてモック。現在のスケジュール差、既存#9判定、OR条件、他番組混入防止、説明欄だけの誤一致防止、重複回避、失敗時latestDate不変、20件窓・共有キャッシュ、異常200応答、診断ログと秘密非出力を確認。

`git apply --check docs/audits/no-mirai-20261017/proposed-only.patch` も成功。実ファイル適用・本番実行は未実施。既存全GASテストの適用後合格を意味しない。

## 保存物・変更範囲

- `evidence.json`: 公開ソースから抽出したID・時刻・日付・確認範囲と元コードSHA256。認証トークンや公開ページHTML全体は保存しない。
- `regression.test.mjs` / `test-results.txt`: 再現手順と25件の結果。
- `proposed-only.patch`: OR条件と段階ログの提案のみ。

変更はこの監査資料ディレクトリだけ。本番GAS、トリガー、Properties、スプレッドシート、Spotify、公開サイト、独立図書館V3、PRマージは未変更。原因確定に必要な本番読み取り確認を残し、**本番修正は承認待ち**。
