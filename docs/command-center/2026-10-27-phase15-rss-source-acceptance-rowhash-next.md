# 司令塔｜Phase15 E.rss実コード監査受入・rowHash原典確保指令
2026-10-27 JST。READ_ONLYとGitHub監査記録のみ許可。
## 根拠と受入
報告: audit/phase15-online-source-evidence-20261027/docs/command-reports/2026-10-27-phase15-online-rss-function-confirmed.md、提出コミット489ccd0f40c7af47f8a535169a6393c83d7eb14c、GitHub blob d68521eafe325658db6ae9fb6baf11a11cac8d7a。
オンラインからユーザー提供されたrss(feed)の監査文書を司令塔が直接取得した。現時点でE.rssはOmny指定playlist/Megaphone TASCの公式URL制限、UrlFetchApp.fetch(muteHttpExceptions:true)、HTTP200検証、XmlService.parse、channel内itemの全件mapであり、コード内にslice(0,3)/取得件数上限/ページング/再試行/キャッシュ/明示タイムバジェットなし。RSS配信側の件数上限・実通信時間は別問題。
V18が8feed取得→7日以内候補抽出→ledger/history/V3全行読み込み→180秒期限設定、最大10件登録という既確認所見を維持。06:15実行の特定工程はログ不足でUNRESOLVED。7×3はFAST_RSS_SHADOW_V2のREAD_ONLY監視で、収蔵上限ではない。
## P0 次工程
1. COPY Apps Script「朝リスの田_Phase14_COPY_20261023」で`function rowHash(`、`rowHash:`、`rowHash =`、`LibraryOfficialEngine` をエディタの検索で確認。定義元ファイル名と関数全文、参照ヘルパー全文をREAD_ONLYで確保。トークン・秘密情報は共有不可。オンラインコードの関数をGitHub古い同名実装と無条件に同一視しない。
2. 値の起点（55列の getValues/getDisplayValues、型/空欄、列順、JSON.stringify、文字コード、digest、出力hex/base64/大文字小文字）をコードから特定して厳密な再現レシピを作る。定義が見つからなければBLOCKED_ROW_HASH_DEFINITIONを維持。
3. コード確認後、COPY EP-06632〜06636の現行55列値とV3 proofのnative rowHashを独立のオフライン計算で検査。EP-06594は originalRegistrationHashMissing と10/24 currentRowHashおよび今日の現行行を厳密に区別。値が一致しない/形式不明ならHOLD、値は一切修正しない。
4. 本番GASの正式writer実体と接続先のREAD_ONLY調査、7番組＋旧SDGsの公式RSS XML/GUID/pubDate/JST差集合のSOURCE_PENDING解消を別々に継続。別の手段で公式RSSを取得する場合は取得主体・時刻・HTTP状態・完全性を記録し、RSS取得失敗を0件と扱わない。
5. 8番目の旧SDGsは方針未承認。7×3シャドー監視と正式新着全量収蔵を二層で設計検証。V18の最初からのglobal time budget、feed別計測、途中停止・再開、RESERVEDの状態機械はLAB設計として継続。実機コード修正は禁止。
## 報告
まずrowHash定義の証拠（ファイル名/範囲/参照補助関数）をGitHub監査ブランチに保存し、結果を示す。可能なら6件の独立検算結果と本番writer/公式RSSの進捗も加える。
本番EP-06632を保護、COPYのEP-06632〜36番号を本番へ転記禁止。新着本番登録、GAS/trigger復旧、蔵宇宙公開は別承認。COPY ACL STOP、外部リンク12セルHOLDも維持。全非GitHub書込0。
