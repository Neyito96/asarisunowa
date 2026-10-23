# 概要差異19件と未一致3件：原因分類・比較改善（2026-10-18）

## 根拠と範囲

#222コメント6246514722、実機ログ記録コミットe2ff434（2026-10-18 15:19:26–15:19:59）、コード92ad6c3を再利用。ログの全50EPを復元し、47件の22列「概要原文」既存値とRSS descriptionを比較。追加RSS取得・追加GAS実行・オンライン変更なし。

19件をすべて特定。以下は観測された文字列差であり、編集者や変更時期の推定ではない。

- 9件：RSSにある記事URLに加え案内URL・告知等が既存値にない。
- 10件：RSSにある定型告知・案内URL等が既存値にない（4件には空白の微差もある）。
- 19件のうち18件に広告選択案内の差。1件はその差なし。
- 本文の主張が反対になる等の矛盾は今回の差分では検出していない。URL・告知の欠落は形式差とは分類しない。
- RSS配信後更新／過去の清掃による省略／人手編集のどれが原因かは19件とも未判定。変更前RSS・列22/23の履歴・清掃実行履歴との対応が必要。清掃済み欄の存在だけで原因確定しない。
- 残り28件は比較用の改行・空白正規化で一致。原文の直接一致ではない。実際の値は変更しない。

## 19件の個別判定

比較列はすべて22「概要原文」。23「概要清掃済み」は変更しない。各行の詳細な削除/挿入文字列はschool-description-19-details.jsonに保存。

