# 掲載対象のスマートフォン最終受入 — 2026-10-22

結果: PASS。本番公開は未実行・別途承認待ち。

- 検証コード: e88c3f77f0db27abb3877f2a9e32f080e1e000e3
- CI: https://github.com/Neyito96/asarisunowa/actions/runs/39772297498
- スクリーンショット6枚: https://github.com/Neyito96/asarisunowa/actions/runs/39772297498/artifacts/12422673646
- 宇宙の基準: V0.10.6 / ed61100853214c3d685242018ea3c507b58d0648。宇宙repoへの書込なし。差分と試験HTMLをPR250に保存。
- 実行時刻: 2026-10-22 20:40:45〜20:41:04 JST。
- Chromium / WebKit の iPhone 13 エミュレーション。実機iPhoneでの手動試験ではない。

図書館は一覧・検索index・詳細のID集合がscopeの5,848件と全件一致。元の5,848件のエピソードオブジェクトは完全保持。宇宙は同じscopeと共有moduleを読み込み、検索/話題抽出元のrowsとエピソードモードの星のEP-ID集合が共にscopeと完全一致することをブラウザー内で検証。試験専用の状態読取フックは配布HTMLに保存しない。

|検証|結果|
|---|---|
|掲載判定・writer・共有仕様|8/8 PASS|
|公開プレビューの既存回帰|25/25 PASS|
|従来ブラウザー受入|Chromium / WebKit PASS|
|掲載対象・宇宙のブラウザー受入|Chromium / WebKit PASS|
|両画面の表示|掲載対象5,848件・2026年10月22日掲載判定|
|学校|485件、EP-06591は非掲載|
|アンコールを含む通常回|EP-04305を検索・詳細表示できる|
|宇宙のエピソードの星|5,848個、重複0・欠損0・対象外混入0|
|公式リンク・音声導線|リンク表示、音声の遅延読込、embed/MP3の区別 PASS|
|初回表示|一覧ページ1取得、検索index0取得、詳細0取得、scope全ID追加取得0|
|スマートフォンの横はみ出し・JS例外|なし|

音声導線試験はaudio src設定と遅延読込の確認であり、外部音声の全編再生や全リンクのHTTP疎通を保証する試験ではない。

初回CIはaptミラーのダウンロードが遅延しタイムアウト。Playwrightの同版ブラウザー同梱コンテナへ変更。次のCIではpythonコマンド未提供でHTTPサーバーが起動せず失敗したため、python3と起動確認を使用した。最終CIは全工程成功。

## 実行ログ抜粋

```jsonl
2026-10-22T11:40:45.9358207Z {"engine":"chromium","viewport":"iPhone 13","initialPageRequests":1,"initialSearchRequests":0,"initialDetailRequests":0,"checks":"pagination, oldest boundary, programme, speaker/article-title search, details, official links, no audio preload, empty, XSS, mobile overflow, policy exclusions, editor local draft/reload/no-send","errors":[]}
2026-10-22T11:40:52.6262658Z {"engine":"webkit","viewport":"iPhone 13","initialPageRequests":1,"initialSearchRequests":0,"initialDetailRequests":0,"checks":"pagination, oldest boundary, programme, speaker/article-title search, details, official links, no audio preload, empty, XSS, mobile overflow, policy exclusions, editor local draft/reload/no-send","errors":[]}
2026-10-22T11:40:55.2649163Z {"browser":"chromium","library":5848,"universe":5848,"school":485,"heldExcludedFromSearch":true,"adoptedEncorePreserved":true,"errors":[]}
2026-10-22T11:41:04.6447919Z {"browser":"webkit","library":5848,"universe":5848,"school":485,"heldExcludedFromSearch":true,"adoptedEncorePreserved":true,"errors":[]}
```

本番への適用候補は掲載scopeに関する必要差分だけ。PR250全体には以前の監査成果も含まれるため、一括マージしない。図書館の共有module/codeとscope付き公開JSONを先に反映し、その後に宇宙の最小差分を適用する。直前の両repoのmainと公開ファイル一式を保全し、差分が変われば停止。復旧は今回の公開ファイルとUI差分のみを戻す。台帳/判定/EP-ID/GAS/Spotify/RSS/triggerには触れない。

