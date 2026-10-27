# Phase15 Lite｜7番組×配信日時最新3件スコープ変更
2026-10-28 JST。司令塔指令 commit 1ffbbba6c03bfc30472886b33deacf20ed43f1e5 を全文確認。

## 実装差分
- `LiteLatestThree.js`: 7公式RSSを取得した場合に pubDate 構文チェック→時刻降順→各番組先頭3件だけ本番台帳GUID/URLと比較。全体候補最大21。URL一致疑い・GUID欠落/多重・invalid timestampを UNKNOWN/SOURCE_PENDINGとする。
- `LiteLatestThreeGas.gs`: 既存本番台帳A:JのA EP-ID/G GUID/I・J 公式URL、取得元一覧A/Hのみを READ_ONLY で読む独立GASアダプター原稿。ヘッダー不一致 STOP。RSS解析関数は既存LAB `phase15LiteFetchWithDeps` を参照。**オンラインGAS設置/実行なし**。
- `latest-three.test.js`: 日期逆順/3件/重複/既登録EP-ID/取得失敗/日時欠落など9合成ケースを追加。
- 本番の総3,909件GUID不一致調査、以前の全件候補分類は新スコープから除外。旧SDGs/AJW/アルキキ/YouTubeはLite対象外。

## 実行したテストと証拠
GitHubに保存した `LiteLatestThree.js`を取得し、隔離JavaScript環境で7つの合成チェックを直接実行：7 PASS / 0 FAIL。チェック：21上限、配信日順、登録済EP-ID表示、横断GUID重複、日時無効のSOURCE_PENDING、feed fetch失敗のnull件数、URL一致によるUNKNOWN。**コミット済み`latest-three.test.js`全9件をNodeで実行したとは主張しない**。既存Liteモック8/8とcore13/13は前工程でPASS済、今回再実行なし。

## 実RSSと21件表の未確定事項
司令塔指令によれば前段のREAD_ONLY実機試験で7 feeds 正常・RSS item 5,426件・約22秒。しかし個別itemのGUID/title/pubDate/linkおよび実行時点の本番台帳GUID/EP-ID結合結果は本工程で入手できていない。従って**現実の7×3件結果表、未登録件数、既登録件数は未確定**。2026-10-28の実RSSへの追加の実行・GAS改変・オンライン実行は承認されていない。新たな実機試験は別承認を要する。RSSの全件網羅性も保証しない。

## 安全判定
LAB_SCOPE_IMPLEMENTED / SYNTHETIC_CHECKS_PASS / LIVE_21_RESULTS_PENDING / ONLINE_DEPLOY_NO_GO。本番EP-06632を保護しCOPY同番号IDを本番へ転記しない。本番・COPY Sheets/GAS/Properties/Triggers/main/Pagesへの書込0。