|EP-ID|タイトル|分類|RSS側にあり既存側にない差分例|判定根拠・推奨処理|
|---|---|---|---|---|
|EP-00083|富山市の人口水増し疑惑|記事URL＋告知URL等の差|https://www.asahi.com/articles/ASV9Z2GQQV9ZPTIL008M.html?iref=omny&nbsp; |ログの同一EP比較。原因履歴は未判定。既存保持・CONTENT_DIFFERENCE保留。|
|EP-00084|臓器移植|記事URL＋告知URL等の差|https://www.asahi.com/articles/ASV7633GFV76UTFL01GM.html?iref=omny&nbsp;|ログの同一EP比較。原因履歴は未判定。既存保持・CONTENT_DIFFERENCE保留。|
|EP-00085|アメリカ中間選挙(2026)|記事URL＋告知URL等の差|https://www.asahi.com/articles/ASV9B0VB8V9BDIFI00QM.html?iref=omny&nbsp; |ログの同一EP比較。原因履歴は未判定。既存保持・CONTENT_DIFFERENCE保留。|
|EP-00086|自由診療|記事URL＋告知URL等の差|https://www.asahi.com/articles/ASV1R2DMYV1RUTFL025M.html?iref=omny&nbsp;|ログの同一EP比較。原因履歴は未判定。既存保持・CONTENT_DIFFERENCE保留。|
|EP-00087|在日コリアン|記事URL＋告知URL等の差|https://www.asahi.com/articles/ASV972PH5V97OXIE04QM.html?iref=omny&nbsp; |ログの同一EP比較。原因履歴は未判定。既存保持・CONTENT_DIFFERENCE保留。|
|EP-00088|PISA(学習到達度調査)|記事URL＋告知URL等の差|https://www.asahi.com/articles/ASV9824DHV98UTIL023M.html?iref=omny&nbsp; |ログの同一EP比較。原因履歴は未判定。既存保持・CONTENT_DIFFERENCE保留。|
|EP-00089|一般討論演説(国連総会)|記事URL＋告知URL等の差|https://www.asahi.com/articles/ASV9P52P1V9PUHBI00VM.html?iref=omny&nbsp; |ログの同一EP比較。原因履歴は未判定。既存保持・CONTENT_DIFFERENCE保留。|
|EP-00090|米中首脳会談(2026年9月)|記事URL＋告知URL等の差|https://www.asahi.com/articles/ASV9S5CY6V9SBQBQ2S5M.html?iref=omny&nbsp; |ログの同一EP比較。原因履歴は未判定。既存保持・CONTENT_DIFFERENCE保留。|
|EP-00091|身寄りのない人の弔い|記事URL＋告知URL等の差|https://www.asahi.com/articles/DA3S16529708.html?iref=omny&nbsp; |ログの同一EP比較。原因履歴は未判定。既存保持・CONTENT_DIFFERENCE保留。|
|EP-00092|彦根城|定型告知・案内URL等の差|&nbsp; ご意見・感想・リクエスト https://bit.ly/asapoki_discord&nbsp; ほかにも多彩な番組を配信中！&nbsp;http://t.asahi.com/womy&nbsp; Learn more about your ad choices. Visit megaphone.fm/adchoices|ログの同一EP比較。原因履歴は未判定。既存保持・CONTENT_DIFFERENCE保留。|
|EP-00094|自律|定型告知・案内URL等の差|&nbsp; ご意見・感想・リクエスト https://bit.ly/asapoki_discord&nbsp; ほかにも多彩な番組を配信中！&nbsp;http://t.asahi.com/womy&nbsp; Learn more about your ad choices. Visit megaphone.fm/adchoices|ログの同一EP比較。原因履歴は未判定。既存保持・CONTENT_DIFFERENCE保留。|
|EP-00095|フーシ|定型告知・案内URL等の差|&nbsp; ご意見・感想・リクエスト https://bit.ly/asapoki_discord&nbsp; ほかにも多彩な番組を配信中！&nbsp;http://t.asahi.com/womy&nbsp; Learn more about your ad choices. Visit megaphone.fm/adchoices|ログの同一EP比較。原因履歴は未判定。既存保持・CONTENT_DIFFERENCE保留。|
|EP-00096|中部電力の浜岡原発データ不正問題|定型告知・案内URL等の差|&nbsp; ご意見・感想・リクエスト https://bit.ly/asapoki_discord&nbsp; ほかにも多彩な番組を配信中！&nbsp;http://t.asahi.com/womy&nbsp; Learn more about your ad choices. Visit megaphone.fm/adchoices|ログの同一EP比較。原因履歴は未判定。既存保持・CONTENT_DIFFERENCE保留。|
|EP-00097|学習指導要領|定型告知・案内URL等の差|&nbsp; ご意見・感想・リクエスト https://bit.ly/asapoki_discord&nbsp; ほかにも多彩な番組を配信中！&nbsp;http://t.asahi.com/womy&nbsp; Learn more about your ad choices. Visit megaphone.fm/adchoices|ログの同一EP比較。原因履歴は未判定。既存保持・CONTENT_DIFFERENCE保留。|
|EP-00098|ベネチア映画祭|定型告知・案内URL等の差|&nbsp; ご意見・感想・リクエスト https://bit.ly/asapoki_discord&nbsp; ほかにも多彩な番組を配信中！&nbsp;http://t.asahi.com/womy&nbsp; Learn more about your ad choices. Visit megaphone.fm/adchoices|ログの同一EP比較。原因履歴は未判定。既存保持・CONTENT_DIFFERENCE保留。|
|EP-00099|核燃料サイクル|定型告知・案内URL等の差|&nbsp; ご意見・感想・リクエスト https://bit.ly/asapoki_discord&nbsp; ほかにも多彩な番組を配信中！&nbsp;http://t.asahi.com/womy&nbsp; Learn more about your ad choices. Visit megaphone.fm/adchoices|ログの同一EP比較。原因履歴は未判定。既存保持・CONTENT_DIFFERENCE保留。|
|EP-00100|概算要求|定型告知・案内URL等の差|&nbsp; ご意見・感想・リクエスト https://bit.ly/asapoki_discord&nbsp; ほかにも多彩な番組を配信中！&nbsp;http://t.asahi.com/womy&nbsp; Learn more about your ad choices. Visit megaphone.fm/adchoices|ログの同一EP比較。原因履歴は未判定。既存保持・CONTENT_DIFFERENCE保留。|
|EP-00409|ふるさと納税|定型告知・案内URL等の差| ご意見・感想・リクエスト https://bit.ly/asapoki_discord&nbsp; ほかにも多彩な番組を配信中！&nbsp;http://t.asahi.com/womy&nbsp; Learn more about your ad choices. Visit megaphone.fm/adchoices|ログの同一EP比較。原因履歴は未判定。既存保持・CONTENT_DIFFERENCE保留。|
|EP-00410|沖縄県知事選(2026)|定型告知・案内URL等の差|&nbsp; ご意見・感想・リクエスト https://bit.ly/asapoki_discord&nbsp; ほかにも多彩な番組を配信中！&nbsp;http://t.asahi.com/womy&nbsp; Learn more about your ad choices. Visit megaphone.fm/adchoices|ログの同一EP比較。原因履歴は未判定。既存保持・CONTENT_DIFFERENCE保留。|

