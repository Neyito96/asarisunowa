# 2026-10-22 JST — おんさ共同編集・作業コピーのREAD_ONLY照合

対象は「作業台コピー1022」`10P8dR7c8x5vu0XaP44cmdzBhv1r-8yXSFCeYs7EBcnc`、比較先は独立図書館`1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4`。認証済みDriveからnative XLSXをストリーム取得し、openpyxl read_only/data_onlyで全件を読む。元シート/台帳/GAS/Spotify/公開への書込み0。

コピー最終更新10/22 08:41:43 JST、台帳最終更新10/21 14:15:23 JST。両方の更新時刻を取得前後で確認し不変。ファイルhash・元URL・取得方法は`audits/2026-10-22-onsa-copy/summary.json`、更新時刻読戻しは`metadata-readback.json`。生XLSXと全列抽出はGit外の非公開作業領域に保持し、寄稿者・備考・連絡先・原文概要はログへ転載しない。

## 見出し・説明・空行を除いた実データ行数

エピソード8タブは全て見出し1行・説明1行を除外し、途中の空行/説明行をエピソードに数えない。今回は8タブのデータ域に空行・不明行・日時欠損なし。「Omnyリンク」列は移行後MP3 URLも含むので、Omnyドメイン行だけを数える誤りを避けた。再配信も掲載されたデータ行として保持する。以下は確定した一意エピソード母集団ではない。

| コピーのタブ | 実データ行 | 同じ番組範囲の台帳行 | 行数差 |
|---|---:|---:|---:|
| ニュースの現場から | 2,653 | 2,641 | +12 |
| メディアトーク | 1,757 | 1,750 | +7 |
| ドーナツ | 67 | 60 | +7 |
| スポンジ | 178 | 173 | +5 |
| SDGs | 1,127 | 1,123 | +4 |
| 報談 | 218 | 218 | 0 |
| ニュースの学校 | 492 | 486 | +6 |
| **音声7タブ計** | **6,492** | **6,451** | **+41** |
| YouTube（音声と別枠） | 1,195 | 朝ポキTV 15 | +1,180 |

台帳保存6,591行のうち、アルキキ100・AJW25・朝ポキTV15を外すと上表の音声6,451行になる。SDGsの比較範囲は旧SDGs1,092＋こどもそうだんしつ31。同じタブに後継があるため別番組のまま照合する。コピーの現在件数が検索ツールの表示フィルター/キャッシュと同一かは未検証。

出演者1,514・記者ページ905・プレイリスト64（A列キー欠損の非空行1を別記）・朝ポキメンバー33は補助タブの有効キー行で、エピソード件数へ足さない。全12タブの物理行・除外行の内訳はsummary.json。

## 行数差だけで登録・削除しない理由

コピー音声の同一source URL共有は290群（余分な掲載行290）、YouTubeは同じ動画URLの重複9群（データ1,195行/URL種類1,186）。音声のsource URL種類6,202もあくまで参照URLの種類数で、正式な収蔵件数ではない。番組の再分類や別タブ掲載、再配信、更新基準日の差を混ぜない。

識別キーで複数の台帳EP-IDを指すものは583コピー行/293群。290群は台帳の主な元URLも同じで、例えばスポンジとニュースに跨がる。残る3群は元URL空欄などと移行後行を跨ぐ：

- EP-00130 / EP-06589（報談、番号/タイトル差あり）
- EP-00128 / EP-06590（報談、タイトル差あり）
- EP-00418 / EP-06591（ニュースの学校、人名表記差あり）

全て保留し、重複削除・EP-ID統合・番組変更は行わない。別チャットの母集団監査へ渡す証拠であり、こちらで確定しない。行数差+41と、対応未確認の音声44行は別の指標。

## 照合結果

| 判定 | コピー行数 | 処置 |
|---|---:|---|
| 一意な識別キー＋番組＋タイトル＋公開日時一致 | 5,778 | 空欄URLの候補化のみ |
| 複数EP-ID/識別情報の競合 | 583 | 保留 |
| タイトル相違 | 61 | 原文と台帳値を残して保留 |
| 公開日時相違（YouTube15を含む） | 41 | 秒の丸めもせず保留 |
| 音声の外部側のみ候補 | 44 | 新規EP-IDを作らず公式RSS確認へ |
| YouTubeの既存対応未確認 | 1,180 | 音声と混ぜず別枠で保留 |
| **合計** | **7,687** | **新規追加/更新0** |

