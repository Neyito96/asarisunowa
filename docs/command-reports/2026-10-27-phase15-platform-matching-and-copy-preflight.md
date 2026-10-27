# Phase15｜共同編集↔本番EP-ID照合、150件品質精査追補、DRY_RUN事前候補（READ_ONLY）

2026-10-27 JST。司令塔指令 `92aad440f6a35f10680a021d7e2e43d41e0cc74c`。本番/COPY/GASトリガー/公開/既存Wの書込 **0**。

## 1. 実測照合：6番組
共同編集原本のA元URLをクエリ除去・末尾slash正規化後、本番I元URLに完全一致させ、さらにタイトルの完全一致を条件とした。日時/GUIDの多軸確定はまだ未実施。**これらは候補一致であり採用確定ではない**。本番側で元URLが重複した307キーは競合/保留。

|番組|原本行|URL+タイトル一致候補|タイトル競合|未一致|本番L空欄で原本Lあり|本番AP空欄で原本Nあり|
|---|---:|---:|---:|---:|---:|---:|
|ニュースの現場から|2658|2380|2|276|12|12|
|メディアトーク|1760|1708|29|23|6|6|
|ドーナツ|72|46|4|22|14|14|
|スポンジ|180|27|0|153|7|8|
|報談|220|89|5|126|0|0|
|ニュースの学校|495|472|9|14|3|3|
|**合計**|**5385**|**4722**|**40**|**623**|**42**|**43**|

注：元URL一意性の問題でmatchedから漏れたものが存在する。タイトル完全一致は表記差による過小推計もあり得る。逆に一致してもGUIDや配信日時をまだ検証していない。補填候補は **L42セル / AP43セル** だが採用確定0。ドーナツのPocket Casts未記載13件は**未記載**として維持し、リンク切れとは呼ばない。SDGs旧表の値を統合していない。

## 2. 15件のCOPY用候補manifest（準備段階であって真のDRY_RUN PASSではない）
下記の個別エピソードでは本番L/AP空欄、共同編集側A元URL＋Cタイトル完全一致、L/Nに個別回形式のURL文字列が存在する。実体URL文字列は共同編集から読み取ったもので、手作りではない。

|EP-ID|対象列|コピー元URL|状態|
|---|---|---|---|
|EP-00003|L|https://open.spotify.com/episode/0XioVSOiu3u5huvtK87Rek|preflight|
|EP-00003|AP|https://pca.st/episode/864bbea3-b1b8-4dfb-9d06-06b1ef4f071c|preflight|
|EP-00002|L|https://open.spotify.com/episode/3immrjmmGQNSec9wRZSWJh|preflight|
|EP-00002|AP|https://pca.st/episode/ea2dab3e-1a98-4c05-beed-991b3211f769|preflight|
|EP-00001|L|https://open.spotify.com/episode/7CqHaZnKM5bGq6rhjuW1ka|preflight|
|EP-00001|AP|https://pca.st/episode/17496f9e-d20a-4b32-9c66-85954538a1d0|preflight|
|EP-06599|L|https://open.spotify.com/episode/64t8ucA5D0O1v1ylB38O1l|preflight|
|EP-06599|AP|https://pca.st/episode/06b7c654-c6ce-467f-a4df-e15b1c9d1f85|preflight|
|EP-06602|L|https://open.spotify.com/episode/3mhjwGaQygFyOi8ApZSPOB|preflight|
|EP-06602|AP|https://pca.st/episode/1132095c-a384-4f77-9b03-3e9ec2b5fd92|preflight|
|EP-06608|L|https://open.spotify.com/episode/5MybPtMGFKI2Saq2Txs9MU|preflight|
|EP-06608|AP|https://pca.st/episode/abc3559b-4f95-4665-ad1d-dcdec79fecd5|preflight|
|EP-06610|L|https://open.spotify.com/episode/1QsyeG1CCwoGCpY0IYPwDa|preflight|
|EP-06610|AP|https://pca.st/episode/8b48f53e-541d-424a-ba33-e7959f36cf2d|preflight|
|EP-06616|L|https://open.spotify.com/episode/6tpaVGWVfDRUHSKWWymCCX|preflight|

対象は15セルで、old=blank、new=上記URL、writes=0。出典は `1CvRyWLQb7YyonGyRSNKtc_liRrgtiWE5yDGI3R48Xfk`。本番 `1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4`。未検査：共同編集旧リンクのHTTP/identity、COPYのEP-ID/GUID再同定・行座標、保護・数式・RichText・validation・V3、ハッシュ及びロールバック。**まだ真正COPY DRY_RUN合格ではない**。承認前のCOPY実書込は行わない。

## 3. 150件回帰検証への追補
第1報に続く149件機械検査に加え、EP-06631を直接読取したため計150件。V原文に`https://x.com/MangaLearn`を確認したが、W/Xの双方に同URLが存在しなかった。ゲスト固有リンクが失われた**実証例**である。EP-06630について関連記事3本はACに存在。単純な「WにURLなし」を誤検知として扱う。全150件の構造・意味品質合格を判定したわけではなく、監査ルールの修正が必要。

## 4. 正式DRY_RUNに向けた停止線
COPY真正DRY_RUNはCOPY実体をREAD_ONLYで再読し、(1)候補EP-ID+GUID+タイトル+配信日、(2)COPY上の現在値、(3)保護範囲/数式/RichText/入力規則、(4)hash/根拠/期待値、(5)再実行時無変更見込み、(6)ロールバック案を各セルについて検査する。ひとつでも未確認なら `pending`。本報告は`preflight_only`、PASSではない。

清掃方針案 `phase15-clean-v0.1-proposal`：公式V保全、Wは意味と記事見出し・ゲスト固有リンク・収録日を保持。既存Wの上書きは提案だけ。蔵は承認済み差分を非公開生成、宇宙はLABキューのみ。公開5848件と人間承認109件は変更禁止。
