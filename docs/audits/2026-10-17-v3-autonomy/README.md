# V3自動巡回の追加実装 — GitHubで完成、GAS反映は承認待ち

基準: 段階A `b3f950ff08df2bc9c4335d97e2142f7eed19e10d`、PR #226、`fix/library-v2-checkpoint-cache`。2026-10-17 JST。

**今回の実作業はコード・モック検証・GitHub記録のみ。** WORKによる実台帳6,591件の巡回、実シート/Properties変更、GAS反映、トリガー設置、デプロイ、マージ、外部サービス契約は0。オンライン33ファイルの全面監査を再実施していない。前回保存済み34ファイルのprivate captureを、ローカルの結合構文/関数名検証だけに再利用した。

## 実装した不足機能

|層|既存機能の再利用|今回の追加|
|---|---|---|
|番組|V2の条件付きRSS/分割cache、V3の番組交代/offset|自動運転専用cache、30分の再確認期限、新しい配信日時順、priority→reviewの2巡、完走後待機|
|EP|GUID/Omny Clip/公式itemid、番組・タイトル・JST日付、一意性|検査済みsource/row hashを保存し、変化のない項目を7日、保留を1日再検査待ちにする。row変更は待ち期間を無視|
|項目|packed状態、空欄だけ、数式/人間除外/既存値保護|Spotify根拠別調査、清掃recipe、未確定のセル書込予約を保持|
|音源|PythonのHEAD/1024-byte Range/許可ホスト/転送上限2|GAS側のURL有無/外部検査キュー、証跡のURL拘束/再検査予定、PythonのURL別checkpoint/HTTP分類|
|制御|ScriptLock、V3 disabled既定、原ID登録200件/回、予約採番|8分lease、自動原ID登録、RSS/SPOTIFY/RSS/AUDIO_QUEUE/RSS/DASHBOARDの交代、補助障害の分離、エラー/再開位置の記録|

新GASファイルは **LibraryV3Autonomy.gs 1本**。既存LibraryV3とCheckpointEngineは必要なhook/オプションだけを変更。V1/V2の既定経路、既存OAuth関数・設定・manifestは変更していない。既存17種類の重複名に新しい26関数の衝突0。V3本体30関数も維持。

## 時間・API制限と再開

- 1 tickは1種類の仕事。原ID登録が未完了なら200件以内/100秒目安で登録し、完了後に巡回へ移る。6,591件なら最少34 tickだが、時間で分割されれば増える。
- RSS: 最大1フィード取得/45秒timeout、最大200item/10候補EP、110秒予算。取得と台帳反映は別tick。条件付き304、cache消失、変更hashからの再走査を継承。
- priorityは新着・欠損・再検査、reviewはその他の期限到来分。保存offsetを動的に並べ替えず、取得時に新しい順の固定順序を作る。番組はバッチごとに交代し、一番組の完了を待たない。
- 同じsnapshot+同じ台帳rowで再検査期限前なら項目別処理を省略。行の人間変更はhash不一致となるため再確認する。RSS自体は継続的な新着検出のため条件付き再確認が必要で、永久に取得しない設計ではない。
- Spotify調査: 最大200台帳行scan/5欠損EP、APIを使う場合は1要求15秒。429/503は次回へ延期、Retry-Afterを短縮しない。403/認可・API停止はSpotifyだけ。補助jobの予期しない例外もRSSを止めず、2回で当該補助jobを保留する。
- 制御/原ID登録の例外2回、RSSの既存停止条件、監査履歴が書けない場合は無効化。時間切れでfinallyが実行されなくてもleaseが8分で期限切れとなり、次のtickが回収する。旧トリガーを勝手に削除しない。
- セルを書き込む前に専用状態へ予約を保存。書込後の検証前に中断して空欄が残った場合は自動再書込せず保留。人間のクリアと未書込を判別不能なケースを安全側へ倒す。新規EPの採番予約も既存方式を維持。
- 自動運転時の原ID登録/補助job/エラーも既存実行履歴へ記録。root制御の履歴セル数は0で、子writerと二重計上せずJSONのchildWrittenCellsに分ける。

これらは処理予算であり、実環境I/Oの厳密な時間保証ではない。新しいcache・状態表I/O・自動制御のGAS性能は未実測。

## Spotify URL取得

既存RSSの明示Spotify episode URL抽出と厳密照合はそのまま使う。新jobは**空欄だけ**を調べる。

1. 同じ図書館ファイル内から、前回監査した1007 stagingの先頭7見出しが完全一致するシートを認識する。別名のシートでもヘッダーで認識。以前の別Driveファイルを勝手に再巡回しない。
2. 既存対応表用の厳格なschemaも受け付ける: `番組名 / タイトル / 配信日時 / GUID / 元ページURL / Spotify個別URL / 根拠`。根拠空欄の対応表は採用しない。今回そのような新シートは作っていない。
3. 番組・正規化タイトル・JST日付一致に加え、GUID/Clip等の一致または一意な公式元ページURL完全一致を必須とする。重複EP/GUID/page、複数Spotify候補、他EP所有URL、既存値/数式、除外、人間の削除を保護。
4. URLは取得元に実在する22文字episode URLだけ。GUIDからの生成、検索の上位候補、曖昧な番組別名統合は使わない。
5. 任意のSpotify API検証は既存exact-ID adapterを再利用。GET応答のepisode ID/URLだけでなく、show ID・タイトル・日付day精度を確認する。200以外を確認済みにしない。
6. APIは既定off。既存の `SPOTIFY_USER_ACCESS_TOKEN` cacheを読むだけで、OAuth refreshや認証プロパティの書換はしない。**別GASプロジェクトのcacheは共有されない**ため、隔離側に認可済みtokenがなければAPI未接続として保留する。認証接続の追加は別承認。
7. 根拠なし/衝突/取得不能は理由と次回期限を状態に保存。token/show mapping待ちは1時間、その他は7日を基本として再検査。設定/根拠/台帳の変更はfingerprintが変わり再検査できる。

