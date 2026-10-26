# 朝ポキ｜本番ロボGAS 運用開始記録（2026-10-26）

## 対象と位置づけ
本記録は、2026-10-26の会話冒頭で正式エピソード台帳を確認したところから、当日の本番GAS初期設定、監査、補填試験、概要清掃修正までの一連の履歴。**ユーザーが実行ログで報告した事実と、Google Sheetsへの直接書き込み・再読確認の事実を区別**する。

- 正式台帳（Google Sheets ID）: `1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4`
- 台帳名（画面確認）: 「朝ポキの田｜正式エピソード台帳【本番】」。旧名「朝リスの田｜独立エピソード図書館・調査台帳 2026-10-10」。名称変更はIDに影響なし。
- 本番GASプロジェクト名: 「朝ポキ｜本番ロボGAS」
- 本番GAS Script ID: `1Ywoelv_gnS6oJQz7CDbAn6PZaS4l2lty-XmhHJUdk9-K5PmvwAE79JJV`
- COPY検証台帳ID: `1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY`（別系統）
- COPY GAS Script ID: `1roni6h_C9vKxtP_2I6jGgXKE2KJ1yRRhE3ZD1JsZ6XXRnT5RcndqyfJo`
- 方針: **同一の本番GASに収蔵ロボAと補填ロボBを置く**。コードと実行関数を分離し、安全装置は共通化。COPY GASは別プロジェクトのまま。現在、本番自動運転・時間トリガーは未導入。

## 1. 本番台帳とGASの特定
ユーザーが旧日付付きの「2026-10-10」台帳名を確認。正式台帳と認定し、画面上では「朝ポキの田｜正式エピソード台帳【本番】」に名称変更済みと確認。既存の本番GASコードが空であることをユーザーが確認し、最初にREAD_ONLY監査を入れる方針を採用。

## 2. 本番READ_ONLY監査（11:40 JST）
ユーザー実行ログ:
- `mode=PRODUCTION_READ_ONLY`
- `total=6626`; `lastId=EP-06626`; `reviewed=34`
- `missingHistory=[]`; `guidMismatch=[]`; `missingStates=[]`
- `triggerHandlers=[]`
- `status=READY_FOR_NEXT_REVIEW`; `writes=0`; `triggerChanges=0`; `propertyWrites=0`
解釈: EP-06593〜06626の34件について履歴/GUID/V3状態の不整合は検出されず。全履歴について全項目の正しさを保証する監査ではない。

コード: `scripts/google-apps-script/Phase14ProductionPreflight.gs`

## 3. 補填ロボB1 直近10件DRY_RUN（11:51 JST）
新規ファイル: `scripts/google-apps-script/Phase14BackfillRecentTenDryRun.gs`
コミット: `cae38b06d0766cd33f1857ecac66500280842ec4`

ユーザー実行ログ:
- `mode=PROD_B1_READ_ONLY_DRY_RUN`, `range=A6618:BC6627`
- `inspected=10`, `needsBackfill=3`, `clean=7`, `status=DRY_RUN_ONLY`
- `writes=0`, `triggerChanges=0`, `propertiesChanged=0`
- EP-06618（ニュースの学校 / Megaphone）: 画像URL、再生時間、出演者・スタッフが空欄
- EP-06620（報談 / Megaphone）: 同上
- EP-06625（ニュースの現場から / Omny）: 出演者・スタッフが空欄
- 外部ソース再取得・照合はまだ未実施（`externalSourceVerification=NOT_PERFORMED`）。
このDRY_RUNの「clean=7」は**このコードが検査対象とした項目に不足がない**という意味であり、概要清掃品質の合格判定ではない。

## 4. 補填ロボB1 本番1セル補填（12:02〜12:06 JST）
新規ファイル: `scripts/google-apps-script/Phase14B1EP06625SingleFill.gs`
コミット: `e484b0382f7908c7bdea47ef50b609bd127da3cf`

