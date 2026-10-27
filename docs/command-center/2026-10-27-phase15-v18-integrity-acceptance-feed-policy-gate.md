# 司令塔｜V18全件整合監査受入・「7番組×最新3件」仕様の原点照合
2026-10-27 JST。READ_ONLY / LABのみ。本番・COPY・GAS・トリガー・Properties・公開への書込禁止。

## 原典確認と受入
提出 `docs/command-reports/2026-10-27-phase15-v18-partial-write-full-integrity-audit.md`、branch `audit/phase15-v18-runtime-partialwrite-20261027`、commit `d9ee5b3ed2fd54ee69352464677ac6bb1679cf8a`、GitHub blob `4b4fe541bc36f63942cadd3b3496506685200b28`。司令塔が本文をGitHubで直接再読。Google Sheet LIVE全件検証は担当ロボのREAD_ONLY監査成果に基づく。
COPY `エピソード台帳` 6636件とV3 6636件はID対応6636/6636、GUID非空不一致0、ID重複0、V3 JSON parse fail0。履歴72件が全て登録完了でRESERVED0。10/27当日5件のledger/V3/history三者整合5/5。ただし現在55列でのnative rowHash全件再計算未実施、EP-06594 V3 hash欄空、06:15過去実行の部分書込不在は証明されていない。状態を`incomplete_new_registration_not_found_in_scanned_fields`とする。72履歴は6636件全履歴ではない。
本番EP-06632とCOPY EP-06632は異なるGUIDの衝突。既存本番番号の上書き禁止。

## ネジートの問い：「7番組から毎回最新3エピソード」だったのでは？
ユーザーから当初の運用イメージとして**7対象番組×最新3件**の照会あり。現行報告のV18は**8フィードをfetchし、7日以内を選択、最大10件を登録**する設計。この食い違いを黙って仕様変更と確定せず、当初仕様・設計文書・旧実装・実機コードの出典を確認すること。3件の意味は`RSSから取得するitem数`・`候補の照合件数`・`新規登録の上限`のどれかを切り分ける。番組数7とfeed数8はSDGs別経路の存在で説明できる可能性があるが、実ソース名を確認するまで断定しない。除外AJW/アルキキ/YouTubeは維持。

## 次工程P0-A：フィード構成と「3件」根拠のREAD_ONLY再現
1. V19ランナー→V18新着関数→`LibraryOfficialEngine.rss()`を実コードから追跡し、公式RSSの**フィードURL、番組、対象/除外、取得item数、過去7日判定、最大10件のbreak条件、処理順、重複排除**を一覧化。8フィードの実体を示す。
2. GitHubのPhase13/14設計、過去指示、実機ソースに`3件ずつ`仕様があるか確認し、`DESIGNED/IMPLEMENTED/OBSERVED/UNVERIFIED`を分ける。設計変更の意図が見つからなければ`SPEC_DRIFT`を立てる。ユーザーの3件案を根拠のない既成事実としない。
3. 1番組で1日4件以上配信された場合・公開が遅れた場合・タイムアウトで10件上限に達した場合・長期停止からの復旧時に欠損しないか、具体的な合成データでLABドライランテスト。最新3件しか見ない設計は4件目を永久に欠落させ得るため、**3件は軽量巡回の目安としても取りこぼし回収窓とカーソルが必須**。
4. フィード別の`items_seen,source_new,already_registered,excluded,held,added,remaining,elapsed_ms`を出力する監査ログ案を作成。新着取得と本番登録の件数を混ぜない。
5. 7番組＋SDGs公式別経路について本日配信分のGUID/pubDate/URLを独立確認し、本番全6632件との差集合を確定。RSS未取得を0件と扱わない。

## 次工程P0-B：ハッシュ異常と6分制限
6. EP-06594はV3 hash欄空の意味を調査し、旧V3フォーマット・対象列・算出方式を確定後、現行台帳55列から独立実算し突合。原因不明のままV3書込/空欄補完禁止。
7. 10/27新着5件の現行native rowHashを独立再計算し保存記録と照合、対象拡張の可否を見極める。全6636件のハッシュ検査はハッシュ定義と取得コストを確認して計画。
8. V19/V18の実装を確認し、フィード取得前にグローバルtime budget、時間余裕チェック、フェーズごとのログと永続再開チェックポイント、RESERVED復旧state machine、GUID/URL冪等性と単一writer設計をLABのみで提案。現行の2トリガーは変更しない。
9. コピー全件と本番採番の分岐は未解決。EP-06632の本番既存内容保護・COPY ID流用禁止。新着本番追加/GAS復旧/蔵宇宙公開は別々の承認が必要。

## 次報成果
- 7番組/8フィードの対応表、3件仕様の出典、V18の取得件数と登録最大10件の正確な動作。
- EP-06594と新着5件のnative rowHash実算の検証状況。
- 公式RSS当日全件の本番との差集合、本番writerとCOPY分岐原因の進捗。
- GitHub repo/branch/path/commitを示し、全環境への実書込0を維持。
