# Phase15 P0｜オンラインGAS証拠採取・当日RSS監査（READ_ONLY）
指令: cb1218ccfe40511593300062debf672e7a2bdc75
GitHub以外の本番/COPY/GAS/公開書込=0。

## オンラインGAS: NOT_VERIFIED
この接続にはGoogle Apps Scriptオンラインのトリガー一覧、Executions、ScriptProperties、配備済みコードを直接読む操作がない。以前のSheets実行履歴・GitHubソースでオンラインGASの挙動を代用しない。ユーザーが該当Apps Scriptプロジェクトを開き、左メニュー「トリガー」（関数名、イベント種別・周期・所有者マスク済み）、「実行数」（2026-10-26～27、特に10/27 05:12 JST付近の実行・例外・duration）、「エディタ」「プロジェクトの設定」（SpreadsheetApp.openById / SHEET_ID の行。本番ID先頭1lLgLzgDNkLN_8okかCOPY ID先頭1IhnYURLqhM8i3ACか）をスクリーンショットで読取。実行/編集/トリガー操作禁止。認証情報、実行主体個人メール、シークレットは必ず除外。スクリプトIDの共有は不要。

## 10/27 新着
本番エピソード台帳全6632行を前段にREAD_ONLYで検査。COPY5件のGUID一致0/5、Omny公式URL一致0/4、10/27配信日時0。本番EP-06632はこどもそうだんしつ。COPY EP-06632は別GUIDのMEDIA TALK。採番衝突1件。
公式Omny配信一覧 https://omny.fm/shows/asahi で下記5件の題名は掲載確認:
- MEDIA TALK 編集マニア #50
- ニュースの学校 イスラエル総選挙（2026）
- ドーナツ （ポすすめ）AIニュースブリーフィング
- ニュースの現場から 天童よしみ朗読
- MEDIA TALK 編集マニア #51
これは**公式ページでのタイトル掲載確認**であり、7番組全RSSのpubDate UTC/GUID/XMLの独立取得を実証するものではない。RSS取得の成功/失敗ログを網羅できないため当日未収蔵の確定総数はUNKNOWN、SOURCE_PENDING。COPYによる当日5候補を確定総数5と誤表記しない。SDGs公式別経路も未検証。

## 安全な採番・復旧
本番EP-06632の改変禁止、COPY既存EP-IDの転記禁止。正式提案IDは全候補null。単一writer、LockService、GUID+元URL冪等性、採番履歴とProperties予約確認、直前の本番全件再照合、write-ahead予約、append後readback、停止時hold/補償操作を別承認。
独立ゲートA:新着本番登録、B:GAS接続・トリガー復旧、C:蔵/宇宙公開。各別承認まで全書込0。
既存W清掃/COPY ACL STOP、Spotify12セルHOLD、150件意味品質監査は別トラック。

## 必要な次証拠
(1) GAS3画面のマスク済み証拠 (2) RSS 7番組＋SDGsのXMLとJST10/27の各item GUID/pubDate/公式URL (3) 本番・COPY採番予約とオンラインプロパティの照合。どれも未確認ならPASSにしない。