- 対象: EP-06625、行6626、GUID `aca6c2d2-6291-4bd5-801a-b4eb00651c0d`、X6626「出演者・スタッフ」
- 根拠: V6626「概要原文」内の公式RSS由来【出演・スタッフ】欄
- 抽出した記載:
  - 岡純太郎（大阪ネットワーク報道本部） https://t.asahi.com/wqyu
  - MC　岸上渉 https://bit.ly/3SL3x62
  - MC・音源編集　山根久美子（大阪ネットワーク報道本部） https://t.asahi.com/wqun
- 12:02 ユーザー実行ログ: `mode=B1_PREVIEW`, `action=READY_TO_FILL`, `writes=0`
- 12:03 ユーザー実行ログ: `mode=B1_SINGLE_WRITE`, `status=WRITTEN_VERIFIED`, `writes=1`（書込後読み戻し一致）
- 12:06 ユーザー再実行ログ: `status=SKIP_NONEMPTY`, `writes=0`（既存値上書き防止確認）
- これは**限定された1件・1セルの実機成功**。全件自動補填が完成した意味ではない。

## 5. 清掃済み概要W6626の修正（12時台 JST）
ユーザーのスプレッドシート画面で、V列「概要原文」にHTMLタグが残るのは原文保存として許容。一方、W列「概要清掃済み」に、番組内容より前のイベント宣伝・購読キャンペーン等が残っていたことを指摘。

Google Sheetsコネクタを使用して**正式台帳のW6626だけ**を直接更新し、再読み取りで更新結果を確認。V6626・X6626は変更していない。

**W6626の現行本文（検証済み）**:

> 大阪・関西万博の閉幕から1年。2500万人を超える一般来場者を集めたイベントは、私たちに何を残したのでしょうか。万博を「しょぼい結果になった」と振り返る作家の高村薫さんのインタビューを手がかりに、184日の会期中、84日万博に通って取材した岡純太郎記者と振り返ります。
>
> ※2026年10月21日に収録しました。

除去対象: 「PODCAST MEETING 2026」告知、デジタル版会員向け案内、スタンダードコース月額100円キャンペーン、購読申込リンク、加入勧誘文言。番組の主題説明と収録日を保持。

## 6. 決定済みの運用原則と未完了課題
1. **V列 = 原文の保全**。HTMLタグを含む原文を勝手に清掃しない。
2. **W列 = 番組紹介の清掃済み本文**。イベント告知・会員登録・購読キャンペーン・定型誘導などを除去。ただし記事本題や日時の意味ある記載を誤削除しない。
3. **X列 = 出演者・スタッフ抽出**。出典がある場合のみ書き込み、元のセルが非空なら触らない。
4. **補填ロボB2へ「清掃品質の再点検」機能を追加する**。今回は**構想と方針の記録のみ**。実装・全件再点検・スケジュール実行は未着手。
5. 清掃品質監査はW列が空欄かどうかとは別問題。「埋まっているが宣伝文言が残る」行も検出する。問題候補→根拠付きレビュー→限定改訂。いきなり既存W列を全上書きしない。
6. 収蔵ロボAの本番移行、EP-06627〜06631のCOPYから正式台帳への同期は未完了。COPYで独立採番したまま本番Aを同時稼働させない。
7. **記録対象範囲**: ユーザーの「頭から」はEP-00001からではなく、**2026-10-26のこのチャット冒頭・正式台帳を確認した場面から**の全操作を指す。
8. 続きは本GitHubログに時系列追記し、コード更新は個別コミット。成功ログと未実施事項を区別する。トリガーは安全性確認まで0件を維持。

## 残作業案
- 既存W列の宣伝残存を検出するREAD_ONLY品質監査を別ファイルで作成し、台帳の冒頭からEP-ID順に**進捗カーソル付きで**少数ずつ評価。EP-IDに沿ったバッチ進捗をGitHubへ記録。
- 誤検出・過剰削除のレビューを先に実施し、既存値保護のもと限定書き込み。
- MegaphoneのEP-06618・06620のRSS照合と欠損補填。
- 収蔵ロボAの本番対応、COPYの影運用移行とEP-ID一本化。
