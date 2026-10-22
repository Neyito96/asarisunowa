# 掲載件数の修正 — 2026-10-22・掲載基準承認済み／公開未承認

ユーザーは5,219＋113＋31＋485＝5,848件を正式な掲載基準として承認。「おんさ完全一致5,848件」とは表記しない。本番公開は最終試験後の別途承認が必要。

## 実測

判定ブックの「図書館・宇宙 検索対象判定」A2:J6592を全件READ_ONLY再取得。元台帳A:Bの6591個のEP-ID/番組と1対1一致。人間除外列AMも全件読み、指定なし6591件、削除・除外履歴は見出しのみ。Sheets/台帳への書込0。

|掲載判定D列|件数|
|---|---:|
|対象・確認済み|5848|
|対象外|377|
|保留|366|
|元台帳|6591|

**掲載対象5848 = 学校以外5363 + ニュースの学校485。** 学校の元本486件のうちEP06591は保留のまま。学校485は5848に含まれるので二重加算しない。近似の5500や5936、外部検索件数5452へ数字合わせしない。

C列「おんさ比較対象」とD列「宇宙検索対象」は異なる母集団である。既存の検索/掲載採用を使う今回の5848件の内訳は以下。

|内訳|件数|
|---|---:|
|C列でも比較対象、D列でも採用|5219|
|C列では保留だが、D列で公式識別子/タイトルの同一性を確認して採用（日時差分）|113|
|後継番組こどもそうだんしつ（C列比較外、D列採用）|31|
|ニュースの学校（C列比較外、D列採用）|485|
|D列の採用合計|5848|

厳密に「C列対象＋学校」だけなら5704件であり、5848件との差144件は上記113＋31。今回の掲載基準はユーザー承認によりD列採用5848件を用いる。この144件を隠して「おんさ採用5500件」と説明しない。

|番組|掲載対象|
|---|---:|
|ニュースの現場から|2388|
|MEDIA TALK|1719|
|SDGsを話そう|898|
|ニュースの学校|485|
|スポンジ|172|
|報談|95|
|ドーナツ|60|
|こどもそうだんしつ|31|
|合計|5848|

ルール説明タブには旧試算5936/個別未判定の文章が残るが、個別6591行のD列/I列を集計した。説明タブを勝手に更新しない。判定理由/代表EP-ID/根拠/保留は台帳側に維持。

## 現在の6466の出所と差分

main cd8250584ea1a938b29db97ac6c813dfb4d04ad0 の `public/library/data/manifest.json` はtotal6466、snapshotDate2026-10-21、source6591、policyExcluded125、version1df7cb5d103cfbfc。

既存exporterはアルキキ100＋AJW25だけを公開対象外とし、D列を参照していなかった。library.mjsのsnapshot表示はmanifest.total/snapshotDateから作る。固定文字列6466ではない。

新案はD列対象かつ確認済みのEP-ID集合からexporterと共通writerで一覧ページ/番組件数/検索index/詳細/manifestを再生成する。旧掲載6466→5848、掲載から外れる618件 = 朝ポキTV15＋確定重複161＋確定再配信76＋保留366。元本の物理削除は0件。

プレビューで5848件を再生成。追加EP-ID0、残る5848件の公開エピソードオブジェクトの変更0（タイトル/日時/出演者/概要/関連記事/links/audioを含む完全一致）。旧公開sourceから再構成する経路と、既存の台帳exporterが共通writerを再利用する。既存の9再生可能話のうち掲載対象に残る8話は音声URLを完全保持。外れる1話も元台帳からは削除しない。

表示案は **「掲載対象5,848件・2026年10月22日掲載判定」**。元データのsnapshotDate2026-10-21は維持し、RSSを22日に更新したという表示に置き換えない。新しい公開生成時刻generatedAtと掲載判定日も別にする。

## 自動集計と宇宙との整合

