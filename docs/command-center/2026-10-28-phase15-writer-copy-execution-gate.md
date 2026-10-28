# Phase15｜Writer条件付き受入・COPY実書込ゲート
2026-10-28。補填ロボ報告 commit 709d06db971f66f55d2616793cea5a499b7fcc75。司令塔がlive10-writer.js / testを取得し静的検査。
受入：prepare/ingestの基本安全設計、ローカル12PASS報告（GitHub版CLI未実施）。未完：実Sheets backend・COPY実書込・異常終了回復・10件の最終同一性/掲載基準。
## 今すぐ行う作業
1. 既存のCOPY台帳とその接続方法を特定し、本番と明確に分離。COPYの範囲・権限・採番履歴・保護設定を確認。COPYでのみ追記可能なGoogle Sheets backendをLABで準備。
2. 公式URLが確認される8候補だけを実RSS原文から固定し、全本番台帳（GUID、URL、タイトル＋番組）、固定ID採番履歴、除外・保留をREAD_ONLY照合し、収蔵可/保留を各件に明記。学校2件はURL空欄につき保留しつつ公式情報を調査。
3. COPYに模擬2件程度の限定書込みで、ロック・予約・追記・照合・二重実行拒否・途中失敗からの照合停止を確認し、元データの復元手順を提示。COPYの他開発領域に干渉しない。COPY試験すら権限/対象未確定ならSTOP。
4. 複数段階書込はアトミックrollbackではない。ロックが全writerで共有されないなら、本番GO不可。途中失敗時は自動再試行せず照合復旧。
5. 本番用実行前PREVIEW（候補GUID・番組・タイトル・日付・予定行A:BC/EP-ID・衝突・ポリシー判定・書込前後の検証方法）を提出。仮EP-IDは採番権限の根拠が確認できるまで確定しない。
6. GitHubにコード・実試験ログ・判定票・コミットを報告。今回の指令では本番台帳/GAS/Triggers/Properties/Pagesへ一切書かない。
## 判定
LAB_WRITER_CONDITIONAL_ACCEPTED / COPY_INTEGRATION_PENDING / LIVE_WRITE_NO_GO。
