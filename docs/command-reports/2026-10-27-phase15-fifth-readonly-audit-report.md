# Phase15 第5次 READ_ONLY 監査報告（2026-10-27 JST）
**指令:** `592e8a405f1129fa81063d422dd3c129fd919a50`
**本番/COPY/GAS/Pages/Spotify書込:** 0。GitHub監査ブランチへの保存のみ。

## P0 ニュースの学校3件 V→W 再現可能DRY_RUN
JSON機械可読manifest: `docs/command-reports/2026-10-27-phase15-school3-cleaning-dryrun.json`。
- EP-00081 (row82)、EP-00082 (row83)、EP-00093 (row94)：本番エピソード台帳をLIVE READ_ONLYで再取得。
- EP-ID/GUID一致、保存snapshotに対する最新VのUTF-8 SHA256一致 **3/3**、W空欄 **3/3**。
- Vのliteral backslash-nを一度だけLFへ変換し、HTML `&nbsp;`/改行を処理。定型の「ご意見・感想・リクエスト」「ほかにも多彩な番組を配信中」「Learn more about your ad choices」以降を案内欄として除外。
- URLに続く `&nbsp;` をURLへ取り込まず、記事URLを単独行へ切り分け、直前に記事見出しを保持。関連記事本文URL 1件ずつ、AC保存URLと一致 **3/3**。
- 清掃関数を出力へ再適用して不変（idempotent） **3/3**。literal `\\n` 残存 **0/3**。
- 生のV SHA/cleaned候補 SHAを実算しJSONに保存。V/W・COPYの実セルを変更していない。
- **結果：3件とも CONTENT_DRY_RUN_PASS、COPY実書込適格は未確定**。旧表記と意味を要約せず本編説明を維持。実行前にCOPY側V・W・保護ACL再読が必要。

## 清掃器の注意点
今回の最小検証は3つの既知Megaphone形状の専用preview。未知の広告表現、HTMLタグ、出演者リンクがある他7件・466件全体へ適用する前に、多様な原文への回帰検査が必要。AJW2件は掲載対象外であり公開補填へ混入禁止。150件の意味的品質監査は未完であり、構造検査150件を意味監査完了と誤認しない。

## リンク12セル
共同編集の原本A URL・B UTC日付・Cタイトルと本番I/D/C、COPY EP-ID/GUIDは過去監査で再照合。6エピソードで分精度日時一致、EP-00003は秒数28秒を切り捨てた分単位、EP-00023は題名の「#7」表記差としてHOLD注記。
今回Spotify/Pocket Castsリンクの直接ページ取得を試みたが、Spotify側は取得失敗、Pocket Casts短縮URIはアクセス不可で、**HTTPステータス・リダイレクトの実証、リンク先episode title/GUID等のidentity証拠が採取できていない**。ウェブ検索でも該当IDの補強証拠が取れていない。404・リンク切れとは断定しない。
COPYのメタデータ読み取り手段はシートpropertiesのみで `protectedRanges` や編集可能者ACLを返さない。権限のある保護範囲APIによる独立検証未実施。このため `STOP_ACL_UNKNOWN` 継続。
12セル全部 `HOLD_EXTERNAL_IDENTITY_AND_ACL`。真正書込PASS=0/12、writes=0。

## 次ゲート
1. 3件清掃器をCOPYの同じEP-ID/GUID/Vhash・保護/validation/RichText付きで真正READ_ONLYゲートへ。
2. 追加7件は同じpolicyを検証し、AJW2件を非公開試験に限定。記事見出し+URLと登場人物リンクの喪失があればSTOP。
3. Spotify/Pocket Castsを認証なしでも検証可能なメタデータAPI/公表episodeページで同一性照合。403/429は再試行であって削除判定ではない。
4. Sheetsの `protectedRanges` および `editors` を返す権限のある読み取り方法を確保し、COPYセルのlatest readbackを再実行。
5. 150件意味品質審査は別監査で実施。公開5848件、人間承認109件は維持。

**この監査では本番・COPY書込を承認申請しない。**
