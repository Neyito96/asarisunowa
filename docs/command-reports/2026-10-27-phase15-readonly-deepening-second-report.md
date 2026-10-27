# Phase15 読取深化監査｜第2報（2026-10-27 JST）
**READ_ONLY / 0 spreadsheet writes / 0 COPY writes / 0 published updates**  
指令: `92aad440f6a35f10680a021d7e2e43d41e0cc74c`  
参照: 本番 `1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4`（エピソード台帳 A2:AP6633）、おんさ共同編集 `1CvRyWLQb7YyonGyRSNKtc_liRrgtiWE5yDGI3R48Xfk`（6番組 A:N）

## A 494件の再計数と根拠
本番6,632行を7区間で再読。VありW空欄494件を独立再計数し前回報告と一致。取得元で Omny RSS 24 / Megaphone RSS 470。配信年2023:7、2024:53、2025:248、2026:186。
番組別: ニュースの学校466、AJW14、報談4、ニュースの現場から3、MEDIA TALK3、スポンジ2、ドーナツ2（計494）。
※前回の「ニュースの学校W空欄467」はV空欄も含む数字であり、今回のVありW空欄は466。W空欄総数とは混同しない。
サンプル EP-00081/00082/00093 等はVに約400字の説明が存在しW空。多数のニュースの学校行にも同様の形を実見した。ただしGASの不具合・ソース仕様差・投入経路のどれが原因かは未確定。元Vから既存Wへの一括自動転記は許可されていない。
AJW14件は掲載対象外のため通常の補填対象へ算入禁止。

## B 品質監査・保留
150件の層化深度精査は**未完了**。V/W/X/ACの横断的な構造品質監査が必要であり、空欄再計数だけで「150件精査済み」にはしない。必須回帰対象:
- EP-06630 (行6631): V長2651文字、W長121文字、AC長162文字（関連記事3 URL）、X長73文字。WだけのURL不在を不良と断定できない。記事見出しとURLの組を表示できるか要検査。
- EP-06631 (行6632): V長3026、W長161、X長47。ゲスト固有XリンクをVから保持しているか、Xの「出演者」文字列だけでは分からない。要検査。
- EP-00001〜00003: VにHTML形式本文と関連記事、出演者リンクを含みW空。清掃対象。
cleaning_policy_version 候補: `phase15-clean-v1-proposal`。Vの原文を不変保全。Wに主題・固有名・収録文脈を保全し、関連する記事見出し+URLと出演者固有リンクがW/X/ACに適切に保存・検索・表示されることをセットで検査。広告・定型告知は抽出除外可能だが元VのURLは残す。既存非空Wはold/new/reason/source/before-after SHAを提案するのみ。

## C 6番組リンク原本・本番照合
共同編集6番組のURL記載行: ニュースの現場から2658、メディアトーク1760、ドーナツ72、スポンジ180、報談220、ニュースの学校495＝5385。Spotify記載5385、Pocket Casts記載5372。ドーナツ13件は「未記載」、404やリンク切れではない。
本番URL（I列）と共同編集A元URLの**文字列完全一致**を仮照合した結果: 本番全6,632行中5357行に元URL一致、1275行は不一致（SDGs等の参照外番組を含む）。本番の空欄に参照URL記載が存在するセルは L47 / AP61。これは**移行候補**であり、HTTP疎通・platform identity・日付/タイトル衝突検査を通した件数ではない。
番組別（matched / L空欄→原本値あり / AP空欄→原本値あり）:
- ニュースの現場から: 2650 / 12 / 12
- MEDIA TALK: 1757 / 10 / 10
- スポンジ: 178 / 7 / 8
- ニュースの学校: 481 / 4 / 4
- ドーナツ: 68 / 14 / 27
- 報談: 215 / 0 / 0
合計5357 / 47 / 61。注意: 一部参照URLは共同編集の別タブにも重複して現れる。全6番組横断でURL重複282（同URLキーへの上書きを回避し、先出の行のみを採用）。このため「文字列一致」だけを同一性の最終確定とせず、**番組一致・日時・タイトル・GUID/元URL**の交差検査が必須。特にSDGsの8件のURL偶然一致は採用禁止。数字をそのまま正式補填可能数としない。
共同編集 B日付は `Fri, 18 Aug 2023 19:00:00 +0000` のようなRFC日付。年月マトリクスを作るときはISO/JSTへ日時パースしてから集計し、文字列先頭の年月だけでは判定できない。
HTTPステータス（200/redirect/403/429/404/timeout）・実際の配信同一性: **未検証**。リンク切れ件数は不明。

