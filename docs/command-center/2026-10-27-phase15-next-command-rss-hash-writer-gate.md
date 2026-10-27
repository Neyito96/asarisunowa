# 司令塔・新正式指令｜Phase15 新着収蔵復旧の証拠完成ゲート
**2026-10-27 JST｜優先度P0｜READ_ONLY監査とGitHub LAB成果保存のみ。**

## 前提
- 前指令：`2026-10-27-phase15-feed-policy-origin-acceptance-next.md` commit `d86e183e0506f2161f9cd1498399ce9bf9c68bfd`。
- 7公式番組×最新3件は`FAST_RSS_SHADOW_V2`の軽量READ_ONLY監視仕様。V18は7公式番組＋旧SDGsアーカイブの8取得元、過去7日以内、最大10件**新規登録**。8番目旧SDGsの恒久的な収蔵方針は未承認。
- 本番全6632件にCOPY 10/27候補5件のGUID/URL一致は検出されていないが、公式RSS全取得未完。EP-06632は本番こどもそうだんしつとCOPY MEDIA TALKのID衝突が確定。
- COPY台帳/V3 6636/6636整合、採番履歴RESERVED0。ただし全55列独立ハッシュ検算未実施。EP-06594は元の登録時ハッシュ欠落が10/24時点で記録済。
- 本番GAS「朝ポキ｜本番ロボGAS」当該画面でtrigger0、COPY V19はtrigger2。06:15実行は6分上限でtimeout。**原因となった内部工程・本番の全writer経路は未確定**。

## 新たな実行指令（報告待ちにしない）
### P0-1：公式RSSの10/27分を独立照合
1. 7公式番組のRSS（Omny/Megaphone）と旧SDGs別経路のURLを取得元一覧に照らし、READ_ONLYでURL、取得日時、HTTP可否、配信日UTC/JST、GUID、音声/公式エピソードURLを採録。ネットワーク不可はSOURCE_PENDING。対象外AJW/アルキキ/YouTubeを除外。
2. 本番6632行のGUID・公式URLと差集合を確定し、COPYの5候補を `OFFICIAL_CONFIRMED_MISSING/ALREADY_PRESENT/SOURCE_PENDING/IDENTITY_HOLD`に分類。全番組成功時に限り当日総数を確定。

### P0-2：V18の下位関数と時間予算を検査
3. **オンライン** `LibraryOfficialEngine.rss()` の実コードをソース・関数名・版とともにREAD_ONLY確認。feedごとの取得件数、リトライ/タイムアウト、並べ替え、RSS失敗時の振る舞いを記録。V19→V18呼出順、RSS前の6分time budget欠如、180秒期限の開始位置を追跡。
4. 7番組×最新3件は監視、正式収蔵は全新着＋遅延/停止時の補償という二層のLAB設計。単一writer、開始時time budget、停止前checkpoint、RESERVEDの回復state machine、GUID/URL冪等性、フィード単位の残件・カーソル記録を提案。実機変更はしない。

### P0-3：ハッシュの独立照合
5. `LibraryOfficialEngine.rowHash`の正確な正規化・列順・55列値・JSON serializationを確認し、COPY EP-06632〜06636の現行native rowHashを独立再計算、V3証拠値との違いを表で提示。元の登録時ハッシュと最新再計算値を混同しない。
6. EP-06594の`originalRegistrationHashMissing`と10/24記録の`currentRowHash`を明確に分け、現在の実算と突合。登録時証拠の空欄を推定値で埋めない。結果が不一致なら上書きせずHOLD。

### P0-4：本番自動収蔵のwriter特定
7. オンライン本番GASの新着writer入口・実際のopenById対象、トリガー主体、他GASからの本番writer有無をREAD_ONLYで裏付ける。COPYの2トリガーの存在だけから本番writer全体の不存在を断言しない。
8. EP-06632の衝突保護を維持。COPY IDsを本番に流用しない。正式新IDは本番全件・予約・他writer確認までnull。A:新着登録、B:GAS/trigger復旧、C:公開データ変更の各承認ゲートは独立。

## 納品形式と優先順
- **第1報:** RSS取得成功/失敗・10/27差集合、`E.rss()`実コード検証状態、本番writer確認状態。時間がかかる場合も確認できたものを先行提出。
- **第2報:** 5件とEP-06594の独立ハッシュ検証、全量収蔵・安全停止/再開の最小LAB設計および回帰試験。
- 報告はGitHubの監査ブランチに `docs/command-reports/`として保存、repo/branch/path/commit、確認済/未確認の区分を明示する。

**禁止：** 本番・COPYの台帳/V3/履歴更新、GASコード修正、実行ボタン、時間トリガー追加・編集・削除、ScriptProperties変更、mainマージ、Pages/蔵宇宙公開変更。既存W補填/COPY ACL STOP、Spotify/Pocket Casts12セル HOLD、150件意味品質審査も別工程。
