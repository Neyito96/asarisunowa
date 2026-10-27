# Phase 15｜6行独立ハッシュ一次検算（2026-10-27 JST）

## 原典
司令塔訂正指令 commit a586176b9fef0e4930633291b78b2a356b14d4f1 を全文確認。ユーザー提供済オンラインGAS定義：
```js
function rowHash(row){return hash(row);}
function v3RowHash(row){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(row)));}
function hash(x){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(x),Utilities.Charset.UTF_8));}
```
55列の入力型・変換の特定までは未完。

## READ_ONLY 取得と独立計算
COPY `エピソード台帳` の6行、`図書館V3・項目状態`の該当行をLIVE READ_ONLYで取得。台帳APIから末尾空欄が省略された行は長さ55に補った。APIのnullを空文字へ変換して55要素配列をJSON.stringifyし、オフライン独立実装のUTF-8/SHA256/websafe Base64を計算。標準SHA256('abc')のbase64url値 ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0= と合致。

| EP-ID | current reconstructed hash | saved V3 identity hash | first comparison |
|---|---|---|---|
| EP-06632 | RDb6rBxf1MHi6DBoHIkZZC066ztULk9ldF4aK8W7Jzw= | LBArvuq6_Tn46Yh7tAromR_efyicCLVoqMrkvPvRKgw= | MISMATCH_INPUT_UNVERIFIED |
| EP-06633 | -0X5cftxu2N1-v32tYNxA-8h-LGJjJc8T602_DLjHqY= | xaP4oe8wKwa-D_t0Ys7AahuPDnMlKJKed0cG9rF-Gn0= | MISMATCH_INPUT_UNVERIFIED |
| EP-06634 | NnObJIc4LVA-gsOMtOMPLNBO7EwLtPaE2vvdnQV7CiM= | KOPwhfZSMxtJuptOMJY2-S54kTIJ6eNlOwxxPrh-S2Y= | MISMATCH_INPUT_UNVERIFIED |
| EP-06635 | nodOnkh8j0qEWAry998CchC7FiDitVNOeboRy6c2whM= | Q90nKZhKpQrvcHWFEAcd65YoiEAYsbHRwKkqgschFFI= | MISMATCH_INPUT_UNVERIFIED |
| EP-06636 | Lb02WkvAi7gGrFkeqyes6FYYiYsKe_GjHLHRFSxduBc= | vMGHdqa74PJP2hqBstTHtZOEgZ0xjeC-lPwcybWq6bo= | MISMATCH_INPUT_UNVERIFIED |
| EP-06594 | 5cT-Ah6oYR02H2WVwiQS5YiwCklqEV9FI7f0kWdTRKU= | original missing; 10/24 reviewed current NM0vM951955SgBw16EE-sN6rTmU3Bl0pS_uLqy139G8= | CURRENT_VS_OLD_SNAPSHOT_UNVERIFIED |

### 解釈上の重要な制約
Sheets connectorが返す値（null/文字列/型）とApps Script `getValues()` のDateオブジェクト・実値が等価か未証明。JSON.stringify(Date)はISO形式、日時文字列や表示値とは異なる。元行の登録時と現行行の時間差・変更の有無も未確定。ハッシュ不一致を破損と断定しない。6件すべて**HOLD_INPUT_RECONSTRUCTION**、PASS0。EP-06594は登録時証拠が元から欠落し、現在値で遡及補填禁止。

## 次の調査ゲート
- Apps Script `E.rowHash(ledger.getRange(...).getValues()[0])`におけるセル型と、Google Sheets API connectorの型変換規則をREAD_ONLY確認。とくにD列日付と55列末尾空セル。
- 全55列の原型を失わず読み取れるAPI経路とApps Script計算との等価性確認を行う。GAS実行は禁止。
- 本番EP-06632は保持、COPY ID流用なし。RSS全日差集合SOURCE_PENDING、本番writer NOT_VERIFIED。
- non-GitHub writes 0。
