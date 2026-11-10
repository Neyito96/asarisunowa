# Phase 13：新着接続の最小修正と本番確認手順

2026-10-22。開発基準 main: `1e325c7273a2d34dc90c7a62e664495b89d695ae`。
PR #244 `c2c4a723ea6ad8a53ea8cd6405930cf6cbd8c86d`、#248 `51693925cb95dd7e1984e7b827099b26a4b6e3e2` を参照。
#248 の Sheets READ_ONLY adapter と既存 prepare bridge を再利用し、最新mainの exporter / scope writer につなぐ。スタックPR全体やGAS差分を取り込まない。Issue #241 / #222・Phase 12の判定、V3登録証拠、公開スナップショットを継承する。

## 今回完成したもの

- 公開済みEP-IDとの差分を新規登録判定から撤去。基準6,591件に含まれず、V3 identity が RSS_registered の行だけを登録候補として報告する（候補は掲載可を意味しない）。
- 掲載には VERIFIED、GUID一致、先頭51列の登録ハッシュ、登録日時、個別の掲載承認をすべて必須化。公式UUIDと大小文字・前後空白を正規化したGUIDの衝突を全台帳で確認する。Omny URLの組織・番組UUIDはエピソードUUIDとして扱わない。
- 基準IDへの追加承認を拒否し、採用5,848／対象外377／保留366の判定オブジェクトを変更しない。削除・除外、人間除外、番組除外を優先する。
- 新規承認なしの標準実行は5,848件のまま。新規承認ファイルは任意引数。登録後の証拠に結び付く承認を永続管理し、毎回同一の概要・scopeを再生成する。
- exporter と本番データは変更しない。準備結果の publicationDecisions を既存 exporter が利用する。
- 本番自動実行workflowは追加しない。既存PR検証workflowに回帰試験だけ追加。自動merge、トリガー作成、GAS/台帳/判定シート/Spotify/Pagesへの書き込みなし。

## ローカル実測

取得済みの非公開台帳スナップショット6,591件（取得時modifiedTime: 2026-10-22T08:47:04.810Z）でprepare→exportを実施。新規候補0、採用5,848、対象外377、保留366、公開version `134ffef496d755de`。本番の既存versionと一致。以前EP-00061で停止した「618件を新着扱い」は再現しない。取得済みデータを使った結果であり、現在GASの稼働証明ではない。

合成EP-06592を使う試験では、新規承認なし5,848、証拠付き承認あり5,849、再実行追加0・version同一。scope／一覧／検索／詳細のID集合一致、既存対象外・保留の混入0。実在の未登録29件は使用・登録していない。

```bash
node --test tests/library-new-admissions.test.mjs tests/library-publication-scope.test.mjs tests/library-public.test.mjs
```

READ_ONLYで取得済みのprivate inputからローカル出力する手順（出力先はrepo外。非公開JSONをcommitしない）:

```bash
node scripts/prepare-library-publication.mjs "$PRIVATE_INPUT" "$PRIVATE_PREPARED" "$PRIVATE_REPORT"
node scripts/export-library-public.mjs "$PRIVATE_PREPARED" "$PRIVATE_EXPORT_DIR" docs/audits/2026-10-21-phase8/audio-evidence.json
```

個別承認ファイル形式（値はすべて登録後の実測に置換。例のまま実行不可）:

```json
{"schema":1,"baseDecisionVersion":"80b1a3a58a36a593d11bc0e64436c3af2d7652c3d2ac73ba017492df37ea1ac7","newAfter":"承認した開始日時","entries":[{"id":"新規EP-ID","show":"台帳の番組名","guid":"台帳GUID","rowHash":"V3登録時のbase64url SHA256","registeredAt":"V3登録日時","review":"確認済み","publication":"対象","decidedAt":"登録後の掲載確認日時"}]}
```

prepareの第4引数にこのファイルを指定する。既存比較判定を新規エピソードに流用せず、新規のcomparisonは保留に固定。追加承認は基準判定ファイルを書き換えない。既存6,591件の改訂は別の承認作業とする。

## 本番GASのREAD_ONLY確認（Mac：1コマンドずつ）

Workから本番GASの認証済みソース・実行履歴・現在のトリガーは取得できていない。保存済み54ファイルのソースは現在値の代用にしない。最初に次の1コマンドだけ実行し、結果を確認する。

```bash
command -v clasp
```

次のコマンドは出力確認後に案内する。既存の認証済みclaspがある場合は、対象プロジェクトを確認してから**新しい空のprivateディレクトリ**へ `clasp clone <確認済みSCRIPT_ID>` で取得する。既存作業ディレクトリへpullしない。未導入・未認証の場合は先にブラウザーのApps Scriptエディタで以下を読む。認証ファイル・トークン・全プロパティを共有しない。

