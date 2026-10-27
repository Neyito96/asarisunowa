# 新着収蔵ロボ Lite — READ_ONLY LAB prototype

**未設置・未実行・本番利用未承認。** 2026-10-27 JST。司令塔の個別確認前にGASへ設置しない。

## ファイル
- `LiteCore.js`: 純粋な照合器。7番組ホワイトリスト、GUID照合、番組別RSS件数/既登録件数/未登録候補/重複/invalid/Error、全体SOURCE_PENDINGを計算。
- `LiteGas.gs`: 将来用GAS読み取りアダプター草案。`SpreadsheetApp.openById` は**本番IDをREAD_ONLY**で開く。台帳G列GUIDと取得元一覧A/H列を `getValues()` で読む。公式RSSをUrlFetchAppで取り、XmlServiceでitemをすべて解析して純粋照合器へ渡しログ出力する。実機コード実行なし。
- `lite.test.js`: 合成テスト。

実行したローカルテスト：`node /mnt/data/lite/lite.test.js` → **13/13 PASS、0 FAIL**（Node v22.16.0）。GitHub上のコミットをActionsで試験したわけではない。GitHub版も `node lab/phase15-safe-ingest/lite/lite.test.js` で独立再実行できるよう用意した。

## 読み取りと安全境界
厳密に7番組（ニュースの現場から、MEDIA TALK、こどもそうだんしつ、スポンジ、ニュースの学校、ドーナツ、報談）のみ。旧SDGs、AJW、アルキキ、YouTubeは含めない。取得失敗、URL不正、未設定、XML異常、GUID欠損はSOURCE_PENDING（取得0件と区別）。複数feed内/間の同GUIDは後発観測側でduplicateに計上。各番組`fetched`, `unregistered`, `existing`, `duplicates`, `invalid`, `errors` と候補GUID/title/pubDate/URLを返す。総件数を本番未収蔵総数と誤称しない。RSS配信側が全履歴を提供した証明はない。`sourceCompleteness=OBSERVED_RSS_ONLY`も網羅保証ではない。

**本番writerではない。** 新しいEP-IDは作らず、採番履歴、台帳、V3、Properties、トリガー、公開データへの書込なし。外部RSSにはREAD_ONLY GETのみ。GAS設置・実行は別承認。将来の正式収蔵エンジンには `liteScan()` のGUID照合・SOURCE_PENDING情報を入口候補として再利用できるが、writerへの接続には単一採番authorityと排他、永続再開などの別検証が必要。

## 検証済みの13シナリオ
7番組のみ、既登録/未登録分類、番組間重複、同一番組重複、HTTP失敗、取得元欠落、不正URL遮断、旧SDGs/AJW除外、取得元重複、台帳GUID重複、GUIDなし、無書込・無採番、RSS並び替え。

## 制約
本番EP-06632は保護対象。COPYの同番号IDの移植は禁止。正式writer未実証、本番復旧NO-GO。オンラインRSSを今回は取得しておらず、当日の全件差集合はSOURCE_PENDING。GAS 6分制限下でRSS全量を毎回解析する処理は未最適化、タイムアウト時の統計は未完となり得る。Liteは新着検出の試作で、本番自動登録エンジンではない。
