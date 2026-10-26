# 朝ポキ｜新着収蔵ロボの共通フォーマッター（2026-10-26）

## 本日実機で確認した教訓
- EP-06625で V6626 の公式RSS原文から、番組本題を抽出してW6626を清掃。12:43のDRY_RUN: beforeLength=446, afterLength=156, writes=0。ユーザーが本番GAS `phase14VWApplyEP06625Once` の `CLEANED_VERIFIED,writes=1` 成功を報告。
- 同EPでX6626の出演者・スタッフの3名（岡純太郎、岸上渉、山根久美子）をAT〜AVに分割、AY6626にRSS原文照合の根拠を記録。Sheetsコネクタ経由で書込みと再読確認済み。
- 従来のWはイベント告知・購読勧誘が混入、X〜AXでは出演者以外のURL/告知や人物情報が混在。この失敗を新着時点で防止する。
- VのHTML原文を維持。WとXとAT〜AYは確信ある抽出だけ記入。曖昧な回は要確認として保全し、でっちあげや宣伝混入をしない。

## 共通コード
`scripts/google-apps-script/Phase14NewEpisodeFormatter.gs`

`P14NewEpisodeFormatter.format(rawRSSDescription)` は書き込みなしの純粋関数。返り値 `fields` は V, W, X, AT, AU, AV, AW, AX, AY。statusとreadyForAutoWriteを使って呼び出し元が安全判定する。空白は **未取得または未確定の意味**。既存セル消去に使ってはいけない。

`phase14NewEpisodeFormatterDryRunEP06625()` はEP-06625に対するREAD_ONLY回帰テスト。公式RSS原文から清掃済み概要と3名を抽出することを確認。現時点で実機未実行。

## 新着RSS取込との結合（次工程）
RSSから GUID/タイトル/配信日時/概要原文/画像/音声等を得た直後に `format(rawDescription)` を呼び、**同じEP-ID/GUIDの登録行**に各値をセットする。登録直前の二重GUIDチェック、一意EP-ID採番、採番履歴/V3状態との整合性確認、単一スクリプトロック、書込み後の再読検証を既存エンジン側で維持する。行・採番履歴・V3状態は複数シートのため完全な単一トランザクションではない。途中失敗の修復/再開設計が必要。

**注意**: 既存 `LibraryOfficialRssEngine.gs` はCOPY専用のV19関数や本番書き込みブロックを含む。無造作に本番GASへ貼る/IDをCOPYから本番へ置換するのは禁止。まだ本番収蔵は有効化していない。COPYの新着EP-IDが本番と競合しない切替を先に行う。

## 清掃の限界
この版は明示的な「【番組内容】」「【出演・スタッフ】」セクションがあるRSS文に対し保守的に動く。記述形式が異なる番組は `NEEDS_REVIEW` とし、原文は保存しつつ清掃済みの本文を推測しない。イベント自体が番組主題の場合も誤削除しない。告知語の単純な削除はしない。カバー率は今後新着サンプルで検証する。
