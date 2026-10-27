# 司令塔正式指令｜Phase15 第1・第2報受入／オンラインGAS原典の確保をP0
2026-10-27 JST。READ_ONLY・GitHub監査記録だけ許可。本番/COPY/GAS/トリガー/Properties/main/Pages更新禁止。

## 原本確認
- 第1報 `audit/phase15-rss-hash-writer-gate-20261027/docs/command-reports/2026-10-27-phase15-first-report-rss-writer-gates.md` 提出コミット `9384eae4ccd79e0706ea991a0dafd28b7c103749` GitHub blob `583b2bf7bd7db5ab2331dfbfb0996481c6e680f0`。
- 第2報 `docs/command-reports/2026-10-27-phase15-second-report-hash-safe-resume-design.md` 提出コミット `3c0474bbe14e1e528194ce45f8410762dd28b9aa` blob `aef9543bf30555c745383fa165bd2ebb98357a77`。
両GitHubファイルを司令塔が直接確認。実機GAS現行コード・公式RSS XMLは当方未取得。

## 受入判断
8つのRSS出典URL（7公式番組＋旧SDGs）は特定されたが、Omny/Megaphoneの取得が失敗し、XML/GUID/pubDateの網羅照合はSOURCE_PENDING。HTTPコードは未確定で、配信停止や新着0件とは判定不可。本番全6632件にCOPY候補5件は未検出という先行監査を維持、10/27総欠落件数は未確定。
`LibraryOfficialEngine.rss`・`rowHash`のオンライン定義は未取得。独立hash6件はBLOCKED_ROW_HASH_DEFINITION。EP-06594 originalRegistrationHashMissingと10/24 currentRowHashを区別。COPY新着5件の登録時hashVerifiedは独立検証と同値ではない。
対象本番GASトリガー表示0、COPYトリガー2。Shadow/editor実行は本番writer成功の証明ではない。正式writer経路と他writerは未確認。安全停止・再開案はLAB提案として受入、未実装/未実行。

## P0：オンライン実コード確保（追加の抽象設計より優先）
1. COPY Apps Script `朝リスの田_Phase14_COPY_20261023` のエディタで、検索 `LibraryOfficialEngine`、`rss(`、`rowHash(`。**定義元ファイル名、関数の開始〜終了、参照するURL/設定、呼び出し先、同名関数の有無**をREAD_ONLYで確認。コードの画面コピー/スクショの取得は許容。機密トークン/認証値は必ず除去し、共有しない。
2. `rss(feed)`: UrlFetchApp.fetchやfetchAll/キャッシュ、タイムアウト/リトライ、レスポンス型、RSS parser、最大item数・ソート順/ページング、エラー処理をコードで逐語確認。`E.rss()`へ受渡ししたfeed URLを7番組＋旧SDGs一覧と照合。GitHubの古い同名関数を現行実装と扱わない。
3. `rowHash(row)`: 入力55セルの取得方法とセル型、列順、空値の表現、JSON.stringify/文字コード/ダイジェスト/Base64/hex、正規化の有無を特定。独立実算は正確な仕様と原文取得後に非書込オフラインで実施。差異があればHOLDのまま。
4. 本番 `朝ポキ｜本番ロボGAS` で新着収蔵を実際にappendする可能性のある関数名、参照シートID、公開triggerの実行入口をREAD_ONLY検索し、writer候補を `SOURCE_FOUND/WRITE_PATH_PROVEN/NOT_VERIFIED` に分類。 `phase14ProductionRssFastShadowV2` のようなSHADOWをwriterと推定しない。
5. オンライン全文が一度に取れない場合、**ユーザー向けの最短操作指示**（対象プロジェクト→エディタ検索語→一致した関数の開始/終了スクショ）を準備して、1関数ずつ調査。読み取りだけ。コピペ中の秘密情報をGitHubへ記録しない。

## P1：取得経路のフェイルセーフ
6. 公式RSS 8 URLの失敗は取得主体/HTTP status/response content-type/必要条件/再試行結果を区別して記録。アクセス不可はSOURCE_PENDINGで保留。GAS再実行によるRSS取得は今回禁止。既存の認証済みデータ/公式記事ページがあっても、配信全件のGUID同一性を確認せずにRSS_SUCCESSとしない。
7. 結果が取れた分だけ10/27分のGUID、UTC→JST、公式ページURLと本番GUID/URLの照合を更新。7番組×最新3はREAD_ONLY軽量監視の仕様、正式収蔵の上限として流用しない。
8. 旧SDGsアーカイブの8番目扱いは方針未承認、AJW/アルキキ/YouTubeは除外。EP-06632本番とCOPY ID衝突を保護。新IDはnullのまま。
9. 新規本番登録／オンラインGAS修正・トリガー変更／蔵宇宙公開は別々のユーザー承認。既存WのCOPY ACL STOP、外部リンク12セルHOLD、150件意味品質監査も別ゲート。

## 次報必須
**最初に** `rss()` と `rowHash()` の定義元と実装全文（または取得不能の実機画面根拠）、本番新着writerの関数・対象IDの証拠を報告。取得可能になったらハッシュの独立照合と公式RSS再照合を実施する計画を更新。GitHub監査ブランチ `docs/command-reports/`へ記録、repo/branch/path/commitを添える。non-GitHub write0継続。