## 未一致3件

|RSS GUID|タイトル|配信日時（JST）|照合結果|
|---|---|---|---|
|cfdd6178-c3bc-11f1-a625-db6a01e1862b|ビール大手のカルテル容疑|2026-10-16 04:00|実機no_identity_match、EP-IDなし|
|c7880fd2-b011-11f1-85c7-13f4dad77055|ニュートリノ|2026-10-15 04:00|実機no_identity_match、EP-IDなし|
|31fe02ee-c6e3-11f1-bce1-e76c16114bcf|簗和生氏の「予算カット」発言|2026-10-14 04:00|実機no_identity_match、EP-IDなし|

追加確認に利用した資料：2026-10-17T01:48:04.646Z取得の保存済み元台帳スナップショット（6591行）。全行をローカル検索し、この3GUIDの記載と完全一致タイトルは0件。現時点の全台帳を新規取得した結果ではない。10/18実機ではGUID・既存アンカーの一致なしを確認済み。

学校のタイトル語句検索では「ビール/カルテル」にEP-00453「アイス大手のカルテルの疑い」（2026-07-01 04:00、GUID 24f7d547-0d59-443e-b4d6-b474008ad678）が1件。ただし対象物・日付・GUIDが異なり、採用しない。「ニュートリノ」「簗/予算カット」は同スナップショット学校行に0件。

保存済み10/18公式RSS（488件）では3GUIDはいずれも1出現。通常のUUID形式で、形式不正や同RSS内GUID重複の証拠なし。RSS移行によるGUID変更・別配信・未登録のいずれかを確定する旧新対応表はない。未登録の可能性はあるが確定せず、3件とも保留維持。推測EP-ID割当・自動新規登録なし。

## 実装と保護

LibraryV3.jsの監査preview専用にlibV3DescriptionNormalize_ / libV3DescriptionCompare_を追加。

- 原文は変更せず、比較用テキストと両原文のハッシュ、規則バージョンを別フィールドで出力。
- 改行表現・空白、限定したHTMLタグ・文字参照を正規化。リンク先URLは保持。
- 未知タグ/属性（hidden、img alt等）は消さずUNSUPPORTED_FORMAT_REVIEW。URL削除/変更、文の追加/削除/意味変更を同等扱いしない。
- EXACT_EQUAL / FORMAT_EQUIVALENT / CONTENT_DIFFERENCE / UNSUPPORTED_FORMAT_REVIEWを区別。
- f.reasonがexisting_value_differsの場合だけ、内容同等なら監査カテゴリをFORMAT_EQUIVALENTへ変更。数式・人間変更状態・除外・GUID競合の保護を優先。
- FORMAT_EQUIVALENTは原文の検証済み判定や上書き許可を意味しない。overwriteAllowed=false。書込関数・libV3Plan_・V1/V2は変更なし。

## ローカル試験

既存152件を先に再実行し152/152合格。追加15件を含め167/167合格。

`node --test tests/gas-library-v3*.test.mjs tests/gas-library-v2-checkpoint.test.mjs`

school-description-tests.txt参照。実ログ47組で28形式同等・19内容差異を再現。改行/空白/HTML/URL/本文/意味変更、人間変更状態・数式・除外・未一致・重複、READ_ONLYを確認。原文・清掃済み値・シート・履歴・Properties・キャッシュ不変。既存の50件上限/カーソル/時間予算試験も回帰合格。

## 次の承認範囲

隔離GAS LibraryV3.gsだけ今回コミットへ更新しpreviewLibraryV3SchoolCandidates()を先頭50件で手動1回。期待は概要28件FORMAT_EQUIVALENT・19件CONFLICT、未一致3件継続。ただし取得元や台帳が変われば件数は変わる。

反映前オンライン92ad6c3全文とSHA-256 7a3fddfde2c4b6b668498aa5130222ab40cba2c184f54bc7889fba763a4f0ceaを再照合。想定外差分・依存欠落なら停止。保存後全文照合。副作用時の復旧先は同ファイル92ad6c3。実行失敗は再実行しない。

今回は隔離反映/実行、台帳・Properties・トリガー・Spotify・本番・サイト・main変更をしていない。