## D J公式個別URL公開審査ゲート
EP-06600(行6601)、EP-06603(6604)、EP-06606(6607)、EP-06609(6610)、EP-06618(6619)、EP-06620(6621) は本番J空欄を再確認。RSS/GUIDと公式URLは別検査、架空のURLを組み立てない。蔵人には審査対象の根拠のみを共有し公開承認しない。

## E COPY真正DRY_RUNゲート
下記は**候補であり真正DRY_RUN完了ではない**。候補セル本番に式・validation・RichTextや値が見えないことを限定範囲でreadback済。COPY側の独立現値・保護状態・ROW identity、衝突・rollback、HTTP同一性が未検証のため、COPY真正DRY_RUNは保留、writes=0。
`candidate_manifest`に必要な列:
`ep_id,guid,target_spreadsheet_id,target_tab,row,col,old_value,old_hash,new_value,new_hash,source_tab,source_row,source_url,source_date,source_title,match_axes,http_status,identity_status,validation_state,formula_state,rich_text_state,protection_state,conflict_state,rollback_value,cleaning_policy_version,status,approved_at`。
候補原本:
- EP-00001 行2 L: 原本ニュースの現場から行2643 `https://open.spotify.com/episode/7CqHaZnKM5bGq6rhjuW1ka`
- EP-00001 行2 AP: 同行 `https://pca.st/episode/17496f9e-d20a-4b32-9c66-85954538a1d0`
- EP-00002 行3 L: 原本同タブ行2642 `https://open.spotify.com/episode/3immrjmmGQNSec9wRZSWJh`
- EP-00002 行3 AP: 同行 `https://pca.st/episode/ea2dab3e-1a98-4c05-beed-991b3211f769`
- EP-00003 行4 L: 原本同タブ行2641 `https://open.spotify.com/episode/0XioVSOiu3u5huvtK87Rek`
- EP-00003 行4 AP: 同行 `https://pca.st/episode/864bbea3-b1b8-4dfb-9d06-06b1ef4f071c`
- EP-00021 行22 L: 原本メディアトーク行1752 `https://open.spotify.com/episode/2x2GeEANEXZE3fTwSLJk4F`
- EP-00021 行22 AP: 同行 `https://pca.st/episode/d8cf1b30-4248-4b7f-9a29-7dc3b5b575ca`
- EP-00022 行23 L: 原本同タブ行1751 `https://open.spotify.com/episode/4NNogbrylJAT5UbEMqB1QA`
- EP-00022 行23 AP: 同行 `https://pca.st/episode/571e0f6b-f223-44ba-a828-cbf86902fdca`
- EP-00023 行24 L: 原本同タブ行1750 `https://open.spotify.com/episode/70i2OMVQhrNfQpote5kUxP`
- EP-00023 行24 AP: 同行 `https://pca.st/episode/13b2f27d-2a93-46b6-8ff8-44ddef553beb`
これら12セルはreadbackで本番現値の空欄を確認し、原本A↔本番Iの元ページURL一致を確認した**事前候補**。本番・COPYには書き込んでいない。10〜30セルのCOPY DRY_RUN gateを満たしたとは主張しない。

## F 蔵・宇宙向け非公開差分契約
`{ep_id,guid,source_revision,cleaning_version,old_hash,new_hash,change_reason,preserved_links,status,approved_at}` を必須にする。承認前はLABキューのみ、公開5848集合・人間承認109件を不変。W更新を再分類の正答確定に使用しない。

## 未完・次の作業
1. 150件の層化サンプルの全件深度品質判定と真の欠落数。
2. RFC日付を解析した6番組×配信年月の完全マトリクス。
3. 47+61候補をURL重複・番組・日時・タイトルで衝突判定し、HTTP/配信identityを別ログ化。
4. COPYRIGHT/保護/RichText/数式/validationとCOPY側現値を確認した10〜30セル真正DRY_RUN（writes0）。
5. 6件の公式個別URLの公式証拠照合。
**いずれの未完事項も実施済みとは表記しない。**
