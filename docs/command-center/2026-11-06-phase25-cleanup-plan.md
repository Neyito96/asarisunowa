# Phase25 コード整理台帳・段階的撤去計画（2026-11-06）

対象正本: PR #270 / `8ace9358e16b66a591d35ba621658af0eadb933c`。今回は文書・台帳だけを追加し、実装変更・旧コード削除・トリガー操作・本番書込は行わない。

## 根拠と限界

- オンラインの6トリガーは同日この作業セッションの認証済み画面で確認した記録を再利用する。[実機監査記録](2026-11-06-phase25-review-followup.md)。当該ログインユーザー所有分のみ。他所有者・別プロジェクトは未確認。
- 呼出関係と対象IDはGitHub正本の静的調査。オンラインソース全体との一致、Script Propertiesの設定値、実際の候補・更新履歴は未照合。コード上の重複経路は、実際に重複追加した証拠ではない。
- [ファイル別整理台帳 CSV](2026-11-06-phase25-code-inventory.csv): 当該ディレクトリ全82ファイル。現役28、統合予定26、未使用候補4、削除禁止24。主分類であり、現役は維持対象という意味で稼働実績の認定ではない。全ファイルとも今回削除禁止。
- CSVの参照元は同ディレクトリの名前付きfunction定義と呼出形式の文字列照合。コメントを含み得る。定数、動的呼出、外部テスト、トリガー、Web公開、手動実行を完全には表さない。参照ゼロを未使用の証明にしない。

## 6トリガーと重複

全件Head・時間主導、一覧の表示エラー率0%。0%は正しい更新の証明ではない。日次と毎時以外の周期は未確認で、最終実行時刻から日次と断定しない。

| 実行関数 | 実機設定・11/6最終実行 JST | 対象・用途（正本コード） | 重複と移行条件 |
| --- | --- | --- | --- |
| `runAutoUpdateAutomationV1` | 毎日04–05時 GMT+09、04:38:52 | 申請受付処理、初回補完、承認済み申請、Theme V3、固定7ルール | P25の受付後巡回と重複。配下の全writerを同一所有権判定へ |
| `runAutoUpdateBackfillHourlyV1` | 毎時、20:48:29 | 申請処理・次の初回補完。対象は保存された申請ルールに依存 | 日次にも同じ初回補完がある。コードでは03:30–05:30を回避するが排他の代わりにはならない |
| `syncKinoDougaPlaylist` | 周期未確認、04:26:50 | 木下君、あの動画みた？ `6nDhZQG75F1wU62sdcYJMq` | 日次固定対象にも存在。P25移行前から二経路 |
| `syncIsshoShinbunPlaylist` | 周期未確認、04:39:56 | 一緒に新聞をめくろう！ `4tY0lHoV8IemMBp4iTnKnl` | 日次固定対象にも存在。P25移行前から二経路 |
| `syncToyohidePlaylist` | 周期未確認、04:26:52 | 豊秀一 `4Ri6rxTGFimTm0KkZtKfBZ` | 日次固定対象にも存在。P25移行前から二経路 |
| `syncListenerPodcastPlatforms` | 周期未確認、04:32:26 | 朝リスPodcastシートの配信先・番組情報補完 | Spotifyプレイリスト項目追加ではない。Phase25撤去対象から除外 |

日次固定7件は上記3件に加え、太田匡彦 `7jLXrZ0JUNOnsSeFEFbw9S`、ノーミライ `4FBXSFf2nLjLb3qaRoSdoD`、ポリレビ `6hNrobOVHmYaQT5C7hPkNa`、佐藤陽 `73ppqrTcsjVgl1xwIZa4SY`。正本では全てenabled=true。南米 `2Org6cCBgVas4d9OwzzxAv` はルール上enabled=trueだが固定7件には含まれず、テーマ経路を別に確認する。`polirebi-rebuild-audit` はenabled=falseであり二重writerと数えない。動的申請・テーマの全実対象ID一覧はランタイム状態の監査が必要。

## 依存関係と共通化案

| 入口・責務 | 依存経路 | 保護・統合の単位 |
| --- | --- | --- |
| 個別3トリガー | PlaylistSpecial → PlaylistAuto → Rules / Episodes / Spotify / Write → Dates | 特殊入口は現トリガーが参照するため削除禁止。先に共通ディスパッチへ委譲 |
| 共通日次・毎時 | AutoUpdateAutomationV1 → 受付、bootstrap、申請incremental、固定巡回、ThemeV3（存在しない場合のみ条件付きThemeReview） | 配下全体を一度に削除しない。申請状態・人的削除・境界・カーソルを継承 |
| 太田判定 | Rules / SafeMatch / AuditV5 / OtaRebuild / SpeakerOtaComparison → AuditV2の分類器 | **V2は旧版名でも現役依存**。入口と分類器を分離する場合は挙動維持の別PR |
| 投稿/API | コード.js → Post / Api / AutoUpdateRequest / PodcastResolve群 | 既存フォームとAPI契約を維持。受付成功、Spotify反映、サイト公開を分離 |
| Podcast補完 | PodcastPlatformSync → Podcast解析群 / Spotify / SheetData | 独立用途。Spotify項目writerと一緒に撤去しない |
| P25 COPY | P25CopyAdapter → P25LibraryPipeline、独立シートの状態journal、テスト用Spotify | 本番接続なし。実機COPY未完了。モック成功を実機成功と扱わない |

共通化は次の順で提案する（今回は未実装）。

