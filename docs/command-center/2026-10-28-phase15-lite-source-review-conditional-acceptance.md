# Phase15｜Lite ソースレビュー：LAB受入・実機設置は条件付き保留
2026-10-28 JST
対象: Neyito96/asarisunowa `lab/phase15-safe-ingest-engine-20261027` commit `0c7d488904b19b2cbd1f600b1940c4a4813fbc53`
司令塔が `lab/phase15-safe-ingest/lite/LiteCore.js`, `LiteGas.gs`, `lite.test.js`, `README.md` を直接取得し静的確認。13/13 PASSは担当ロボのローカル実行報告でありGitHub checkout/GASでの独立実行は未実施。

## 判定
LABの純粋なREAD_ONLY比較器は受入。オンラインGASへの設置・実行は引き続き承認待ち。本番書込は全面NO-GO。

## 最小P0確認と具体的成果（GitHub LABのみ）
1. GAS adapter `LiteGas.gs` は `取得元一覧` の A列=番組名、H列=RSS URL と決め打ちする。既存本番オンライン実物に対する列名/番組名/URL整合の証拠をREAD_ONLY資料で確認。未確認なら無理に列を固定せず `STOP_SOURCE_SCHEMA_UNVERIFIED` を返す。実データの編集禁止。
2. 7番組すべての公式URLについて、現行許可規則 OMNY/MEGA に適合するか検証。URLの変種、RSS item guid XMLの扱い、HTTP失敗・redirect後ドメイン・HTML応答・空XML・GUID欠損をGAS mockアダプターでテスト。実RSS取得の成功を未確認のまま保証しない。
3. `LiteGas.gs` の `SpreadsheetApp.openById` を含む読取境界を fake SpreadsheetApp/fake UrlFetchApp/fake XmlServiceで注入・テスト。HTTP接続と台帳列読取りと7番組展開が正しいこと、`setValue/setValues/appendRow/insertRows` やトリガー/Propertiesを呼ばないことをcall spyで立証。
4. ログには件数と必要最小限のタイトル/公開URLのみを出し、V原文・個人データ・トークンは出さない。RSS未取得は常にSOURCE_PENDING、新着0件と区別。
5. 重要：Lite対象7番組の限定は2026-10-28時点の軽量版監査範囲であり、旧SDGsの今後の正式収蔵対象ポリシーを決定したものではない。
6. 差分コード・追加テスト・明示的なschema証拠またはBLOCKED理由・commitをLABブランチに報告。抽象メモだけで終えない。

## 実機READ_ONLY試験への段階的移行
上記に合格した後に限り、司令塔がユーザーへ「どのGASへどのファイルを追加し、どの関数を手動実行するか」を1操作ずつ案内するため、別途承認を求める。実行中も台帳・GASの既存関数は変更せず、採番・収蔵・トリガー設置を行わない。
