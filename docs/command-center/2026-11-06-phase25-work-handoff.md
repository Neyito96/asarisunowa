# 司令塔→Work実行指令書：フォーム起点の蔵検索・Spotify追加・サイト公開を一本化
2026-11-06 / Phase25（設計・診断先行、実運用未切替）

## 最優先ユーザー要求
「既存のフォームから投稿された情報を蔵で探索。狙ったエピソードをSpotifyプレイリストに追加し、サイトに反映させる。そして巡回は続く。巡回方式を効率化したい。」

**過去のポリレビ#15照合をPhase25のブロッカーにしない。** Issue #265で収蔵QA継続。新着の実運用への準備を主軸にする。

## GitHub正本から確認した現状
1. `app/autoUpdateSubmit.ts` は従来フォーム受付 `playlist` と `autoUpdateRequest` を別申請として送る。自動更新申請は playlist URL/title/maker/updateType/inviteUrl/keywords/ruleNote 等を持つ。**EP-IDを選択・送信する仕様ではない。** 「狙った回」はルール候補から絞り込む方式を新設するか、フォームUXを追加する必要がある。
2. `scripts/google-apps-script/AutoUpdateRequest.js` はリクエストをシートの「自動更新申請」へ保存。重複受付防止あり。**受付ごとの臨時トリガーを作らず、常設の1時間処理を使う**と明記されている。
3. `scripts/google-apps-script/AutoUpdateAutomationV1.js`: 日次朝4時台の共通ハンドラ `runAutoUpdateAutomationV1`、毎時の `runAutoUpdateBackfillHourlyV1`、即時継続用の一時的 `runAutoUpdateAutomationSoonV1`。共通巡回はある。**「プレイリスト1件につき1トリガー」という現状はコード上確認できない。** 実際のトリガーはオンラインGAS・実行ユーザー別に監査する。
4. 既存日次 `syncRecentManagedAutoPlaylistV1_` は Spotify show の最近20回を取得し、候補を判定後、プレイリストmembersを取得する。今後は蔵のGUID/EP-ID/Spotify URLを共通入力源に置き換えたい。
5. `.github/workflows/sync-playlists.yml` はcron毎時17,47分で `scripts/sync-playlists.py` などを実行、`app/data.ts` を更新しPagesを起動。これはフォーム受付・Spotify更新の完了保証ではない。GitHub Actionsもイベント反映の遅延/失敗を追跡する必要がある。
6. Phase24でポリレビの蔵検索・Spotify所属照合が実機READ_ONLY成功。2026-11-06 20:10実測：台帳6,677、蔵候補16、Spotify17、候補16件の所属一致、missing0、Spotify only #15=1。未収蔵/公式配信未確認と「Spotifyへの追加不要」は区別。

## 提案アーキテクチャ
```
既存Webフォーム(変更最小)
  → existing POST kind:autoUpdateRequest
  → 受付台帳 + requestId/idempotency
  → shared queue/state machine (REQUESTED/VALIDATING/REVIEW/HOLD/READY/WRITING/VERIFYING/PUBLISHED/FAILED)
  → 蔵の台帳検索(EP-ID・title・W・出演者・GUID・番組・公開日時)
  → candidate manifest：EP-ID, Spotify episode ID, source GUID, evidence, rule, score/reason, human delete/override
  → 既存Spotify playlist membershipのREAD_ONLY取得
  → 追加対象のみを承認ゲート後に書き込む（Spotifyの必要最小限POST）
  → Spotify側 membership読み戻し + エラー時 HOLD (2xxだけでは成功としない)
  → 受付/公開台帳のstatus更新
  → 既存Web/Pages同期で公開読戻し
  → 既存の共通日次トリガーが増分を監視し続ける
```

## 順序・安全ゲート
### Work タスクA（READ_ONLYで直ちに可能）
- 既存オンラインGASとGitHub正本の差分を取得、現行のフォーム送信・requestId・自動化申請タブ・トリガー・Spotify OAuthと必要scope・GitHub Actions実行状態を実機確認。
- 複数Google Apps Script project間の役割を分ける。本番ロボGAS vs 「朝リスの輪 プレイリスト投稿受付」GASの責務・権限・スプレッドシートを混同しない。
- 新規 `P25TriggerInventoryReadOnly20261106.gs` の `P25_AUDIT_TRIGGER_INVENTORY()` を利用できる場合はREAD_ONLYで確認。所有者以外のinstallable triggerや他projectのtriggerはこのAPIで網羅できないことを報告。
- 受付済み申請が実際に何件・どのstatusで待機しているか、read-onlyで集計（個人名・招待URL・秘密情報をGitHubに掲載しない）。

### Work タスクB（COPY＋モック）
- 受付後の蔵探索サービスを入力/出力のインターフェースで切り出し、人物・連載・テーマのルールに沿って候補manifestを作成。EP-ID/Spotify URLを決定的に検査し人手承認・除外を尊重。曖昧な候補はHOLD。
- 初回全件構築と、以後の増分巡回を分ける。増分は保存した前回成功カーソル + EP-ID/GUIDを使い、遡及収蔵・タイトル変更にも対応。単なる14日窓だけで新着検出しない。
- 新着未収蔵（公式RSSにはあるが蔵未登録）は **SOURCE_MISSING** として記録。Spotify差分0を「公式新着なし」とみなさない。
- playlist単位のルール数を大量に増やしても、**トリガーは共通少数・一回の蔵走査を複数ルールで共有・Spotify membershipをplaylist IDごとに1回取得**。時間制限・429などは共有レートリミッタ、チェックポイントとバッチ再開。
- ユーザーが狙った特定回を求める場合、既存フォームの`ruleNote`などの自由テキストから自動で確定採用しない。正式に回を指定するUI入力（episode ID/公式URL）と検証付き送信を設計し、既存API契約を保護する。
- サイト公開は `app/data.ts` への同期だけで完了とせず、Pages上の対象プレイリスト公開読戻しにより `PUBLISHED` を付ける。
- 途中失敗でも重複追加・人間削除の復活・サイト二重表示を起こさない冪等性テストを用意。

### Work タスクC（承認後のみ）
- 既存トリガー構成の変更、本番GAS更新、受付スプレッドシート更新、本番Spotify追加、Pages公開の各工程ごとに差分・件数・ロールバック方針を提示して管理者の明示承認を受ける。
- 初回は既存プレイリスト1つと新着1件でカナリア、Spotify membership読戻し・サイト表示確認。その後複数ルールへ段階展開。
- 既存自動更新が稼働する間は新方式のWRITEを同時に有効化しない。切替時には同じplaylistのwriterを単一化し、重複トリガーや二重書込を防ぐ。

## 成果物・受入条件
- Trigger/フォーム/シート/Spotify/Actionsの現在地一覧と件数、権限・認証境界。
- READ_ONLYで「受付申請1件→蔵の狙いの回候補→Spotify所属→サイト反映状態」がtrace IDで追える。
- 実装/テスト/PR・Issue更新。変更範囲はレビュー可能な小分け。
- 本番稼働条件: 受付→候補確定→Spotify追加→membership検証→Pages公開読戻し→継続巡回が1件でEnd-to-End成功し、二重実行時追加0。
- 失敗時は HOLD/FAILED の理由と対象EP-IDが分かり、再実行で安全に継続できる。

**運用注意**：Work使用はユーザーがChatGPTでWorkモードを明示選択して行う。ここで書いたGitHub指令書は自動的にWorkへ投入されない。指令書をWorkへ渡してから実行すること。
