# Phase15 司令塔｜EP-06632 55列入力忠実度監査受入・原生型READ_ONLYゲート
2026-10-27 JST。本番/COPY/GAS/トリガー/Properties/公開の実書込禁止。

## 受入根拠
提出監査 `audit/phase15-ep06632-input-fidelity-20261027/docs/command-reports/2026-10-27-phase15-ep06632-typed-input-fidelity.md` コミット `526094577730858984be61d02d190a528beb81dc`、司令塔直接確認blob `dcff0030211013e6d1275361fdc6f1f1fd0e293b`。
V18オンラインコードに `ledger.getRange(lRow,1,1,55).getValues()[0]` → `E.rowHash(actual)` → V3 proof保存、さらにV3保存後再readbackの証拠。対象は台帳へappend後の55セル原生値。
EP-06632 COPY台帳 A6633:BC6633 全55セル、値あり27・空欄28。connectorのD列 `2026/10/27 4:00`、P列 `2088`は**表示/文字列相当の取得結果**であり、Apps Script getValues()のDate/number/stringを証明しない。null→empty変換による一次計算と保存proofが不一致、HOLD_INPUT_RECONSTRUCTION維持。

## P0 次工程：原生型をコード実行せず識別
1. GOOGLE Sheets REST APIのREAD_ONLY経路でCOPYの特定行のみ `spreadsheets.get`（fields= sheets(properties(sheetId,title),data(rowData(values(userEnteredValue,effectiveValue,formattedValue,userEnteredFormat.numberFormat,effectiveFormat.numberFormat))))）など限定fields、または `values.get`の `valueRenderOption=UNFORMATTED_VALUE` と `dateTimeRenderOption=SERIAL_NUMBER` を用いて D,P と少数の型疑義列を対照。認証可能なREAD_ONLYの実際の経路がなければ実施不能と記録。Apps Scriptエディタから関数を新たに実行しない。
2. D列で`userEnteredValue/effectiveValue`と日付書式を確かめ、Sheetsシリアル値がApps Script getValues()でDateになったかを区別。Dateなら`JSON.stringify(Date)`のISO UTC文字列とスプレッドシート時間帯の扱いを検証（日時の意味やtimezoneを推測で上書きしない）。
3. P列`2088`の`numberValue/stringValue`を確認。その他55セルの数値・真偽・日時も同じ検査で抽出。空欄28個は元入力範囲の空セル/空文字式/保存後変更を区別。
4. ハッシュ保存時刻は05:11登録時点。現行55列の型を回復しても当時の値と等しいとは限らない。固定ID採番履歴/既存実行ログ/当時の証拠と対比し、保存後編集の有無は`NOT_VERIFIED`で管理。
5. ハッシュ再計算は**EP-06632一件だけ**、ソース根拠付きの型変換が確定してから一回ずつ比較する。何通りもの日時/数値候補総当たりで偶然一致を探さない。相違なら`HOLD_NATIVE_INPUT_OR_HISTORICAL_MUTATION`として残り5件へ展開しない。
6. `rowHash`と`v3RowHash`の証拠対象、55列の型とApps Script JS JSON stringify parityをLABで記録し、不一致時の原因分類を示す。EP-06594の10/24 currentRowHashは歴史スナップショットであり原登録証拠ではない。

## 並行課題と安全線
公式RSS 10/27の全差集合 SOURCE_PENDING、本番writer NOT_VERIFIED。二層（7番組各最新3件の監視・完全正式収蔵）と旧SDGs方針未承認。EP-06632本番オリジナル保護、COPY IDの本番採番転用禁止。GAS実行/編集・trigger/Properties変更・本番/COPY書込・main/Pages公開変更は禁止。

## 次報
EP-06632のD/Pと55列型のエビデンス（APIのvalue型と書式、実取得時刻）、05:11時点との比較可能性、ネイティブ型忠実度と暫定ハッシュ再計算判定をGitHub監査ブランチ`docs/command-reports/`に保存してコミット報告。API権限・フィールドが取れなければ、正確に何が取れないかを報告し、ユーザー画面でのREAD_ONLY手順を最短で案内。
