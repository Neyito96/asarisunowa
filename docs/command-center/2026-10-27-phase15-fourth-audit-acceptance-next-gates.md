# 司令塔受入｜Phase 15 第4次READ_ONLY監査・次の実行ゲート
2026-10-27 JST。**受入は監査とGitHub保存の範囲。本番・COPY実書込は未承認。**

## GitHub検証
- 第4次報告：`audit/phase15-fourth-gates-20261027/docs/command-reports/2026-10-27-phase15-fourth-gates-readonly-report.md`、提出コミット `08cb00da1c0d133cc6e8e44d8f61a309cf8cb63d`、GitHub blob `c04b5e469145c0f1b2d07f047305aa236edaa50b`。
- 追加ハッシュmanifest：`audit/phase15-fourth-gates-20261027/docs/command-reports/2026-10-27-phase15-cleaning10-sha256-manifest.json`、提出コミット `122fe6d3c2375eec0d5128055cf24f82f144c3b7`、blob `298d425aea9efb441071a6f1a3a4d678572bec33`。
- 司令塔がGitHub両本文を直接取得。報告書の「SHA未完」は後続manifest以前の状態。manifestは10件のスナップショットrawとcleaned候補にSHA256を記録。**最新本番Vとのハッシュ比較、最新COPY保護ACL、外部HTTP同一性は未検証**。GitHubスナップショットのhashをライブ本番確認の証拠にしない。

## 決裁
- V→Wの11レコードはEP-ID一意化で10件。重複`EP-00411`はraw/cleanedが一致し衝突なしと監査者報告。
- 8件にliteralバックスラッシュ-n、実改行なしの品質問題をmanifestが記録。残り2件も最終品質・意味保持PASSとしない。**清掃10件の実書込適格0件**。
- 10件には`EP-00160/EP-00161`という公開対象外AJW2件を含む。これは清掃器の異種入力テストには使えても、通常の蔵公開補填キューには混入禁止。公開対象向けは最大8件の候補に限定し、現在はすべてHOLD。
- リンク6EP×L/AP=12セルは元URL/GUID/EP-ID照合とUTC→JSTの**分単位一致**に進展。EP-00003の28秒差は許容精度と原本値を明示、EP-00023の題名`#7`差を監査に残す。COPY保護範囲/編集ACL未確認、Spotify/PocketCastsリンク先エピソード同一性未確認、共同編集内URL重複全探索未完なので**12セル全HOLD**。
- 本番/COPY/GAS/トリガー/main/Pages/公開JSON/Spotifyへの書込0。人間承認109、公開5848固定。

## P0-A：清掃10件の可読・意味品質ゲートを仕上げる
1. 入力の階層を区別：JSON escapeされた`\\n`（デコード後の文字列）と文字列内の文字通りの`\\n`、実LFを混同しない。変換を一度だけ実施する再現可能なnormalize関数を定義。既に正しく正規化済みの文字を壊さない。未知エスケープや意図的な表記は保護。
2. 本番V最新値とEP-ID/GUIDをREAD_ONLY再読し、UTF-8生値をhash。GitHubスナップショットのraw SHA256と不一致なら`STOP_STALE_SOURCE`で候補を再生成して再検査。既存Wが空欄であることも確認。
3. 清掃結果の文字列には実際の改行または保存仕様に応じた単一スペースを使い、literal`\\n`を残さない。HTML entityデコード後の不正空白を除去。**記事見出し＋対応URL、出演者・ゲスト固有リンク、収録情報、内容の中心文脈を保護**。販促定型の削除が意図したものか前後差分で示す。
4. 出典URLの曖昧な正規表現で`&nbsp;`や後続文をURLへ吸い込まない。オリジナルのURL抽出と清掃後のURL対応、別列X/ACの有無をチェック。本文に関連記事URLを重複保持すべきかは蔵の詳細表示仕様で判定。
5. 入出力同一性（idempotency）・再生成SHA256・全10件の`pass/hold`を記録。10件一括が難しければまずニュースの学校3件のみ真正DRY_RUNで完全PASSを証明する。AJWは非公開試験専用。
6. 150件の構造検査について意味的検査は別ゲート。60 W空欄/5要精査/85構造欠落未検出をそのまま品質合格数や全台帳の率に換算しない。

## P0-B：リンク12セルの独立ゲート
1. 6EPの番組/元URL/タイトル/日時(GUID存在時)/共同編集A-B-Cと本番I-D-Cの全軸を日付JST統一で照合し、変種/重複の全行を列挙。EP-00003秒単位差、EP-00023番号差を根拠付き扱い。
2. Spotify・Pocket CastsリンクのHTTP/リダイレクト先の個別エピソードを確認。200だけではidentity PASSにしない。403/429/リージョン制限は未確認として再試行方針を示す。
3. COPYのprotectedRanges、保護の編集可能者・範囲、セルの最新値、数式/入力規則/RichText、GUID/V3との一致を**権限がある方法で読み取り**。ACL取得不能なら`STOP_ACL_UNKNOWN`を維持。現状のHOLDを解除したことにしない。
4. まず**真正DRY_RUN writes=0**を完全なmanifest・実行ログで報告。すべてPASSしたセルに限り司令塔へ**新たなCOPY実書込承認申請**を提出。今回は承認していない。

## 役割と公開の停止線
- 清掃V/Wの承認済み差分は`EP-ID,GUID,source_raw_sha256,cleaned_sha256,policy_version,changed_links,status`で蔵人に渡し非公開の検索/詳細表示を試験。宇宙はLABの意味分類再審査キューへ取り込み、承認109件を自動上書きしない。
- 新着掲載・宇宙公開は蔵人の正式掲載ゲートから司令塔・ユーザー承認を必要とする。
- おんさ資料、GAS、既存トリガー、本番/COPY実セル、元V/W、main、Pages、Spotify、公開5848のEP-ID集合はいずれも変更禁止。

## 次回報告
清掃候補10件の最新V hash/再清掃SHAと本文保全PASS数、COPY12セルのACL・外部identity判定、150件の意味的品質の進捗を、repo/branch/path/commitとともに報告。
