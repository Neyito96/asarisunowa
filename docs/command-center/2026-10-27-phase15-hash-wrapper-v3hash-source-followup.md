# Phase15 司令塔｜rowHash / v3RowHashの実コード受入・hash本体確認
2026-10-27 JST | READ_ONLY。
ユーザー提供オンラインコード：
```js
function rowHash(row){return hash(row);}
function v3RowHash(row){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(row)));}
```
## 判定
rowHashはhash(row)のwrapperであり、hash()定義が無ければ再現不能。v3RowHashはJSON.stringify(row)→SHA256 digest→base64EncodeWebSafeの別関数。両者の等値は未確認。Apps Script base64EncodeWebSafeの出力形式と入力行型/空欄/55列順を保持して独立再実装する必要がある。二つの関数名から用途を推定するのみでは元V3 proof一致を保証しない。
## 最優先READ_ONLY
1. COPY GAS エディタで `function hash(` / `hash =` / `hash:` を検索し、実定義と呼び出すヘルパー、ファイル名、コード全文を保存。秘密情報は伏せる。
2. V18/V19およびV3登録時の `rowHash(` / `v3RowHash(` / `hash(` 各呼出箇所を確認。新着登録にどの関数が使われ、V3のどのフィールドに保存されるか表にする。
3. 元行 `row` が `getValues()` 由来か、55列のどのカラムと変換を経たか、Date/空値/型/配列JSON構造/文字コードを確認。rowHashとv3RowHashを混同せず独立検算する。
4. EP-06632〜06636とEP-06594のハッシュ検証はこの原典確認後にREAD_ONLY実行。EP-06594の登録時欠落を現在値で埋めない。
5. 本番EP-06632とCOPY同ID衝突保護、COPY番号の本番移植禁止。公式RSS差集合SOURCE_PENDING、本番writer未特定。実書込・GAS実行・トリガー変更・公開は禁止。
GitHub監査ブランチへコード照合結果と検算手順を保存しcommit付き報告。
