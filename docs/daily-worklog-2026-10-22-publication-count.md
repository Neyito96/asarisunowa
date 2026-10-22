# 2026-10-22 掲載件数修正（本番公開完了）

最優先をSpotify試験から掲載件数へ変更。Sheets READ_ONLYで6591判定を再集計し、対象5848/対象外377/保留366。元本ID・番組全一致、人間除外指定0/削除履歴0。学校は485対象/1保留。C列対象5219＋日時差分113＋後継31＋学校485=5848であり、単純な「5500＋486」ではない。

6466はmanifest.totalでsource6591からアルキキ/AJW125だけを除いた値。D列への接続を実装し、EP-IDで公開ページ/検索/詳細を再生成する共通writerへ接続。公開snapshotは変更せず別previewへ5848件生成、掲載除外618/追加0/残る全エピソード内容変更0。表示日はRSSのsnapshotと掲載判定日を区別する。

宇宙は別repo。作業中のmain更新V0.10.5を取り込み、既存の地理機能等を保全した掲載判定patchを既存PR250へ保存。タイトルのアンコール誤除外EP04305を解消し、同じscope集合5848件へ合わせる。宇宙main自体には書込なし。

追加8/8、プレビュー既存25/25、旧公開既存24/24 PASS。モバイルCIで/tmpプレビューを使う追加確認を設定。元台帳/判定/Spotify/RSS/GAS/trigger/公開JSON/mainの変更0。公開承認前に実測内訳・差分・復旧を提示する。詳細はlibrary-publication-scope-2026-10-22.mdと対応auditフォルダー。

追記：ユーザーが5848件の正式掲載基準を承認。本番公開は未承認のまま。両画面の文言を「掲載対象5,848件・2026年10月22日掲載判定」に共通関数で統一。宇宙のV0.10.6（ジャカルタ追加）まで並行更新を保全。ブラウザーCIのaptミラー取得タイムアウトを、Playwright同版のブラウザー同梱コンテナに変更。コンテナ内HTTPサーバーのpython3指定・起動確認を修正。試験時だけモジュール状態を読み取って、星のEP-ID集合とscope集合の完全一致を検証する。

最終受入：e88c3f77f0db27abb3877f2a9e32f080e1e000e3 のCI 39772297498は全工程成功。Chromium/WebKitのiPhone 13相当画面で従来UI＋掲載判定＋宇宙の試験を完了。両方の表示は「掲載対象5,848件・2026年10月22日掲載判定」。宇宙のrowsとエピソードの星が採用5,848 IDと完全一致。画面6枚をartifactに保存し、WebKitの図書館詳細・宇宙画面も目視確認。詳細はlibrary-publication-mobile-acceptance-2026-10-22.md。本番公開/main/台帳/判定/GAS/Spotify/RSS/triggerの変更0。


---

## 掲載対象5,848件の本番公開完了（2026年10月22日）

- 図書館：https://neyito96.github.io/asarisunowa/library/
- 宇宙：https://neyito96.github.io/asarisu-universe/
- 図書館反映コミット：282b414f6157425871f9e55596a9ccc235efe7cc
- 宇宙反映コミット：187a6c655c48d6becc89b660ce7b0b03a3831127
- 両方の表示：「掲載対象5,848件・2026年10月22日掲載判定」
- 内訳：両方対象5,219＋日時差分113＋後継番組31＋ニュースの学校485。
- 公開データversion：134ffef496d755de
- 採用判定version：80b1a3a58a36a593d11bc0e64436c3af2d7652c3d2ac73ba017492df37ea1ac7

### 反映と検証

開始時の両main・復旧用ブランチ・PR headは引継ぎSHAに一致。既存隔離worktreeの547パス（474 blob、73削除）だけを図書館mainへ適用。未保存363 blobを保存し、全blob SHAとGitHub treeがローカル候補に一致。PR #250の一括マージ・新規PRなし。宇宙はV0.11.0/Nordicデザインを保全しindex.htmlの掲載関連差分のみ。保存原本とGitHub原本の差は末尾改行1文字のみと確認し、余分な改行を除去して適用。両ref更新はexpected_sha付き・force:false。

図書館Pages公開成功後、scope.json（5,848件）と共有moduleのHTTP 200を確認して宇宙を公開。宇宙PagesのHTML blobはefcbc3b731887421d7d587246b3aaafb2628bb60で反映内容と一致。

- 図書館Pages：https://github.com/Neyito96/asarisunowa/actions/runs/39776057911 （成功）
- 宇宙Pages：https://github.com/Neyito96/asarisu-universe/actions/runs/39776311554 （成功）
- 公開後LIVE受入：https://github.com/Neyito96/asarisunowa/actions/runs/39776707361 （成功）
- LIVE試験用の既存PR更新：5aa5b7053fe800a9444dcf3fdeccbdffe0ade490。mainへ一括マージしていない。

再開時8/8テスト成功、公開候補の一覧・検索・詳細の全ID集合はscopeの5,848 IDと一致。LIVEでは実際の両PagesをChromium/WebKitのiPhone 13相当画面で取得。両ブラウザーとも図書館5,848、宇宙5,848、学校485、検索・詳細リンク、保留EP-06591非掲載、通常回EP-04305アンコール掲載、宇宙rows/星のID完全一致、宇宙の横はみ出しなし、JS例外0。試験用フックはブラウザー応答だけに挿入し、本番HTMLには保存していない。実機iPhoneの手動試験ではない。

元台帳6,591件・判定シート・GAS・Spotify・RSS自動収蔵・既存トリガーは変更なし。掲載除外618件、新規ID追加0、残るエピソード内容変更0、元台帳削除0。

### 復旧方法

両repoのbackup/publication-before-20261022を保持。
- 図書館：cd8250584ea1a938b29db97ac6c813dfb4d04ad0
- 宇宙：c423f538cdf86966b201642cea6507fe6647fcb2

最新mainを再確認して並行変更を保全し、宇宙187a6c6の掲載変更を先にrevertしてPages成功を確認、その後図書館282b414の掲載変更をrevertする。逆順では新宇宙が旧図書館のscope欠落で読込失敗するため、宇宙を先に戻す。force resetやバックアップtree全体での上書きはしない。ref更新はexpected_sha付き・force:false。

残課題：実機iPhoneの手動確認は未実施。公開作業上の未解決事項なし。
