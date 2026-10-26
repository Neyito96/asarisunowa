# Phase14 COPY公式RSS/JSON真正DRY_RUN｜2026-10-26 22:24 JST

## 実機結果
関数 `phase14BackfillFiveOfficialDryRun` をユーザーがCOPY GASで実行。22:24:11開始、22:24:33〜34終了（約23秒）。

- sourceChecks: EP-06627/06630/06631 のOmny公式JSON HTTP_200、EP-06628/06629のMegaphoneはNOT_APPLICABLE_MEGAPHONE
- 5件すべてRSS照合成功、holds=[]。
- plans: EP-06628 P列 再生時間（秒） 1件、EP-06629 N列 画像URL 1件/P列 再生時間（秒）1件、計3セル。EP-06627/06630/06631は予定0件。
- 実行ログ: writes=0, propertiesChanged=0, triggersChanged=0。これらのフィールドはコード上の定数であり、それ自体は外部変更の独立測定ではない。

## 実行前後のSheets独立再読
実行前の固定スナップショット `docs/phase14/backfill-five-prerun-snapshot-2026-10-26.md` と、実行後Sheets API `UNFORMATTED_VALUE` 再読値を比較。
| EP-ID | 台帳チェックサム | V3状態チェックサム | 採番履歴チェックサム | 前後一致 |
|---|---|---|---|---|
| EP-06627 | 96fce01e | 9df523f1 | 27d92f94 | Yes |
| EP-06628 | 83de95d1 | 6bf12990 | 1dcb74f2 | Yes |
| EP-06629 | e9747fc6 | 81bc29f3 | c44f2a12 | Yes |
| EP-06630 | b7c88c06 | b97d3387 | 5244a8e4 | Yes |
| EP-06631 | 9de2d4bf | 916c3e39 | bf8fd4a1 | Yes |

各行EP-ID/GUIDと採番履歴一致。上記対象の本番・COPYの値変更0を独立確認（FNV-1a32を差分検出用途に使用、暗号学的なV3 proof hashではない）。

## トリガー・ScriptProperties
事前画面にCOPY朝トリガー2件 `phase14CopyMorningRunnerV19`、5:11と6:15最終実行、双方エラー率0%を確認。**実行後画面は未確認**のためトリガー2件の前後不変は未確定。ScriptPropertiesの前後値スナップショットは取得しておらず、変更なしと独立実証はできない（コードにsetterは無し）。

## 保留
EP-06630の関連記事3本とEP-06631ゲスト固有リンクは、既存W列を変更せず修正案のみ。EP-06632は補填ロボ対象外、採番禁止。
公式JSONの3件HTTP200は確認済みだが、DRY_RUNの候補抽出列はJ/N/O/P/V/AZ/BAのみ。保護範囲（Protection）の列挙は未実装。画像URLと時間の実値はログに出さない設計で未確認。
3セルは**補完候補**であり未書込。COPYへ実書込するなら別途承認・保護範囲検査・再実行0件試験が必要。

## 変更
GitHub報告書のみ。COPY既存トリガーやGASの既存関数はユーザー操作で変更していないとの操作手順。手動で新規DRY_RUN関数1本追加。既存W・本番・Spotify・公開データ・EP-IDには変更なし。