- `docs/audits/2026-10-22-publication-scope/decisions.json.gz` は最新READ_ONLY判定のsnapshot。EP-ID/番組/C・D列/分類/確認状態/日時を保存。原文根拠は既存台帳/PR250監査を保持し、追加で変更しない。
- `public/library/publication-scope.mjs` が採用集合と集計を生成。5848を実装に固定しない。未確認の対象/重複ID/対象エピソード欠損/番組件数不一致を検出すると生成失敗し、前回公開データを維持する。
- 既存exporterへ判定snapshotを接続。4番目のCLI引数で新しいsnapshotを指定可能。台帳入力にpublicationDecisionsがあればそれを使う。台帳に増えた未判定IDはunreviewedで非掲載に留め、勝手に採用しない。RSSの収蔵処理/採番/trigger自体は変更しない。
- manifestは軽量な集計を持ち、別のscope.jsonに採用EP-ID集合/番組件数/判定versionを持つ。図書館初期表示で全5848IDを追加取得しない。
- 宇宙は別repo `Neyito96/asarisu-universe`。調査中にmainがV0.10.2からV0.10.5へ進んだため、最新V0.10.6 ed61100853214c3d685242018ea3c507b58d0648を取り込み、地理機能などの並行更新を保全した差分に更新。
- 現行宇宙ソースは番組除外＋タイトルの再配信/再放送/アンコールで別集計する。旧公開JSONを同じ処理で再計算すると6448件で、D列採用より余分601/不足1。不足1はEP04305「アンコールの舞台…」で、再配信ではない採用話。
- `universe-scope.patch` は独自のタイトル/番組除外を外し、図書館のscope.jsonと同じ公開moduleを使用。manifest/scopeのversion一致・全採用ID取得を検証して5848件と表示する。候補星/関連記事実例にも非掲載IDを混ぜない。

## 未公開での確認コマンド

```sh
node --test tests/library-publication-scope.test.mjs
node scripts/stage-library-publication-preview.mjs public/library/data /tmp/library-publication-preview-data
LIBRARY_DATA_URL=/tmp/library-publication-preview-data/ node --test tests/library-public.test.mjs tests/sdgs-integration.test.mjs tests/library-phase11.test.mjs tests/pages-preparation.test.mjs
```

追加8/8、再生成プレビュー既存回帰25/25 PASS。旧公開snapshotの既存回帰24/24もPASS。全採用5848件の内容不変/全検索ページと詳細のID一致/学校485/除外と保留が非掲載/アンコールの誤除外防止/生成失敗時の旧manifest維持を確認。CIは公開snapshotを変更せず/tmpでプレビューを再生成し、ChromiumとWebKitのiPhone検索/詳細/再生導線、図書館と宇宙の5848件一致を試験する。最終CI 39772297498でChromium/WebKitの両方がPASS。宇宙のrows・エピソードの星の全EP-IDも同じ集合に一致。証拠ログ・6枚の画面は `docs/library-publication-mobile-acceptance-2026-10-22.md` に記録。実機iPhoneの手動試験ではなく、iPhone 13相当のエミュレーションである。

## 承認を求める公開内容・復旧

承認対象は上記D列採用5848件の公開適用（図書館のcodeとJSON/検索/詳細再生成、宇宙indexの掲載判定差分）。Spotify/RSS/GAS/trigger/台帳/判定シートの変更は含まない。PR250全体の既存監査コードを一括mergeせず、今回の掲載件数修正commitの必要差分だけを適用する。

承認後、直前に判定snapshotのpayload hash/元本ID・人間除外/削除履歴を再読し、図書館/宇宙のmainとの差を確認。並行更新があれば今回の差分だけを載せ直し、想定外は停止する。図書館の共有module/scope付きJSONを先に反映し、同じ作業で宇宙差分を反映、両方の件数/学校/EP04305/保留非掲載/公式リンク/再生を確認する。

復旧は直前の図書館公開データ一式と該当UI/code、宇宙のindex差分だけを戻す。元台帳6591行/EP-ID/判定は巻き戻さない。バックアップはGitの基準commitと公開元データを保全。今回のプレビューは別ディレクトリで、本番JSON更新/PR merge/Pages公開は未実行。