1. 現行V3/MorningソースをPhase 12 overlayの対象関数と比較。オンラインだけの関数を保全し、現行ソースのhashを記録。
2. Project Settingsで公開してよいキーだけ確認：LIB_V3_CONFIGのenabled/autonomous/allowNew/newAfter、LIB_V3_MORNING_CONFIGのenabled/rssOnly/spotify/since、BASELINEのcomplete/offset。全プロパティの一括出力は禁止。
3. トリガー画面で所有者、handler、時間帯、タイムゾーン、最終失敗を記録。他アカウント所有のトリガーは別の所有者の確認が必要。表示0件だけで全体0件と断言しない。
4. Executionsで直近7日、特に最新成功・失敗・中断を確認。日時/関数/status/新規件数/重複件数/例外種類だけ共有し、ログ全文を貼らない。
5. `previewLibraryV3Morning` 等は、**現行の関数と呼出し先を読んで副作用がないと確認するまで実行しない**。名前のpreview/readOnlyだけで判断しない。
6. clasp push/deploy、configure/install/scheduled/run系の実行はこの確認では行わない。

## 1件の通し試験：別途本番承認後

1. 最新main/宇宙main、公開scope/version、台帳件数と最大ID、判定baseline、稼働設定・トリガーをREAD_ONLYで再記録。並行変更があれば載せ直す。
2. 29件の遡及分を対象外にするcutoffを固定。新しい公式RSS候補1件のGUID/公式clip UUID/配信日時を記録し、全台帳・除外履歴との照合0件を確認。
3. 既存V3の単発実行経路がその1件だけを登録することをソースで確認。対象を1件に限定できない経路は実行しない。ここで本番登録の承認を取得する。
4. 登録後、台帳追加1件、EP-ID一意、V3 identity VERIFIED/RSS_registered・GUID・行hash・登録日時の一致を読み返す。判定baselineは完全一致。
5. 個別の掲載承認を記録しprepare→exportをprivate stagingへ実行。5,849件、既存5848件の内容変更0、除外618件復活0、保留366件混入0。ID集合をscope/一覧/検索/詳細で比較。
6. 同じ入力で再実行。登録追加0、公開ID追加0、content version同一を確認。重複GUID/UUID、承認なし、旧cutoff、ハッシュ不一致の拒否試験も通す。
7. 公開候補の限定差分をレビューし、Pagesへの反映承認後だけ公開。図書館の実URLのscope/module/検索/詳細/公式リンク/音声導線を検査。宇宙rows/検索/星も同じ5,849IDで、テストフックを本番へ保存しない。宇宙で未掲載なら完了扱いしない。
8. `LIBRARY_LIVE=1`、本番図書館/宇宙URLで既存ブラウザー試験を使用。ただし既存試験の5,848固定期待値を検査し、新規承認scopeから期待値を作る最小変更が先に必要。Chromium/WebKitは実機iPhoneとは別に記録。
9. 証拠・commit・実測・復旧点を#241/#222とログへ記録。異常時は自動処理を停止し、公開差分だけrevert。台帳行を削除して採番を巻き戻さない。

## 巡回時刻の最小案（未変更）

Phase 12提案ソースはRSS-only 05:15 JST付近（±15分）、05時台以外を拒否、日付単位の完了状態を持つ。さらに同一scheduled handlerの複数トリガーを競合として拒否する。したがって07時のトリガーを単純追加しても動かない。これは提案ソースの確認結果であり、本番実装は上記READ_ONLY確認が必要。

06:35配信を同じ朝に拾う最小追加案は07:15 JST付近。05/07の許可時間、日付＋巡回枠での完了状態、承認した2本だけを許す競合検査を一緒に修正する。pending-only継続は同時1本、script lockとGUID照合を共有、日次20分上限は維持。前枠の未完了処理を破棄せず引き継ぐ。07時以降の配信には別途翌日または夕方枠の判断が必要。既存05時枠を廃止できるなら07:15へ移動する方が変更は少ない。今回ソース・トリガーとも変更していない。

## 残作業と状態

| 工程 | 状態 | 本番反映前に必要なこと |
|---|---|---|
| RSS→GUID→採番→台帳 | 未確認 | 現行GAS・設定・実行履歴、1件限定経路を確認 |
| 登録証拠→個別掲載判定→export | 開発済み・本番未反映 | このPRレビュー。既存5848判定を保持する個別承認運用 |
| 定期export→Pages | 未完成 | #248のworkflowを最新main向けに接続、READ_ONLY WIF/環境保護確認。自動mergeは別承認 |
| 新着の宇宙掲載 | 未確認 | scope追従コードは既存。本番の新規1件を使ったrows/星の検証が必要 |
| 07時台巡回 | 未実装 | 現行確認後、枠管理・競合検査の最小差分とトリガー変更を別承認 |

このPRだけでは明日の新着が人手なしで両サイトに掲載される状態にはならない。個別掲載承認を省く自動判定規則も未承認であり、無条件追加は行わない。
