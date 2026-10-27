# 司令塔正式受入｜Phase15 COPY 06:15実行のタイムアウト確定・MorningRunnerV19監査
2026-10-27 JST | 緊急P0 | READ_ONLY限定。本番/COPY/GAS/トリガー/Properties/公開書込0。

## 出典と決裁
`Neyito96/asarisunowa` branch `audit/phase15-copy-runner-log-gate-20261027`、`docs/command-reports/2026-10-27-phase15-copy-0615-timeout-evidence.md`、コミット `c7ac7dc82c25412fca9d9ef371378b393764aeec`、GitHub blob `ae6269cf3b65b6d88b18a1a238fd01cc27ec2db5`。司令塔は監査報告本文を直接再読し、このターンでGASのオンラインログ/画像を独立再取得していない。
- COPY GAS `朝リスの田_Phase14_COPY_20261023` で `phase14CopyMorningRunnerV19` の10/27 06:15:43 time-driven実行は360.876秒後、「起動時間の最大値を超えました」でタイムアウト。**実行上限による停止は確定。長時間化した処理/カーソル・途中書込は未確定。**
- 10/27 05:11:14の独立した完了実行については5件COPY新着登録のstructured logと採番履歴が対応。05:11の`productionWrites0/propertyWrites0/triggerChanges0`は06:15実行の結果を保証しない。
- 既知: 本番GASの対象閲覧画面トリガー0、COPYトリガー2、10/27新着候補5件は本番6632行でGUID一致0、EP-06632採番分岐が確定。他GASプロジェクトや他ユーザーの実行経路は未確認。
- 本番EP-06632を変更しない。COPYのEP-06632〜06636をそのまま正式IDとして使用しない。

## P0：COPYのMorningRunnerV19の実体をコードで追う
1. COPYオンラインApps Scriptコードエディタで`phase14CopyMorningRunnerV19`を検索し、定義されるファイル名、関数本文と呼び出し先、使用するSheet ID、各rss取得・GUID登録・W補填処理、ScriptProperties/再開カーソル、`LockService`の有無を**閲覧のみ**で監査。スクリーンショットまたはコードの機微値を伏せた抜粋で提出。GitHubコードと同一であると仮定しない。
2. 2件の時間トリガーそれぞれの設定・所有主体・周期・次回予定を読取り、同じ関数に2本ある設計意図、1回目完了→2回目が6分止まる理由、再実行時の既登録GUIDスキップ・途中停止/予約IDの扱いを分析。即削除/追加/無効化しない。
3. 06:15ログにない処理は未確認とし、`partialWrites`/cursor状態は独立にCOPY採番履歴・新規行・実行ログのタイムスタンプ差分で調べる。データ書込0を現行の調査動作については保つが06:15過去実行のwrite0を断定しない。
4. タイムアウト対策をLAB提案として設計：6分上限より十分前（例4〜5分）に自発停止するtime budget、バッチ/ページング、カーソルの安全保存、冪等GUID/公式URL一致、採番予約と単一writer排他・ロック、再開後の件数ログ。具体的秒数は既存コードのネットワーク/Quota/Lockを分析して決め、即導入しない。
5. エディタ画面からの手動実行、GASコード編集、時間トリガー変更、ScriptProperties編集、台帳セルへの修正はこの指令で一切許可しない。

## P0並行：新着公式RSS・本番収蔵復旧
6. 公式RSS7番組＋SDGs別経路について10/27全当日候補GUID/pubDate UTC/JST/公式元URLを独立取得し、COPY候補5と本番全6632行の差集合を確定。取得できないRSSはSOURCE_PENDING、未収蔵総数は未確定と示す。
7. 本番側の新着writerエントリーポイントと接続先、オンラインコードの改版履歴、他プロジェクトのトリガー・ライター有無を確認。新IDはnullで扱い、衝突の安全な再割当と単一writer計画を作る。
8. 新着本番行追加・本番GAS修正とトリガー・蔵宇宙公開の3つは別々の事前承認ゲートである。COPY保護ACL未確認による既存W/L/AP空欄補填HOLDも別ゲートのまま。

## 次報提出
最優先：COPY runner関数と下位処理の実コード根拠、2トリガー設定理由、06:15実行の追加ログ/途中書込確認結果、時間予算・再開・採番防止を含む最小修正案。GitHub repo/branch/path/commitを明記。写る秘密情報は削除。調査中実書込0・本番EP-06632保全。
