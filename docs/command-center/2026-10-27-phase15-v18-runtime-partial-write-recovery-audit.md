# 司令塔緊急指令｜V18処理期限・部分登録・RESERVED/V3整合性をREAD_ONLY監査
2026-10-27 JST | P0 | **本番・COPY・GAS・時間トリガー・ScriptProperties・公開データへの書込0**

## 受領状況と証拠区分
補填収蔵ロボより `phase14CopyIngestRecentTenV18()` のオンラインコード全文を確認したとの報告。今回はコード全文・コミットされた監査原本の提示がないため、**司令塔自身によるV18コード逐語検証は未完了**。報告を一次所見として受領、承認するのはREAD_ONLYの次工程であり、実装修正・本番再実行の承認ではない。
既受入根拠：10/27 COPYの`phase14CopyMorningRunnerV19` 05:11実行は完了・5件新着登録の記録、06:15実行は360.876秒で時間上限超過。現行本番側トリガー画面0、COPY側2、本番/COPYのEP-06632は異なるGUIDで衝突。

## 要確認のV18コード所見
- `LockService.getScriptLock()` は同一スクリプトにおける協調ロックにとどまり別GASプロジェクトの採番を保護しない。単一書込所有者が必要。
- RSS8フィード取得と本番/COPY台帳・採番/V3全件読み込みの**後**に180秒期限を設定しているとの報告。実行開始からの時間予算を設けない設計は6分上限のリスクとなるが、06:15の具体的な遅延箇所は未確定。
- `RESERVED → 台帳append → V3書込/ハッシュ検証 → 登録完了`の処理順と、途中時間切れで予約/台帳/V3不整合が生じる可能性。現に部分登録があったと断定しない。
- 永続再開カーソルなしとの報告について、V18とその下位関数・V19呼出コード・ScriptProperties使用の全体を検査してから確定する。
- 前回のCOPY 5件の採番は本番のEP-06632との衝突があるため一切流用禁止。

## P0-A｜06:15後のCOPY整合性を先に診断
1. COPY `エピソード台帳` A/G/I/Jと `固定ID採番履歴`、`図書館V3・項目状態`の関連記録を**READ_ONLYで全件照合**。`RESERVED`のまま残存、履歴にだけ存在するGUID、台帳にだけ存在するGUID、V3行/元本文hash不一致、重複ID・GUID、失敗した予約、10/27 06:15以降の更新日時を区別し報告。
2. 特にCOPY EP-06632〜06636の各GUIDについて`history_status / ledger_presence / v3_presence / hash_match / last_observed_at / discrepancy_type`をmanifestに記録。他の予約行も範囲を限定せず抽出。ただし過去からの正当保留・キャンセルと当日06:15に起因したものを混同しない。
3. COPYの時刻比較に利用できる監査ログと行更新日時の粒度・保存可否を明記。スプレッドシート値に行更新日時がなければ推定しない。`partial_writes_confirmed / not_found_in_scanned_fields / unknown`を分ける。**監査のためにrunnerを再実行しない。**

## P0-B｜V19→V18と依存コードをソースで追跡
4. COPYオンライン関数`phase14CopyMorningRunnerV19`の実装と、`phase14CopyIngestRecentTenV18()`への呼出し順・戻り値・処理した件数/エラー・二回目の補填エンジンなどの後続処理を検証。V18単独の欠点をV19実行全体の唯一原因と誤認しない。
5. `LibraryOfficialEngine.rss()`の8フィード取得、fetch timeout/リトライ/キャッシュ、台帳全件readback、V3書込、GUID重複検索、採番履歴更新の各処理の計測可能ポイントを列挙。時間予算は**runner関数開始時**に作成し、RSS開始前・各feed取得前・シート全件処理前後・各候補予約前に停止条件を入れる修正案をLABに提示。
6. 再開安全性について、冪等GUID/URL一致、予約statusのクラッシュ後照合・復旧state machine、LockServiceの範囲、単一writer、失敗時のappendのみ補償/削除禁止を設計。カーソル保存が実装されているかはV19と下位関数も含めて確認。
7. 修正は`proposal`と`dry-run tests`だけ。オンラインGASの編集/実行・トリガー削除追加・履歴のRESERVED変更は**禁止**。

## P0-C｜新着本番の再開準備も継続
8. 7番組RSSとSDGs公式経路の10/27候補について独立GUID・pubDate照合、全本番台帳との差集合。未取得はSOURCE_PENDING。オンライン本番writerの実関数と接続先・他writerの有無を特定する。
9. 本番EP-06632は維持、COPY EP-06632〜06636のIDを本番に転記しない。新規正式IDの提案は予約/他writerを確認するまでnull。ユーザー承認は本番新着追加、GAS/トリガー修復、公開差分の3段階で別途。
10. COPYへの既存W/L/AP補填はACL_UNKNOWNでSTOP、Spotify12セルと150件意味品質は別ゲート。

## 最優先提出物
(1) COPY採番履歴のRESERVED残存・台帳/V3の実整合結果、(2) V19とV18及び下位関数の実コード原典（ファイル/版/スクショまたはGitHub LABコード写し）の根拠、(3) 6分内に自発中断・確実に再開できる最小修正案、(4) 公式RSS照合と本番復旧の未完ゲート。GitHubに監査結果を保存しcommitを報告。書込0を維持。
