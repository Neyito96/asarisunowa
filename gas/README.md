# gas/ — 本番「朝リスの輪」以外の GAS プロジェクトの正本（#363）

本番「朝リスの輪」の正本は `scripts/google-apps-script/`（本番と 107/107 一致。照合: `node scripts/gas-prod-compare.mjs <書き出しJSON>`）。
それ以外のプロジェクトは混ぜずにここへ置く。どれも自動デプロイは無い（エディタへ手で貼る）。

| フォルダ | GAS プロジェクト | 貼るもの | 作り方 |
|---|---|---|---|
| `summary-cleaner/` | 概要欄清掃ロボ（COPY / V2作業用）1C3kV3… | `dist/SummaryCleaner.js` | `node scripts/ledger-v2/build-cleaner-gas.mjs`（src と library の清掃・照合コードを束ねる） |
| `p25v2-copy/` | V2収蔵ボット COPY 1qVI_… | `dist/P25V2CopyIngest.js` | `node scripts/ledger-v2/build-copy-gas.mjs` |
| `shared/` | 上の2つが取り込む共有コード（単体では貼らない） | — | — |
| `honban-robot/` | 朝ポキ｜本番ロボGAS に置く追加ファイル（P26・手動実行専用） | `P26V2PlatformBridge.gs` | そのまま |
| `standalone/` | 読み取り専用の単体スクリプト（トリガー・書込なし） | 各ファイル | そのまま |

清掃ロボの変更履歴は Draft PR #343（feat/p28-patrol）にあり、その時点の内容をここへ取り込んだ（2026-11-18）。
