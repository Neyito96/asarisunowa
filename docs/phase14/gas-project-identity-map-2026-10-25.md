# 朝ポキ｜GAS・台帳 対応早見表（2026-10-25）

**原則: 正式台帳のみがEP-IDの正本。COPYは控えであり、本番の自動採番と独立して同じEP-IDを発行してはいけない。**

| 呼称 | 既知の識別子・リンク | 役割 | 状態 |
| --- | --- | --- | --- |
| 正式台帳 | https://docs.google.com/spreadsheets/d/1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4/edit | 正本。EP-06626まで6,626件、V3・採番履歴34件移行済み | 本番GAS自動収蔵は未配備 |
| COPY台帳 | https://docs.google.com/spreadsheets/d/1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY/edit | 検証・控え | V19が書込先に利用中の可能性 |
| COPY GAS | https://script.google.com/home/projects/1roni6h_C9vKxtP_2I6jGgXKE2KJ1yRRhE3ZD1JsZ6XXRnT5RcndqyfJo/edit | 旧V19収蔵、COPY限定 | 時間トリガー実機の最新状態は未確認 |
| 本番GAS | **未作成／ID未確認** | 正式台帳専用の新着・補填エンジン | GitHubで監査入口のみ実装済み、配備・実行なし |
| 10/25移行前バックアップ | https://docs.google.com/spreadsheets/d/12VSV0uqEhXtjTYzFlxTYyabr71fzIGVnQpi77Obvsvs/edit | 事故時復旧 | 読み取り専用の保存物として扱う |

## GitHubのコード
- `scripts/google-apps-script/LibraryOfficialRssEngine.gs`: COPY V19を含む既存エンジン。COPY固定ID・GASプロジェクトID依存箇所がある。丸ごと本番配備しない。
- `scripts/google-apps-script/Phase14ProductionPreflight.gs`: 本番向けのREAD_ONLY台帳・採番・V3・トリガー確認。GAS未配備。
- `scripts/google-apps-script/Phase14CopyShadowAudit.gs`: 本番・COPYのGUID/EP-ID差分をREAD_ONLY照合するコード。GAS未配備。

## 安全な運用開始
1. 現状は「正式台帳＝正本／COPY GAS＝従来の実験収蔵」。本番GASを自動稼働中と誤認しない。
2. 本番専用GASを新規作成し、Script ID、スクリプトプロパティと全既存トリガーを監査。
3. 両台帳の差分を `phase14ShadowCompareReadOnly` で確認。本番とCOPYのIDが分岐したら、自動同期ではなく保留しGUIDで調停。
4. 正式台帳の採番・V3ハッシュ・排他ロックを確認してから本番の1件限定試験を実施。
5. 本番稼働が確認されるまではCOPY V19の既存トリガーを一方的に停止しない。両者並行運用へ移る場合もCOPYの独自採番は停止しREAD_ONLYシャドー比較に移行する。
6. 本番・COPYが別GASの場合、`LockService.getScriptLock()` はプロジェクトを跨いで共有されない。同じSheetを触れないことを接続先IDと明示ガードで保証する。

公開JSON/蔵/宇宙/Spotifyは今回一切変更しない。