5,778行の内訳はOmny UUID根拠4,659、Megaphone移行ID55、既存の同一個別リンク1,064。GUID/公式UUID（Asahi itemid）を優先し、Omny URL・Spotify個別ID・Pocket Casts個別ID・YouTube IDを別名前空間で扱う。Pocket Casts UUIDをOmny UUIDと見なさない。複数の識別子が別EPを指したらタイトルが一致しても停止。タイトルだけの確定はない。人間除外/削除履歴を尊重する。

音声外部のみ44行の番組別内訳はニュース12、MEDIA TALK7、ドーナツ7、スポンジ5、SDGsタブ4、報談2、ニュースの学校7。これは「44件を追加してよい」という結論ではない。ニュース12行は、前回P0の08:07 JST公式RSS候補12件と**GUIDで12/12一致**（`p0-news-crosscheck.json`）。その他32行は今回のコピー照合では公式RSSへの確認をしていない。V3/Morningの既存検証・採番・承認経路へ渡し、自動登録しない。

## 配信先URLの差分と補完候補

- **21 EP-ID・57セル**の空欄候補：Spotify個別20、公式個別16、Pocket Casts個別21。
- 既存値と同じ配信先16,154セルは変更不要。公式個別URLの既存値と異なる1,068セルは上書きしない。旧SDGsのUUID移行・公式情報更新による差も含むため、元台帳が誤りとは断定しない。
- Asahi itemid=TASC…など階層/形式を確認できない55セルは保留。MP3 URLを公式ページや埋込みURLとして転記しない。GUID/EP-ID/音声URLは補完対象外。
- 候補は共同編集コピーという二次情報であり、リンク先HTTP疎通・実ページ内容は未確認（NOT_HTTP_CHECKED）。候補を「公式確認済み」「再生確認済み」と呼ばない。無効リンクの優先表示をしないため、公開反映や台帳適用より前にリンク先を検証する。

## 保存したログ

同ディレクトリの`audits/2026-10-22-onsa-copy/`：

| ファイル | 内容 |
|---|---|
| summary.json / programme-counts.csv | 入力根拠・定義・番組別件数・判定集計 |
| episode-matches.csv.gz | 全7,687行の対応/根拠/前後タイトル/日時。`gzip -dc`でCSVを取り出せる |
| identity-conflict-groups.csv | 複数EP-ID293群と元URL/タイトル等の比較根拠 |
| source-shared-urls.csv | コピー内の同一source URL共有群（音声290＋動画9） |
| url-fill-candidates.csv | 空欄57セルの現値/候補値/根拠/出典行。実行用更新planではない |
| url-differences.csv | 非空欄URL相違/形式保留。既存値を残す |
| external-only-candidates.csv | 音声44行の識別キー/日時/元シート行。新規登録は未実行 |
| library-unmatched-review.csv | 一意一致に至らない台帳813行の定義別分類 |
| p0-news-crosscheck.json | ニュース新着12候補と前回公式RSSのGUID一致証拠 |
| metadata-readback.json / tests-*.txt | 原本更新時刻の前後確認と試験結果 |

## 実装・再現・試験

`read-onsa-workbook.py`は原本のヘッダー/説明/空行/補助タブを識別し、非公開JSONへ抽出。既存`read-library-workbook.py`で台帳を読む。`tools/onsa/reconcile.mjs`はPR #249の共通URL判定をimportし、収蔵エンジンやトリガーを増やさない。監査PRは#249上に積み、P0 #247/#248には依存を追加しない。

```bash
python scripts/read-onsa-workbook.py PRIVATE_COPY.xlsx PRIVATE_COPY.json
python scripts/read-library-workbook.py PRIVATE_LEDGER.xlsx PRIVATE_LEDGER.json
node scripts/audit-onsa-copy.mjs PRIVATE_COPY.json PRIVATE_LEDGER.json AUDIT_DIR PRIVATE_PROVENANCE.json
node --test tests/onsa-reconciliation.test.mjs tests/platform-evidence.test.mjs
python -m unittest discover -s tests -p 'test_onsa_reader.py' -v
```

Node57/57（新規17＋既存共通化40）、Python3/3成功。識別子競合・再分類候補・日時差・タイトルのみ一致拒否・URL階層・TASC/Omny/Pocket名前空間・人間除外・既存セル不変・入力無変更・移行MP3行の計数・説明/空行除外を検証。CIはREAD_ONLYテストのみ。実GAS/台帳書込み/本番公開なし。
