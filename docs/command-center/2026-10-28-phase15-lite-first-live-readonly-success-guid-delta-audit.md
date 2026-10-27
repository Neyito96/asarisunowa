# Phase 15 Lite｜READ_ONLY実機初回成功・差集合解釈の監査指令
2026-10-28 JST 07:26。ユーザーがApps Script `Phase15_Lite_READ_ONLY_TRIAL` の実行ログを提示。
- 実行開始 07:26:04 / 正常終了 07:26:26、約22秒。
- 7番組全部 status=OK。RSS fetched合計5426、GUID一致 existing1235、GUID未一致 unregisteredObserved3909、cross/within feed duplicates282、sourcePending0、ledgerIntegrity OK、sourceCompleteness OBSERVED_RSS_ONLY。
- 内訳：ニュースの現場から 2659/2255/404/0、MEDIA TALK 1760/1626/134/0、こどもそうだんしつ 38/15/23/0、スポンジ181/3/35/143、ニュースの学校496/5/491/0、ドーナツ72/4/50/18、報談220/1/98/121。列は fetched/unregistered/existing/duplicates。
- この実行でREAD_ONLY RSS取得・シート読み込みが実機動作した。自動収蔵の証明ではない。台帳/トリガー/Propertiesへの書込なしというコード境界での評価。ユーザーからログを得ただけで第三者監査したわけではない。
## 緊急解釈
3909は「公式RSSのGUIDが台帳G列と一致しなかった観測候補数」であり未収蔵確定数ではない。特にニュース/ MEDIA TALKで極端に大きいため、プログラムURL/GUID正規化、台帳履歴の配信ソース変更、過去除外基準、番組間重複処理・既存台帳の適用範囲を調査してから欠落を論じる。既存台帳6632件を起点に分類する。
## 次工程 READ_ONLYのみ
1. 最新RSSの各番組GUID数十件と台帳一致・不一致の層化標本。G列のGUIDとRSSの形式の相違、番組判定、日付/除外基準を原因ラベル化。件数/根拠付き、外部への大量データ公開なし。
2. 「過去除外」「GUID/URLが変更」「本当に未登録らしい」「重複」「保留」と分類。新着14日以内など狭い期間から先に実数を算定。全3,909件を収蔵指示しない。
3. 初回実機に成功した `LiteGas.gs` のREST Sheets API + Google Sheets advanced service設定（同一デフォルトGCPでAPI有効化）と readonly scope をLABドキュメントへ反映。ローカルモック21件合格と実機1回成功を区別。追試する場合はユーザー承認を得る。
4. コード修正する場合はLAB GitHub branchだけで、実オンラインGAS・Sheets・Triggersに変更しない。
5. 本番writerは引き続きNO-GO。EP-06632保護、COPY ID移植禁止、旧SDGsの本番収蔵方針保留。