166件は前回の欠損数。今回全件再調査しておらず、「166件すべて取得可能」とは判断していない。1007/RSS/対応表に存在しないURLは埋まらない。APIは既知URLの検証経路であり、未知URLを探索する仕組みではない。

公式参照: [Get Episode](https://developer.spotify.com/documentation/web-api/reference/get-an-episode)、[rate limits](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)、[API status](https://developer.spotify.com/documentation/web-api/concepts/api-calls)。アクセス可能なAPIと認証の範囲だけを利用し、403を回避しない。音声previewの取得やAI学習への利用は行わない。

## 音源チェックの実装と実行方式

GASだけで自律実行するのはURL記載有無の確認・除外/EP一意性・URL変更検出・外部検査待ちの抽出まで。音声URLの本文は取得しない。HEADと小容量Rangeを確実に制限する実transportはPythonで扱う。UrlFetchAppの公式method一覧にHEADはなく、GET Rangeを無視する配信元からGASが本文全体を受信する問題もあるため、HEAD→大容量GETの暗黙フォールバックを禁止した。

[既存CLI](../../../scripts/library-v3-audio-probe.py) の拡張:

- 1回最大5URL、許可ホスト、転送2段まで、HEADとGET Rangeを別に記録。200でRange無視なら本文を読まず閉じ、206の場合だけ最大1024bytesを読む。Content-TypeとID3/Ogg等の先頭署名を確認する。
- 403/404/410/429/503をそれぞれ分類し、host/method/status/bytes/type/Retry-After/検査日時を保存。音源不在でも台帳書誌を削除しない。
- `--state` はユーザー管理のローカルcheckpoint。URL+EP-IDごとに次回期限を持ち、429/503/通信失敗が5回なら当該URLだけ停止。Retry-Afterの秒/HTTP日付を守る。GET/prefixが成功しても全編再生済みにはしない。
- `recordLibraryV3AudioEvidenceAfterApproval(records)` は最大5件の新しい証跡をURL/EP-ID/除外に拘束して専用状態だけへ保存する。HTTP分類・byte上限・再検査期限を検証し、再生状態の列は変更しない。

**外部実行方式は未選択・未接続。** 選択肢はユーザーのMac/PCで必要時にCLIを動かす方式、または同じ端末のOSスケジューラーで動かす方式。GitHub Actions等への認証接続・定期化を選ぶ場合も別途レビューが必要。今回いずれも設置していない。現時点ではキューの書出し/結果のGAS受渡しは手動であり、音源HTTP検査までGAS単独で完結するとは報告しない。

例（ユーザー端末で選択後、最大5件のJSONを入力）:

```bash
python3 scripts/library-v3-audio-probe.py queue.json evidence.json --range --follow-provider-redirects --state audio-checkpoint.json
```

公式参照: [UrlFetchApp](https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app)。

## 清掃と古い「ニュースの現場から」

原文V列は保持、清掃W列も空欄のみ。改行/HTML/装飾を決定的に処理し、リンクラベルに隠れたURL、山括弧URL、出演者表記を保持。原文hash・処理結果hash・規則・告知境界/各部分hash・変更有無を `cleanEvidence` に記録し、保存済み原文から同じ差分を再現できる。

行全体で明確な `【お知らせ】` 等がある場合は境界を記録するが、告知内のURL/人名も含め**全文を保持**する。「お知らせ」が本文中に混在する、script/style等の曖昧なマークアップがある場合は清掃/清掃版だけを保留。意味のある文章や告知を自動削除しない。人間の清掃版が機械処理と異なる場合も上書きしない。LLM呼出0。

前回の古いニュース監査（561件、RSS不在20件等）を再実施せず引継ぎ。今回の2020年風のfixtureで原文/出演者/URL/告知保持と曖昧境界の保留を検証した。実際の2020年全エピソードを新規に実測した結果ではない。保守的な保留ルールが加わったため、以前の全体候補20,756セルを新コードの確定候補数として再利用しない。

## 検証済みと未検証

- Node **83/83 PASS**（既存61 + 自動制御/補助22）、Python **9/9 PASS**、RSS preview **23 assertions PASS**。
- 前回保存済みオンライン34ファイルを使うcompile-only: 現状33gs・導入想定34gsの結合PASS。V3本体30 + 新規26関数の衝突0。コードを評価/実行せず、実API呼出0・実シート書込0。[test-results.txt](test-results.txt)
- disabled既定、READ_ONLY無変更、201件の分割baseline、優先/通常巡回、30分refresh、番組/補助jobの交代、部分失敗/予約、人間クリア、数式/除外、Spotify403/429/503/timeout、根拠衝突、音源証跡期限、清掃保持を検証。
- 旧READ_ONLY3関数も新補助コードを読み込んだモックで無変更を確認。新コードのオンライン反映には承認が必要なため、**新コードを実GASで実行していない**。既存の実測は段階A（全列10.965秒、進捗9.446秒、RSS37.378秒/488件/書込0）を参照し、新コードの性能値と混同しない。
- 未検証: 新制御のGAS性能/状態表I/O/全番組の長期運転、実セルの少量補完/再開、新規追加、Spotify認証接続/実応答、外部音源runnerの自動接続。保存できる情報と原情報が存在することは別であり、全項目が充足したとは宣言しない。

[操作手順](operations.md) / [反映対象・承認・復旧](rollout.md)
