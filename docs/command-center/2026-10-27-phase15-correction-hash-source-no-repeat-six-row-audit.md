# Phase15｜誤リンク訂正・hash全文既取得・6件独立検算指令
2026-10-27 JST｜司令塔訂正。前回のチャット伝達にあった `Neyito96/asarisuniverse/blob/main` は**誤り**。宇宙の正しいrepoは `Neyito96/asarisu-universe`、収蔵監査の正式repoは `Neyito96/asarisunowa`。
正式な既存指令：`audit/command-center-resume-20261027/docs/command-center/2026-10-27-phase15-hash-definition-confirmed-six-row-verification.md`、commit `9b906055029fdddbb05af722102bee26017a7844`。司令塔は現在のGitHubファイルからその記述を再確認。
提出報告：`audit/phase15-hash-source-evidence-20261027/docs/command-reports/2026-10-27-phase15-hash-method-interim-evidence.md`、commit `e2168845f7dad986da48356989d8a339b8905cc9`。この報告の「hash(x)全文未取得」は、**その提出者が当該チャットで原文を受け取れていない**という意味。司令塔のチャットには既にユーザーから以下の原文が直接提供されているため、再度Macで探すよう要求しない。
```js
function rowHash(row){return hash(row);}
function v3RowHash(row){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(row)));}
function hash(x){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(x),Utilities.Charset.UTF_8));}
```
ただしオンライン定義元ファイル名/版数、55セルの値・型・JSON化規則、各呼出箇所はまだ完全には確定していない。hash 6件をPASSとはしない。

## 次工程（READ_ONLY、実機コード実行は禁止）
1. まず上の全文を真正な**ユーザー提供コード**としてGitHub監査文書に記録。 `rowHash→hash→JSON.stringify→SHA256(UTF8明示)→base64EncodeWebSafe`。v3RowHashはcharset省略で、入力一致とエンコード同値を検証する。
2. COPY現行台帳55列について、V18がハッシュ対象にしている正確な配列形成/日付型/空欄/シリアライズ/呼出箇所のソースを確認。すでに判明している関数全文を再要求しない。ソース名が未確定で再確認が必要なら最短の画面確認のみ依頼。
3. READ_ONLYでCOPY EP-06632〜06636およびEP-06594の6行と既存V3 proofを取得。独立計算（GASではなくオフライン）で`current_native_hash/stored_proof/proof_type/match/status`を照合。入力再現不能ならBLOCKED_INPUT_RECONSTRUCTION、合致は一致が判明した対象・時点だけPASS。EP-06594の登録当時の欠落は事後値で補填不可。
4. 本番EP-06632は保護。COPY IDs転用禁止。公式RSS全日差集合SOURCE_PENDING、本番writerはNOT_VERIFIED。7×3はREAD_ONLY監視、正式収蔵は全新着対応。
5. GitHub監査ブランチへの報告以外、本番/COPY/GAS/trigger/Properties/公開への書込0。RSS再実行、GASコード編集/実行、本番復旧や公開は未許可。

**提出** まず上記コード受領の確認と、配列組立ルール・6行照合結果（不明部分を明記）をGitHubへ記録し、commitで報告。
