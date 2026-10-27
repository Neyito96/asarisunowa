# Phase15 司令塔｜hash実コード確認・6件のREAD_ONLY独立検算
2026-10-27 JST
## 新たなオンライン原典（ユーザー提供）
```js
function rowHash(row){return hash(row);}
function v3RowHash(row){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(row)));}
function hash(x){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(x),Utilities.Charset.UTF_8));}
```
rowHash→hash→JSON.stringify→SHA256(UTF8明示)→Base64WebSafe。v3RowHashは同じdigest方式だがcharset省略。入力データ/型/serializationが等しいこととApps Script charset既定値の一致を確認するまではハッシュ等値を未確定とする。
## P0 具体的な検算
1. V18のrowHashとv3RowHashの呼出箇所、対象55列の配列生成（getValues vs getDisplayValues、Date、空欄/式/型、列順、JSON.stringifyの具体形）をREAD_ONLY確認。
2. COPY EP-06632〜06636の元台帳55列、およびEP-06594の現行55列をREAD_ONLY取得。現行の同じ配列でオフライン別実装SHA256+WebSafeBase64を再計算。V3 identity proof、2026/10/24 currentRowHashと比較する際は**どの時点のデータか**を注記。ハッシュ値をコピーペーストでPASSにしない。
3. 各行に`input_reconstructed / actual_new_hash / stored_proof / proof_type / matches / status`を添え、入力が未確定なら`BLOCKED_INPUT_RECONSTRUCTION`、ハッシュ一致でも登録時証拠を新規作成したと扱わない。
4. EP-06594はoriginalRegistrationHashMissingが10/24以前からあり、現在値を原登録時証拠に転用しない。
5. E.rssの最新3件制限なし、8 feed全件取得と6分予算の問題を継続管理。本番writerの実体と公式RSS全件差集合はSOURCE_PENDING/NOT_VERIFIED。
6. 本番EP-06632保護、COPY-ID本番流用禁止。GAS実行・コード変更・トリガー変更・本番/COPY/V3/Properties/公開への実書込禁止。GitHub監査ブランチへ根拠と検算結果を記録しcommit報告。
