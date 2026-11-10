# 第24号: ICC重複(EP-06591)・概要清掃反映・出演者検証の3分割・重複予防

READ_ONLY/非公開プレビューのみ。本番台帳・GAS・Spotify・トリガー・main・公開サイトは未変更。EP-06591の整理(削除/統合/ID変更)と公開判定の変更は**管理人の別承認**。

## 1. EP-00418 / EP-06591（司令塔の台帳照合値を fixture 化: tests/fixtures/duplicate-icc-2026-11-10.json）
| 項目 | EP-00418(正規候補) | EP-06591(重複HOLD) | 判定 |
|---|---|---|---|
| 題名 | ICC赤根**智**子所長への制裁 | ICC赤根**知**子所長への制裁 | 漢字1字差(編集距離1) |
| 日時 | 2026-08-26 04:00 JST | 同(台帳表記 2026/8/26 4:00 → UTC分で一致) | 一致 |
| Spotify ID | 02JGdAOh1TT4QxGbFDDXRq | 同 | **一致(強ID)** |
| GUID | あり | 空欄 | 比較不能(欠損) |
| 概要V/W | あり/あり | 空欄/空欄 | 正規側が充足 |
| 由来 | Megaphone RSS | COPY_1007 | |
- 検出結果: `CANDIDATE_DUPLICATE`(強ID一致+日時一致+題名近似)。正規候補=EP-00418、EP-06591は**重複HOLD維持**。
- 統合案(実行しない): ①EP-06591は非公開のまま保持 ②正規側に取り込む情報は無い(GUID/概要/公開判定は正規側が充実) ③管理人承認後に、台帳上でEP-06591を「重複(EP-00418)」と明記する/除外へ移す、のいずれかを選択。削除・EP-ID変更はしない。
- 全5,946件(プレビュー5,945+EP-06591)走査: 候補は**この1組のみ**(`scripts/scan-duplicates.mjs`)。
- Phase26: `auditRow(row,{duplicateOf})` で空欄列を `HOLD/DUPLICATE_HOLD` に分類。「新規エピソードの概要欠損」として埋め提案を出さない。

## 2. 概要清掃の反映（蔵→宇宙）
- `public/library/description-sync.mjs`: 清掃済みW列が真値。W空欄なら既存を消さず、清掃済み→原文へ戻さない。冪等。
- 実測(手元の台帳CSV122行のうち公開対象119件): 台帳に清掃済みあり99、反映済み82、未反映17(原文表示16+文面差1)。詳細と検索索引の不一致0。差分同期後は99/99反映・再実行変更0・出演者検証も維持。
- **ニュースの学校の499件**: 既存プレビューは清掃済み反映33件/原文表示466件。台帳のW列値そのものはこのリポジトリ側に無く、**反映の一致は未検証**(司令塔の「499件に清掃済みあり」を反映するには、V/W列を含む台帳CSVが必要)。EP-00418はプレビュー上 raw-rendered。

## 3. 出演者検証の3分割（固定値なし）
`verify-cast-oracle.mjs ORACLE.csv PREVIEW_DIR REPORT.json [DUP_HOLD_IDS.json]` は公開判定(scope.publishedIds)から算出。合格条件は公開対象の一致・3系統一致・再実行0。

## 4. 重複を増やさない仕組み(`public/library/duplicate-detect.mjs`)
- 強ID: SpotifyエピソードID / GUID / 音声ID。補助: 番組+日時(UTC分、JST表記とISOを正規化)、番組+正規化題名(NFKC・記号除去)。
- 漢字1字誤表記=題名の編集距離(長さの約1割まで)。GUID欠損=強IDがSpotify/音声で一致すれば候補。日時TZ差=1時間単位のずれは `TZ_OFFSET_SUSPECT`。別取得元の二重流入=強ID/日時/題名のどれかで同じ候補ブロックに入る。
- 断定は強ID一致+(日時一致 or 題名近似)のみ`CANDIDATE_DUPLICATE`。それ以外の曖昧は`HOLD_AMBIGUOUS`。**自動で削除・統合・ID変更・公開追加はしない**。人間の確定済み同士の衝突は`HOLD_CONFLICT_NEEDS_HUMAN`、人間の保留/除外が付いた側は変更提案なし。
- 取り込み前ガード `checkIncoming`: 既存と候補が出たら ADD せず `HOLD_DUPLICATE_CANDIDATE`。未配線(日次取り込み/COPY GASへの組み込みは管理人の一括承認後)。
