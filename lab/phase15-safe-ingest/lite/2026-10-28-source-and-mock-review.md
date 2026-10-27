# Phase15 Lite 2026-10-28 source schema and mock adapter verification

司令塔指令 e6bffd4ab4d174c134f877ae11f8d76e97ce313b 全文受領。**LAB-only**、本番/COPY/GAS/trigger/Properties/main/Pages 書込・実行0。

## READ_ONLY 本番スキーマ証拠
本番スプレッドシート `1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4`, `取得元一覧!A1:H12` 直接読取：
- A1 = `番組・取得先`; H1 = `RSS・取得URL`。2～8行が公式7番組：ニュースの現場から、MEDIA TALK、こどもそうだんしつ、スポンジ、ニュースの学校、ドーナツ、報談。
- 7/7のH列URLはLiteCoreのOmny playlist / Megaphone TASCホワイトリストに一致。Omny5件、Megaphone2件。旧SDGs、AJW、アルキキ、YouTubeはLite対象外。
- 台帳G列は既知の `外部ID`（GUID）、今回のAdapterはヘッダーを実行前に検査。これらの見出し不一致はSTOP。
- XMLは channel/item/guid を標準RSS2.0要素として解析。外部HTTP RSSを本ターンで実際に取得しておらず、7番組のXML実体・GUID値・配信側の網羅性は **SOURCE_PENDING**。現行コードでは標準`<guid>`が空ならSOURCE_PENDING。namespace変種の実物への対応は未証明。

## 最小修正
- `LiteGas.gs` に `phase15LiteRunWithDeps(deps)`, `phase15LiteFetchWithDeps(feed,deps)` を追加。実機依存を外部注入可能にし、ローカル・模擬GASでAPI spy可能。
- `取得元一覧` A/Hと台帳Gをヘッダー名で検査。スキーマ差異なら読み取り前にSTOP、取得数0と誤認しない。
- HTTP `followRedirects:false`: 3xxを成功扱いせずSOURCE_PENDING。HTTP非200、HTML応答、RSS root/channel異常、GUID欠損を分離。
- ログ出力は番組・件数・エラーのみ。候補の全文やV原文・トークンはログに含めない。戻り値のみ候補タイトル/リンクを含む。
- 禁止されたAPIを一切呼ばない構造。writer機能/採番/変更なし。

## 合成テスト
`lab/phase15-safe-ingest/lite/adapter.mock.test.js` 追加（Node環境のfake SpreadsheetApp/UrlFetchApp/XmlServiceと禁止API guard）。別途JavaScriptサンドボックスで**実際のGitHub保存済みLiteCore.js/LiteGas.gsを再取得して実行**した6ケースは6/6 PASS：7公式URL allowlist、7番組読み込みとGUID集計、HTTP503→SOURCE_PENDING、HTTP302→SOURCE_PENDING、HTML応答→SOURCE_PENDING、監視された呼出がopenById/fetch以外を含まない（fake range readsは呼出記録対象外）。本件の実測6件に加えて、独立モックテスト8ケースをGitHubへ保存した。**GitHub ActionsとNodeでのコミット済み8ケース全件実行は未実施**。前回のLiteCore13件も今回再実行していない。

## 残る問題と判定
オンラインGASへの設置・実行は未承認。Liteはread-onlyだが実RSSが極端に長い場合の6分timeoutと出力サイズを測定していない。7番組のXML疎通・redirect・GUIDの実際の配信形式は未確認。登録済GUIDの本番実データ全件照合も未実行。実機のCOPY/本番 writer とも別承認。
**LAB SOURCE_SCHEMA_VERIFIED / ADAPTER_MOCK_PARTIAL_PASS / INSTALLATION_NO_GO.** 本番EP-06632を保護しCOPY同番号の本番転用禁止。
