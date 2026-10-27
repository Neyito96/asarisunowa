# Phase15 第2報：native hash 独立照合ゲートと安全停止再開LAB設計（2026-10-27 JST）
指令 6caea9d697ba80fad98859c1785fc4589c088eac。LIVE Sheets/GAS実行・変更0。第1報は同ブランチに別途保存済。

## ③ 55列行hash監査
- 現行COPY V3のidentity証拠はEP-06632〜EP-06636に存在し、実行ログは5件のhashVerified=trueを記録。これは**登録時実行自身の検証**であり、独立再計算ではない。
- EP-06594はidentity状態PENDING_REVIEW、元登録時identity hash欠落。一方、既存reviewedRegistrationEvidenceには2026-10-24現在スナップショットのcurrentRowHashが記録され、originalRegistrationHashMissing:trueである。このcurrentRowHashを過去登録時の原本証明へ遡及流用しない。
- GitHub現行指定ソースから`LibraryOfficialEngine.rowHash`のオンライン実装・55列正規化定義が確認できないため、ハッシュ値を推測で計算して成功扱いしない。検証 status: **BLOCKED_ROW_HASH_DEFINITION**（6件）。正式計算方式の証拠なしで異なるSHA256実装を採用しない。
- 次証拠: COPY GAS編集画面の `LibraryOfficialEngine` 定義中 `rowHash(row)` 完全ソース、全55列の表示値・native値・型、Utilities.DigestAlgorithmとUTF8変換・JSON.stringify手順・base64方式。閲覧のみ。以後、Apps Scriptコードの実行はせず、同仕様を独立実装（オフライン/非書込）し、既存V3証拠と逐次照合。EP-06594は登録時欠落と現行hash比較を別扱いする。

## 監視と正式収蔵の二層LAB設計
監視: 7公式番組の各RSS最新3 itemを低コストでREAD_ONLY収集、GUID/UTC pubDate/音声URL/取得時刻/フィードエラーを記録、配信有無の早期警告。これを取りこぼしゼロの根拠と誤認しない。
正式収蔵: RSS全新着と遅延/取りこぼし回収の別workerを一本化したauthoritative writerが処理。全フィード走査に永続checkpoint（source feed, page/etag cursor, last GUID/last successful time, cutoff）を持ち、3 itemを超えた分と7日超の回復期間を再走査。フィードごとにitems_seen/eligible_7d/source_new/existing/held/added/remaining/elapsed_msを区別。旧SDGsは独立policy決定まで保留。

## 6分上限のフェールクローズ
1. runner入口で総実行予算と停止目標を作成し、RSS fetch前・後、1フィード毎、全件索引前後、外部JSON/material取得前、RESERVED予約前に時間余裕をチェック。失敗なら書込せずcheckpoint保存の別承認を要する。
2. 実行中で予約が行われた場合は idempotent stage transition: NONE -> RESERVED -> LEDGER_WRITTEN -> V3_PROVED -> COMPLETED と、各段階のGUID・ID・URLハッシュ読取確認を実施。
3. 再開では「未完予約」のGUIDを単にknown扱いしてスキップせず、履歴/台帳/V3の実在と証拠をREAD_ONLYで突合したのち補修案を別承認。全て重複認定された場合は何も書かない。
4. LockServiceのscript lockは同一projectのみ。COPY writerと本番writerで共有できないため単一writer所有者・他worker停止の承認を先行。
5. EP-06632本番はこどもそうだんしつ、COPY同番号は別GUID。COPYの番号転用を禁止し、本番採番の予約/他writerが未検証な限り新しい提案IDはnull。
6. 本番新着登録、GAS/trigger修復、蔵・宇宙公開更新は独立承認ゲート。

## LAB回帰試験（設計だけ、未実行）
- 1番組4件配信：監視3件、正式workerは4件全部を欠損回収。
- 11件以上の新着：1回の上限を超えたものをcheckpointで次回処理。
- 8日遅配・停止復旧：7日窓を越えた候補を過去収蔵照合で回収。
- feed fetch失敗：SOURCE_PENDING、0件判定禁止。
- RESERVED直後/ledger直後/V3直後の停止：各状態を検出し、二重採番・空欄上書きなしで正規復旧。
- 他writerとの採番競合：競合時STOP、新ID自動割当禁止。
- 全件hash mismatch：対象行の変更禁止、別レポートHOLD。

## 未完
公式XML全件RSS差集合、E.rssのfetch実装とonline version、rowHash独立実算6件、本番writer全経路、02本trigger詳細は未確認。EP-06594の過去欠落は維持、COPYのRESERVED残存0や台帳/V3対応6636は既受入。変更0。
