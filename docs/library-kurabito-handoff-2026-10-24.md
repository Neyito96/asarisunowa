# 朝ポキの蔵｜蔵人開発室 引き継ぎ仕様書
作成：2026-10-24／状態：GitHub既存実装の調査と役割設計。コード改修・Pages公開は未実施。

## 使命
旧「独立エピソード図書館」の公開窓口を「朝ポキの蔵」として運営する。収蔵ロボ（新着台帳登録）、補填ロボ（既存行の空欄補完）から独立し、**掲載判定・公開スナップショット・検索UI・モバイル品質・GitHub Pages公開**の責任を持つ。蔵人は台帳への書込、EP-ID採番、GASトリガー、Spotify更新をしない。

## 調査した既存実装（repo Neyito96/asarisunowa）
- `docs/library-public-operations.md`：認証済み台帳をローカルに取得→`scripts/read-library-workbook.py`→`scripts/export-library-public.mjs`→テスト→Pages用ビルド→専用PR。公開データはbuildless HTML/ES module、Spotify APIやGASに依存しない。
- `scripts/export-library-public.mjs`：EP-ID形式と重複、ヘッダー、判定スナップショット、番組一致、人間除外、削除・除外履歴を検査。未判定の新規EP-IDは公開しない。既存台帳の値を更新しない。
- `scripts/library-publication-files.mjs`：40件ずつの一覧ページ、番組別100件ずつの全文検索インデックス、50件IDバケットの詳細、`manifest.json`、`scope.json`をstaging生成し置換。versionはエピソードと掲載判定から算出。
- `public/library/index.html`、`public/library/library.mjs`、`public/library/library-core.mjs`：検索・番組・期間・並び替え・詳細ダイアログ・再生導線。現行HTMLの見出しはまだ「エピソード図書館」。新名称は変更候補であり未公開。
- `docs/library-publication-scope-2026-10-22.md`：2026-10-22の掲載対象5848件（対象外377、保留366、元台帳6591）。採用内訳5219+113+31+485。学校485件を二重加算しない。採用基準はD列。名称は「掲載対象5,848件・2026年10月22日掲載判定」。
- `docs/library-publication-mobile-acceptance-2026-10-22.md`：Chromium/WebKitのiPhone 13相当エミュレーションで公開プレビューPASS。物理iPhone実機確認とは区別する。
- `docs/library-public-operations.md`記載の通り、RSS→台帳→Pagesの自動公開は未接続。収蔵ロボV19のCOPYトリガー設置は公開更新を意味しない。
- 宇宙は別repo `Neyito96/asarisu-universe`。掲載EP-ID集合をscopeで一致させる設計。宇宙の別開発・並行変更を上書きしない。

## 蔵人の権限
**許可**：蔵のUI・CSS・JS、公開用JSON生成コード、掲載判定の検証コード、プレビュー、ブラウザーテスト、ドキュメント、専用PRの作成。
**承認前は禁止**：mainへのマージ、GitHub Pagesへの公開、旧ページのURL変更・リダイレクト、宇宙repoへの書込、公開判定の勝手な変更。
**常時禁止**：原本台帳／判定シート／COPY台帳への無断書込、EP-ID再採番、GAS・ScriptProperties・トリガー変更、Spotify操作。音声URL存在を再生確認済みと誤表示しない。

## データ契約
1. EP-IDは永続キー。並び順や公開件数から再生成しない。
2. 収蔵済み≠掲載対象。新着は未判定なら非公開に留める。掲載判定D列と確認状態を検証する。
3. 2026-10-22の5848件は**基準スナップショット**。後日増減するなら判定日・追加/除外理由・EP-ID差分を別バージョンで記録し、過去の5848を黙って書き換えない。
4. `manifest.json`は総数・version・生成時刻・スナップショット日・掲載判定を区別。`scope.json`は採用EP-ID集合・番組件数・判定versionを持つ。
5. 公開一覧・検索index・詳細・scope・宇宙のEP-ID集合を比較。対象外・保留・未判定・削除履歴を混入させない。
6. 公式リンクはHTTPSかつ出典を保持。音声は検証済みのみ再生可能として扱い、未検証は外部配信先リンクへ誘導。
7. 台帳の機微情報、除外理由の詳細、秘密鍵、未公開作業ノートを公開JSONに含めない。

## 公開ワークフロー
- 1. 司令塔から更新対象・判定基準・作業ブランチの承認を受ける。
- 2. 原本はREAD_ONLYで取得、ソーススナップショットとGit SHAを記録。新着・補填の差分と判定未完了を分類。
- 3. 別ディレクトリで公開JSONを生成し、既存公開物を上書きしない。
- 4. EP-ID集合、件数、番組別件数、未判定非掲載、リンク・検索・詳細、モバイルをテスト。
- 5. 最新mainと宇宙の並行更新を確認。PRを作成し、変更対象を蔵に限定する。
- 6. 司令塔とユーザーの明示承認後にのみ公開。公開直前のmanifest・scope・ファイルとcommitを保全。
- 7. 実際のGitHub Pagesの表示・検索・スマホ操作・エピソード詳細・公式リンクを確認。問題時は公開差分だけロールバック。

## 最初の実装タスク
A. **READ_ONLY棚卸し**：現在のmainと公開Pagesの実数・version・URL・判定日を読み戻す。2026-10-22の文書は当時の検証記録であり、現在の公開状態の証明ではない。
B. **名称移行設計**：「エピソード図書館」→「朝ポキの蔵」の表示名称、サイト内導線、SEO、旧URL互換。URL変更は別途承認。
C. **新着受入プレビュー**：COPYで増えたEP-06598〜06624等のEP-IDを入力候補にするが、掲載判定未了なら公開しない。EP-06594とEP-06595〜06597は特別レビュー対象。
D. **公開差分レポート**：旧公開EP-ID集合、今回候補集合、追加・除外・保留、内容変更件数を提出。元の5848件のデータが予期せず変われば停止。
E. **スマホ受入**：Chromium/WebKitのエミュレーションと物理iPhoneの手動確認を分けて報告。

## 司令塔への定型報告
変更ファイル／GitHubブランチ・commit／対象EP-ID件数／掲載追加・除外・保留／JSON検証／PC・スマホ確認／Pages公開状況／ロールバック基点／未解決事項／原本・GAS・Spotifyへの書込0。

## 参照
- https://github.com/Neyito96/asarisunowa/blob/feat/phase14-official-gas/docs/library-public-operations.md
- https://github.com/Neyito96/asarisunowa/blob/feat/phase14-official-gas/docs/library-publication-scope-2026-10-22.md
- https://github.com/Neyito96/asarisunowa/blob/feat/phase14-official-gas/docs/library-publication-mobile-acceptance-2026-10-22.md
- https://github.com/Neyito96/asarisunowa/blob/feat/phase14-official-gas/scripts/export-library-public.mjs
- https://github.com/Neyito96/asarisunowa/blob/feat/phase14-official-gas/scripts/library-publication-files.mjs
