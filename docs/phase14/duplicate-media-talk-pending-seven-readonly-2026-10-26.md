# Phase14｜2026-10-26 MEDIA TALK重複3組／PENDING7件 READ_ONLY監査
## 出典・変更境界
司令塔 `docs/command-center/2026-10-26-kurabito-v3-second-audit-intake.md`、本番Sheet「エピソード台帳」A2:P6633とA6593:BC6633、V3状態A6593:C6633を直接照合。Google Sheets / GAS / 採番履歴 / COPYトリガー書込0。GitHubの監査コード・報告書のみ新規保存。
## MEDIA TALK重複候補
|旧EP-ID → 新EP-ID|新GUID（旧G列は空欄）|配信日時（新旧一致）|再生時間（秒、新旧一致）|音声URL|公式ページ|判定|
|---|---|---|---:|---|---|---|
|EP-03857 → EP-06595|dd169c36-40c0-4cf4-9b1d-ac14008566ab|2020/8/12 10:00|2823|旧O空欄、新Oは同GUIDのtraffic.omny.fm MP3|旧J=https://www.asahi.com/special/podcasts/item/?itemid=dd169c36-40c0-4cf4-9b1d-ac14008566ab ; 新J=https://omny.fm/shows/asahi/2-1-75|強い重複証拠／音声同一性は未直接検証|
|EP-03858 → EP-06596|1545b33c-84e9-4302-806a-ac1400858106|2020/8/13 10:00|3691|旧O空欄、新Oは同GUIDのtraffic.omny.fm MP3|旧J=https://www.asahi.com/special/podcasts/item/?itemid=1545b33c-84e9-4302-806a-ac1400858106 ; 新J=https://omny.fm/shows/asahi/2-2-75|強い重複証拠／音声同一性は未直接検証|
|EP-03861 → EP-06597|3303d8d0-a941-488e-ab22-ac1700443eaa|2020/8/16 11:00|2231|旧O空欄、新Oは同GUIDのtraffic.omny.fm MP3|旧J=https://www.asahi.com/special/podcasts/item/?itemid=3303d8d0-a941-488e-ab22-ac1700443eaa ; 新J=https://omny.fm/shows/asahi/2-5-75|強い重複証拠／音声同一性は未直接検証|
各組の旧・新B列番組名MEDIA TALK、C列タイトル完全一致。旧Jのitemidが新GUIDと一致するため同じ配信実体である可能性は非常に高い。ただし旧O空欄によりMP3同一バイト列確認不可。ID統合・削除は保留。
## PENDING_REVIEW 7件
EP-06594、EP-06627、EP-06628、EP-06629、EP-06630、EP-06631、EP-06632。V3のidentity[0]は全件PENDING_REVIEW、identity[2]の保存ハッシュは全件空欄。**以前の直近6件=EP-06627..06632**にEP-06594を加えた7件。差分はEP-06594のみ。
**native55列ハッシュ検証の限界**：Sheets APIはセル表示値を返すがGAS `getValues()` のDate等の型・JSON.stringify正規化と同一である証拠にならないため、実測native SHA256はこの環境で未実施。保存済みV3ハッシュも空欄なので一致判定不可。7件のハッシュ値を捏造しない。
次の専用READ_ONLY関数をGitHubに追加：`scripts/google-apps-script/Phase14AuditPendingSevenNativeReadOnly.gs`。本番GASで手動実行すると各行55列の型付きハッシュ・identity status・採番履歴整合をログ出力する。**関数はまだ実機未実行**。PENDINGをVERIFIEDに書換えない。
## 未解決と停止線
1. 本番GASネイティブ55列の7件ハッシュ採取および登録証跡との比較（READ_ONLY）。
2. MEDIA TALK旧3行の公式itemidと新GUIDを同一性の主要証拠としつつ、音声バイト一致・公開スコープ/除外判断は未確定。
3. V3状態のPENDING→VERIFIED、EP-ID統合・再採番・削除は別途ユーザー/司令塔承認が必要。
4. 本番/おんさ/Spotify/COPYトリガー/公開JSON/Pagesは変更していない。