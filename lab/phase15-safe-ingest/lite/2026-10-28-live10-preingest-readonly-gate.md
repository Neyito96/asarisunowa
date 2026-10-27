# Phase15｜LIVE未登録候補10件　本番収蔵前審査・LAB成果（2026-10-28）
指令 commit `d71bff38de78024b107aa0ab22bc7da49aed6f29` 全文確認。対象は2026-10-28 08:13の司令塔報告の21件照合中の未登録候補10件のみ。3,909件の過去未一致調査は行わない。

## READ_ONLY本番検査
本番スプレッドシート `1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4` の `エピソード台帳!A2:J6633` 6632行、`固定ID採番履歴!A2:H1000` 69行、`削除・除外履歴!A2:H1000` 取得行数0を確認。末尾 `EP-06632` はこどもそうだんしつの GUID `a07f0210-b98d-4e6d-9d21-b4c9005ccdfc`、正式履歴の最後も同ID。10件の候補GUIDと完全一致する行は台帳/履歴/取得できた除外記録で0。ただし除外・保留判定の完全性、GUID以外のURL/別名照合、並列採番予約の不存在は未確認。除外シート0行を「除外者0件」と断定しない。

本番エピソード台帳実列：A=台帳ID、B=番組名、C=タイトル、D=配信日時、E=媒体、F=取得元、G=外部ID/GUID、I=元ページURL、J=公式個別URL、O=音声URL、P=再生時間、V=概要原文、W=概要清掃済みなど計55列。履歴は A GUID/B ID/C 番組/D タイトル/E 状態/F 採番日時/G 登録完了/H 台帳行番号。RSS itemの完全metadataは本ターン未取得。履歴69行は全履歴の完全性を別途検証要。

## 10件の収蔵可否確認表
|No|番組|短縮タイトル|GUID|判定|主な未解決事項|
|---:|---|---|---|---|---|
|1|ニュースの現場から|GLOBEイグ・ノーベル賞|93a6a5b8-35f6-447b-abb6-b4ec0061a16e|条件付き候補|原XMLの個別URL、日時、除外・保留照合|
|2|ニュースの現場から|天童よしみ歌の道|ef74feab-7dc0-41ff-923c-b4e400b0ebe0|条件付き候補|同上|
|3|MEDIA TALK|編集マニア#51|f8405029-19db-4278-85d3-b4ea00617b16|条件付き候補|同上|
|4|MEDIA TALK|編集マニア#50|45dbe89c-d322-4c18-864b-b4ea006173e3|条件付き候補|COPY EP-06632と同一GUID、COPY番号の転記厳禁|
|5|こどもそうだんしつ|タコが体の色を変えられるのはなんで #18|69b1b092-5c09-48c8-9936-b4ec00664d97|条件付き候補|原XMLの個別URL、日時、除外・保留照合|
|6|こどもそうだんしつ|タコ墨でお習字|b47f4817-6b1f-41b6-8766-b4ec00665a27|条件付き候補|同上|
|7|スポンジ|サッカー#34|a2cd47a2-b397-4059-98be-b4de0092b380|条件付き候補|同上|
|8|ニュースの学校|MMX|22a8a3b0-ceb5-11f1-8f27-c362e1f68974|HOLD|RSS個別link空欄。公式JSON/配信元URL根拠が必要|
|9|ニュースの学校|イスラエル総選挙2026|48792904-ceb3-11f1-a2e6-7b1c2bd6e6eb|HOLD|RSS個別link空欄。公式JSON/配信元URL根拠が必要|
|10|ドーナツ|ポすすめAIニュースブリーフィング|e474cda9-28f9-4881-9c4f-b4e8008301cf|条件付き候補|原XMLの個別URL、日時、除外・保留照合|

結論：台帳GUID不在は10/10確認、書込可能としての最終承認は**0/10**。通常候補8件は公式RSS itemメタデータと除外・保留/URL identity確認待ち、2件は個別URL未解決HOLD。本番writer一意性・採番予約・原生55列ハッシュ/V3証明未確認。新EP-IDは全件 `null`。

## PREVIEWと合成検証
- `lab/phase15-safe-ingest/lite/live10-preview.js`: 候補10件の固定GUIDセットを、ledger/history/exclusions/holds/URLと照合するオフラインDRY_RUNモジュール。正式EP-IDの提案・発行・予約はしない。既存のEP-IDから算術的な`possibleNextIdForDiscussion`を表示するが、採番権限なし・本番反映不可。履歴予約・ID競合はSTOP、GUID/URL疑義はHOLD。write adapter未収録。
- `live10-preview.test.js`: コミット済みのソースをGitHubから再取得し、隔離JS実行で**11/11 PASS、例外0件**。正式Node CLI実行ではない。候補10件、既存EP-06632保護、未承認停止、台帳GUID既存、RESERVED履歴、除外・保留、学校URL不備、URL identity、採番衝突、冪等性を確認。
- 実際のCOPYシート変更/実機GAS実行なし。本番への部分書込が失敗した場合はトランザクションで原子的に戻せないため、将来のwriterは履歴RESERVED→Ledger→V3→COMPLETE段階と再照合証拠で復旧させる必要がある。今回の成果は書き込み実装ではなく、**書込を防ぐPREVIEWと安全テスト**。完全なwriter接続は未実装で別承認が必要。

## GO/NO_GO
| Gate | 結果 |
|---|---|
| 本番最終ID/保護 | VERIFIED（EP-06632） |
| GUIDが台帳上に存在しない | VERIFIED 10/10 |
| 履歴にGUIDがない | VERIFIED（取得済69行の範囲） |
| URL/別名重複 | PENDING |
| 除外・保留との完全照合 | PENDING |
| 原RSS日時・URL・音声等の完全metadata | PENDING |
| 学校2件の公式item URL | STOP |
| 単一writer/採番権限 | STOP |
| 予約・再開・V3行ハッシュの実装証明 | STOP |
| 新たな本番書込承認 | STOP |

**全件本番登録 NO-GO。** 本番/COPY Sheets、GAS、Properties、triggers、main、Pagesへの書込0。司令塔の指示する次の証拠補完を経て限定承認が必要。
