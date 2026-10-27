# Phase15 Lite｜専用GAS実機引継ぎ・7番組×最新3件LAB検証
2026-10-28 JST
## 実機識別と境界
- READ_ONLY試験専用GAS: `Phase15_Lite_READ_ONLY_TRIAL`
- URL: https://script.google.com/home/projects/1sn7SS8awam-hqcKspk4sEJ8gmc3zqjeo-TH6MeoEeRXsFhrKNwltJvxS/edit
- 2026-10-28 07:26 JSTに7フィード/5,426件、約22秒のREAD_ONLY実機成功は**司令塔からの引継ぎ報告**。こちらで再実行・独立ログ検証はしていない。
- 現行ONLINE `LiteGas.gs`はSheets API read-only方式へ改修済みという引継ぎ。**オンライン原文未取得、GitHub LABの `LiteGas.gs` (`SpreadsheetApp.openById`)とは異なる。** 現行オンラインの関数・実サービス・OAuth範囲は未証明。URL共有のみでは編集・閲覧権限を与えない。
- この専用GASと既存本番「朝ポキ｜本番ロボGAS」、COPY「朝リスの田_Phase14_COPY_20261023」を混同禁止。

## GitHub LABコードと実行試験
- `LiteLatestThree.js`: RSS `pubDate`有効性を検証して番組毎に日時降順3件を選び、本番台帳GUID・元ページURL/公式個別URLへ照合する純粋計算部分。
- `LiteLatestThreeGas.gs`: **未設置・未実行の旧SpreadsheetApp型アダプター草案**。現行オンラインSheets API方式への直接コピーを禁じる。Sheets API方式に即した適合はオンライン原文との別途差分審査が必要。
- `latest-three.test.js`: GitHub取得原文を独立JavaScript実行環境で実行。**9/9 PASS、例外0件**。Node `require` は隔離実行環境用に依存注入へ置換したため、「Node.js CLIでの試験」とは主張しない。
- テスト：逆順5itemから3件、RSS並び順非依存、日時不正SOURCE_PENDING、登録済EP-ID、番組間GUID重複、URL既存疑いUNKNOWN、GUID欠損、RSS失敗null、無採番無書込。
- このturnでオンラインGASを変更・実行していない。LIVEの21件表・各件GUID/タイトル/日時/登録判定は**未取得**であり想像で埋めない。

## 次の決裁点
司令塔によるオンラインREAD_ONLY専用GAS現行 `LiteGas.gs` とSheets API読み取り境界の原文確認。オンラインGASの現行動作を触らずLABで最新3件の純粋ロジックとの接続/依存関係を確認した後、ユーザーから設置・単発実行の明示承認を得る。旧SDGs/AJW/アルキキ/YouTubeはLite対象外。GUID未一致3909件の全件調査対象外。
## 判定
`LAB_LATEST3_9PASS / ONLINE_ADAPTER_DIFFERENCE_UNVERIFIED / LIVE_21_PENDING / ONLINE_CHANGE_NO_GO`。本番EP-06632保護、COPY側ID本番転用禁止。本番/COPY/GAS/Triggers/公開への書込0。
