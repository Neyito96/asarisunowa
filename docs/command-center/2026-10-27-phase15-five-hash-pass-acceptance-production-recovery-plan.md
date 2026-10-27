# 司令塔正式決裁｜Phase15 COPY新着5件ハッシュ整合完了・本番収蔵復旧計画への移行
2026-10-27 JST | READ_ONLY / GitHub非公開監査・LAB設計のみ許可

## 原本・受入
- 4件追加監査：`audit/phase15-four-native-hash-20261027/docs/command-reports/2026-10-27-phase15-four-native-rowhash-pass-manifest.md`、提出コミット `177f3a10355bee86db3f0836638d451917ff7584`、司令塔直接確認blob `839a7ed468d976e0de2f80ac56fee1510eaa565a`。
- EP-06633〜06636はGoogle Sheets CellData native型55セルを再構成し、JSON.stringify→UTF8 SHA256→websafe Base64の独立計算がV3 stored proofと4/4一致。先行EP-06632も1/1一致。5件すべて `CURRENT_NATIVE_HASH_MATCH_CONFIRMED`。これは現行時点の整合であり、登録時からの不変性・本番収蔵安全性は証明しない。
- EP-06594は別件：`HISTORICAL_SNAPSHOT_UNAVAILABLE`、10/24 currentRowHashは登録当時の証拠ではない。登録時欠落ハッシュの推定補修は禁止。
- COPY ledger/V3 6636/6636・RESERVED 0の先行監査と矛盾しない。
- 本番EP-06632とCOPY EP-06632は異GUIDの別エピソード。同番号の本番転記は禁止。

## 新工程の優先方針
**これ以上ハッシュ作業を再開しない。P0を本番収蔵の安全な復旧可否に移す。**
1. 本番台帳全体のEP-ID/GUID/URL/予約履歴の最新READ_ONLY整合を確認し、採番authorityを実証。本番既存EP-06632を保護、提案新番号は独立採番・単一writer確認まで`null`。COPYのIDをそのまま使用しない。既存COPY5候補をGUID/番組/pubDate/URLの参照manifestとして保持。
2. オンライン本番GASの**正式writer**関数と実際のopenById接続先/本番書込経路をコードで実証、COPYのV19トリガー2個との並行動作リスクを評価。表示された本番GASトリガー0は対象プロジェクトに限定した所見。別GAS writer有無、採番履歴の一元管理、LockServiceのプロジェクト間限界を確認。
3. 公式RSS 7番組＋旧SDGsの`SOURCE_PENDING`を解消する具体的取得経路を調べる。取得失敗は0件ではない。現時点でCOPY候補5件が本番6632件に未収蔵という先行監査を維持するが、**当日全未収蔵総数は未確定**。公式GUID/pubDate/URLが確定した候補だけを将来の登録審査票へ。
4. 6分制限の修正案をLABで具体的に作成：runner開始時time budget、8 feed全XMLの負荷軽減、収集と補填の処理分離、feed単位checkpoint、RESERVED→ledger→V3→completeの再開state machine、GUID・音声URL重複防止、全件読取/書込のphase計測、ネットワーク失敗HOLD。7番組×3件は軽量shadow監視で登録件数上限ではない。旧SDGs収蔵方針は別承認。
5. 提出物は**本番復旧準備票**：`writer_source_proven / competing_writers / allocation_authority / source_verified / missing_candidates / safe_resume_lab_status / stop_conditions / actions_requiring_approval`を明記。既知不明を混同しない。ハッシュ5/5合格はCOPYデータ整合ゲートのみ。
6. EP-06594は過去スナップショット得られた場合のみ別監査。COPY WのACL STOP、リンク12セルHOLD等は本件に混入させない。

## 禁止線
本番/COPY台帳やV3/採番履歴への書込、GAS実行/コード変更、時間トリガー変更、ScriptProperties、mainマージ、Pages・蔵/宇宙公開を禁止。収蔵実書込・GAS修復・公開の3つは別々のユーザー承認が必要。

## 次回提出
LABの復旧準備票とオンラインwriter・公式RSS経路に関する新証拠をGitHub監査ブランチに保存してコミット付きで報告。追加ハッシュ検算は要求しない。
