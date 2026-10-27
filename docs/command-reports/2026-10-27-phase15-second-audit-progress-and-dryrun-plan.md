# Phase15 第2次READ_ONLY監査｜進捗報告と非書込DRY_RUN計画

基準指令：`92aad440f6a35f10680a021d7e2e43d41e0cc74c`。本番・COPY・GAS・トリガー・公開データ書込0。**本報告は未完部分を明示し、真正DRY_RUN完了を主張しない。**

## A. VありW空欄494件の原因別分類
本番 `エピソード台帳` A2:BC3381から、494件を実際に再抽出した。
- ニュースの学校／Megaphone RSS：466件
- AJW／Omny RSS：14件
- 報談／Megaphone RSS：4件
- ニュースの現場から／Omny RSS：3件
- MEDIA TALK／Omny RSS：3件
- スポンジ／Omny RSS：2件
- ドーナツ／Omny RSS：2件
計494件。ニュースの学校466件が94.33%。2024年10月〜2026年10月に多く、全件にV原文が存在する。原因の仮説は「Megaphone初期収蔵・移行処理でWを生成しなかった」。**処理コード・ログとの突合せが未完のため推定であり断定しない。** AJWは公開除外系統として修復実施範囲から除外判定を別にする。ニュースの学校EP-00081, EP-00082, EP-00093ではV原文ありWなしを直接確認。EP-00083〜00092など近傍にはW正常例があり、番組一括で一律の欠損ではない。

## B. 層化品質精査（機械判定一次チェック）
全6632件から番組・V/Wパターンで二分割して抽出。前半75件、後半74件、計**149件**の機械判定を実施。指定150件に対し1件不足。EP-06630は回帰対象として含む。EP-06631は抽出漏れのため未実施。

- 前半75：W空欄14、関連記事がVにありW/AC双方にURLなしの疑義2、該当検出なし59。
- 後半74：関連記事がW/AC双方にURLなしの疑義1、該当検出なし73。
- 合計：W空欄14、関連記事保存欠落疑義3、当該規則では欠落を検出しない132。
- ただしW空欄14件のうち記事URLの欠損と重複する例もある。未検出132件は「品質正常証明」ではない。
- 疑義例：EP-02302, EP-03358, EP-03781。W空欄の例：EP-00002, EP-00430, EP-00476, EP-00523, EP-00570, EP-00616, EP-00663, EP-00709, EP-00756, EP-00803, EP-00849。
- EP-06630：Vの記事3本はACに記載されておりWに記事URLがないだけで欠落とはいえない。ただし見出しとURLの表示責務は別途検査。
- 重要な制限：簡易URL抽出はURL文字列のみを比較し、記事の「見出し」、ゲスト固有SNSリンク、収録文脈、表現忠実性を評価していない。構造品質150件完成と判定しない。

## C. おんささんリンク
一次報告の共同編集6番組5385件（Spotify記載5385、Pocket Casts記載5372）を引き継ぐ。ドーナツ13件は未記載であり、リンク切れではない。現ターンの共同編集「ニュースの学校」先頭10件にSpotify/Pocket Casts個別形式URLが存在することを再確認。本番の同一エピソードとの多数軸照合、配信年月マトリクス、HTTP生存チェックは未完。GUID未一致、タイトル単独一致だけの自動転記は**禁止**。

## D. COPY向けmanifestと真正DRY_RUN準備
状態：`proposed_only`; `writes=0`; **真正DRY_RUNのProtection/Formula/RichText/Validation検査未実施**。候補（W未処理/Vあり）：
`EP-00081, EP-00082, EP-00093, EP-00430, EP-00476, EP-00523, EP-00570, EP-00616, EP-00663, EP-00709, EP-00756, EP-00803, EP-00849, EP-00002, EP-00022`。
上記は対象候補15セルであり**書き込み可能判定済ではない**。本番固定EP-IDを行番号に変換せず、COPYのGUID/IDから行を再同定する。

```json
{
 "ep_id":"EP-00081","target_column":"W","source_column":"V",
 "candidate_status":"pending_revalidation","expected_value":null,
 "copy_row":null,"guid":null,"source_sha256":null,"expected_sha256":null,
 "old_value_must_be_blank":true,
 "checks":{"ep_id":false,"guid":false,"source":false,"protected":false,"formula":false,"rich_text":false,"validation":false,"v3":false,"collision":false},
 "writes":0,"approval":"not_granted"
}
```

次工程ではCOPYの実体・行・GUID・V原文をREAD_ONLYで再読し、cleaning_policy_versionと出典時刻を付けた清掃候補を計算。候補値/old/new hash/保護・式・リッチテキスト・入力規則・V3/競合・ロールバックを記録して初めて`dry_run_pass`とする。EP-06631も回帰試験へ追加する。

## E. 清掃ポリシー案
`cleaning_policy_version=phase15-clean-v0.1-proposal`。Vは不変。話題の要点、固有の関連記事見出し＋URL、ゲスト固有リンク、出演者、収録日時等を保持し、共通広告と勧誘のみ構造に基づいて除外。部分語一致で「日本」などを落とさない。W非空修正は別ゲートとold/new/evidence/reason/hash必須。差分manifest：`ep_id,guid,source_revision,cleaning_version,old_hash,new_hash,change_reason,preserved_links,status,approved_at`。蔵は承認後に非公開差分のみ、宇宙はLAB再分類候補キューのみ。公開5848件・人間承認109件は不変。

## 司令塔向け受入判断
今回の確認事項は494件の内訳および簡易機械判定149件。**150件完全構造監査、正確なリンク補填件数、10〜30件真正DRY_RUN PASS は未達**。上記を満たす前にCOPY実書込は申請しない。