1. `playlistId → LEGACY / P25 / PAUSED` を唯一の更新所有権にし、全writerがPOST直前に共通ロック内で再確認する。日次・毎時だけでなく個別3件、Theme、手動launch/rebuildも対象。別GAS間ではScriptLockが共有されないので本番writerを一プロジェクトへ集約するか別の共有排他を設計する。
2. membership読取をページサイズ50・全ページ・snapshot整合・429待機・部分取得失敗閉鎖の共通契約へ。旧`PlaylistAutoSpotify.js`にはlimit=100が残る。COPYの50修正をそのまま本番に展開せず互換試験後に別変更。
3. 蔵の共通索引を一巡回一回構築し、連載・出演者・テーマの判定に渡す。旧「番組の最近20件」と初回全件取得を段階置換する。GUID照合、新着収蔵遅延、曖昧候補HOLDを維持。
4. 追加前intent保存、読み戻し、未確定POST照合、手動削除のtombstoneを共通writerに集約。単なる「既登録を差し引く」処理だけでは競合・応答消失を防げない。

現状のロックはAutoUpdateAutomationV1内の受付・申請同期・bootstrapごとにあり、固定巡回・PlaylistAuto全体を覆う一つの所有権ゲートは未実装。COPYのlegacy-disabled設定も本番旧writerを停止させる機構ではない。

## 削除候補（承認前、実行禁止）

| 候補 | 理由 | 削除前の必須確認 |
| --- | --- | --- |
| `scheduleImmediateAutoUpdateAutomationV1_` / `scheduleWaitingAutoUpdateRetryV1_` | 当該ディレクトリでは定義以外の呼出なし | 全repo・オンライン版・外部呼出・一時トリガーを確認。関数単位で判断しAutomationファイル全体は残す |
| PlaylistAutoNoMiraiLaunch.js の一回限りlaunch/登録入口 | 過去の特定回初回投入用途 | 完了証跡、手動利用、共有補助依存を確認。復旧用途を別手順にしてから配布対象除外 |
| PlaylistAutoOtaRebuild.js の誤登録削除入口 | 単発修復用途で削除操作を含む | 監査保存、再修復要否、共有分類器依存を確認。診断目的で実行しない |
| PlaylistAutoDryRunOtaAuditV5.js / PlaylistAutoSpeakerOtaComparison.js | 監査・比較用途。定期6入口にはない | 手動利用終了、UserPropertiesの監査状態の保管、テスト参照確認。未使用と断定しない |
| PlaylistSpecial.js の3互換入口 | 日次と役割重複 | **現在は削除禁止**。承認を得て個別トリガー停止→観測→依存ゼロ確認後に将来撤去 |
| 旧Spotify候補探索（Episodes、日次recent20、bootstrapの該当部分） | 蔵検索で置換予定 | 全ルール移行・新着欠落検知・復旧試験後。ファイル単位で丸ごと削除しない |

Auth、manifest、API入口、Rules、安全判定、除外・人的削除・状態journal、回帰テスト、監査記録は削除禁止。旧版`../google-apps-script-playlist-submit.gs`も今回変更せず、配布実態の確認なしに削除候補確定としない。既存REFACTOR_MAPには現在一覧にないTestWriteDanger.js等の歴史的記載があるため、文書の名前だけを実在・稼働の根拠にしない。

## COPY検証を先行する撤去ゲート

| 段階 | 合格条件・操作案 | 今回の状態 |
| --- | --- | --- |
| 0 整理 | 6トリガー、依存、保護対象、除外を記録 | 台帳作成。オンライン全コード・動的対象は未照合 |
| 1 COPY実機 | 独立GAS/シート/認証/テストplaylistを特定。既存フォーム相当受付→蔵検索→承認最大1件→差分追加→全件読戻し→再実行POST0 | **未実施**。隔離資源と認証未準備。既存モック35件PASSのみ |
| 2 排他検証 | COPYで旧/新の同時開始、所有権不一致、PAUSED、POST後応答消失、429を再現。全経路で非所有writer POST0、曖昧時HOLD | 全経路共通ゲート未実装。時間帯回避だけでは合格不可 |
| 3 本番移行審査 | 変更ファイル・現コードhash・対象ID・件数・各トリガー設定・復旧手順を確定し明示承認 | 未承認。今回本番変更0 |
| 4 対象別切替 | 承認後にPAUSED→旧実行の終了確認→保留intent照合→P25へ移譲。共通日次/毎時を再利用 | 未実施。三個別トリガーの停止も別途承認対象 |
| 5 観測と撤去 | 少なくとも日次/毎時各一巡と新着ケースを確認し、呼出ゼロ・欠落なし・復旧試験済み。撤去差分を別PRで承認 | 未実施。問題があれば撤去延期 |

COPYでは本番playlistをallowlistに入れず、EP-00028を試験のために追加・削除しない。サイト反映もCOPYデータ／検証URLで受付・Spotify・公開の別状態を検証し、公開サイトへは送信しない。実機資源の未準備はモックで代替完了としない。

## EP-00028と復旧

**HOLD維持、追加許可0件**。楽屋裏 playlist `1u1qT0BxRZT1OeNM0LDA72`、GUID `ae4285e6-67af-4aba-afbf-b4b8007f2f96`、Spotify episode `0dfOcLSR0wxgSU7hDWok68`。既登録・人的除外・アクセス・再生可否の確認前に追加しない。既登録ならno-opとし、試験のために削除しない。

将来の復旧は対象をPAUSEDに戻し、journal・除外・snapshot・未確定intentを保持する。Spotifyを読み戻してPOST成否を照合し、旧コードだけを戻して即再開しない。未確定処理と除外状態を引き継いでからLEGACYへ単独所有権を戻す。追加済み項目の自動削除は禁止し、必要なら正確なIDで別承認。トリガーの旧設定・コード版を保管し、復元も承認された範囲でのみ行う。

今回の変更はこの計画とCSVの2ファイル。本番GAS・シート・Spotify・トリガー・公開サイトの変更は全て0。
