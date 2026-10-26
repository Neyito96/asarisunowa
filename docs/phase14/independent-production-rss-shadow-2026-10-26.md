# 2026-10-26｜本番ロボ公式RSS独立巡回（シャドー）

コード: scripts/google-apps-script/Phase14ProductionRssShadowReadOnly.gs

目的：COPYに収蔵されるのを待つのではなく、本番GASから公式RSS 7系統（取得元一覧A2:H8）へ独立アクセスし、正式台帳のG列全行とGUID照合。未登録候補にV4概要・出演者整形を適用する。古いRSS項目も候補に含むため、正式な新着登録判定では発行日・既存タイトル/音声URL・別名GUID・除外履歴も必要。

手動関数 phase14ProductionRssShadowReadOnly、実機未試験。COPYトリガーの変更なし。本番台帳への書込なし。URLを厳格な公式フィード系ドメインに限定し、1フィード取得失敗でも他は報告する。

この実装は、前段「RSS取得→GUID照合→V4清掃」の初期統合であり、「EP-ID採番→正式登録」は意図的に未接続。既存COPYの採番・履歴・状態整合の設計を再利用し、一意書込機構を構築した後のみ有効化する。