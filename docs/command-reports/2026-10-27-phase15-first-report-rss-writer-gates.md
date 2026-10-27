# Phase15 緊急指令 第1報：RSS / E.rss / Production Writer — 2026-10-27 JST
Directive 6caea9d697ba80fad98859c1785fc4589c088eac. 本番/COPY/GAS/trigger/Properties/公開へのwrites=0。

## 1 RSS収集と当日差集合
COPYの取得元一覧に7公式番組（ニュースの現場から、MEDIA TALK、こどもそうだんしつ、スポンジ、ニュースの学校、ドーナツ、報談）のRSSがある。旧SDGsアーカイブは8番目、V18フィルタを通るが採用方針は未承認。AJW/アルキキ/YouTubeは除外。
2026-10-27実施の公式URL直接取得試行：Omny RSS 6 URLはXML非対応またはアクセス失敗、Megaphone 2 URLはCache miss/取得不可。**XML実体と全itemのGUID/pubDate/音声URLは取得不可**。HTTP statusの403/404だと断定しない。全番組の公式新着総数はSOURCE_PENDINGで未確定。V18の10/27 05:11ログは8 feedからCOPY5件を追加、既存25件、window外6483件。これは公式RSS全日エピソード差集合の代替ではない。
前段独立監査で本番6632件のGUID/official URLにCOPY候補5件は未検出、10/27配信日の登録も0件。したがって候補5件は`COPY_CONFIRMED_PRODUCTION_MISSING; SOURCE_PENDING_RSS_XML`。5=最終未収蔵総数とは宣言しない。

## 2 LibraryOfficialEngine.rss
GitHub指定コミットのrecursive tree/code searchで`LibraryOfficialEngine.rss`実装は特定できず。ユーザー提供のオンラインV18ソースには`for (const feed of feeds) for(const item of E.rss(feed)) ...`のみあり、RSS内全itemをE.rssが返す通り処理する。実際のdownload/parseの上限、fetch timeout, retry, RSSページング、cacheは**ONLINE_FUNCTION_NOT_VERIFIED**。必要なのはCOPY GAS編集画面で`rss(feed)`/ `const LibraryOfficialEngine`を検索し関数全文をREAD_ONLY取得すること。
V19→V18は確認済。V18に180秒deadlineがRSS8フィード取得＋ledger/history/V3全件readの**後**に置かれていること、グローバル予算がないことはソースから確認済。06:15 runtime timeoutの該当停止箇所は証拠不足。

## 4 Production writer
「朝ポキ｜本番ロボGAS」の当時のトリガー画面0件。実行数では10/26の`phase14ProductionRssFastShadowV2`などエディタによるREAD_ONLY/Shadow実行が確認されているが、正式writerの入口とtargetを証明しない。コードには本番IDとCOPY ID定数がある。コード検索、既存プロジェクトの直接確認、別GASプロジェクトのwriter可能性を独立調査する必要がある。オンライン完全実装と本番writer経路はNOT_VERIFIED。COPY V18はCOPY IDにのみ書込、productionWrites0。COPY EP-06632と本番EP-06632の別GUID割当衝突を保護し、正式採番はnull。

## 安全境界
7番組×最新3件はShadow軽量READ_ONLY監視、登録は全新着＋欠損回収の別設計。RSS失敗を新着0としない。正式登録、GAS/trigger復旧、蔵/宇宙公開は各別途承認が必要。WRITE0。
第2報へ移管：LibraryOfficialEngine.rowHashの正確な関数をオンラインで確認しCOPY新着5件とEP-06594のnative55列を独立計算・照合。グローバル予算/永続カーソル/予約復旧のLAB設計。
