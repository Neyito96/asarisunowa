# 司令塔｜補填ロボ公式DRY_RUNコード監査（2026-10-26）

## 参照
- `scripts/google-apps-script/Phase14BackfillFiveOfficialDryRun.gs` (blob f4bc3cef618a7a27d82c887444e8a93b67c1bb1e)
- `docs/phase14/backfill-copy-official-dryrun-handoff-2026-10-26.md` (blob d22bb977a01b0ea911b3979fa96a874df920fcb9)
- 報告コミット：コード `4bcd7fcb5425`、文書 `4250e1c1c75e`（ユーザー報告）
- 今回はGitHub上のソースレビューのみ。COPY GASプロジェクトへの配置と実機実行は未確認。

## 判定
実装保存・試験準備は受入。**実機DRY_RUNはNOT_RUN、PASSではない。**
対象EP-06627〜06631。EP-06632は収蔵ロボ管轄。
現行コードには台帳セル書込・採番・トリガー変更・Properties書込を行う処理なし。
COPY GAS ID、COPY台帳ID、sheetId、55列ヘッダー確認を実装。GUID、履歴、状態を照合してRSS GUIDとタイトルを確認。OmnyのみJSON取得。候補はJ/N/O/P/V/AZ/BAの空欄のみで、W列既存値は変更対象外。

## 要注意
1. 数式・入力規則・リッチテキストのリンクは確認するが、シート／範囲のProtectionそのものは列挙しない。**全保護範囲検査済みとは言えない**。読み取り専用試験自体は可能。
2. RSS全文には対象過去回がない場合があり、GUIDが見つからなければ保留する。公式ソース不在と未収蔵は区別。
3. `writes:0`/`propertiesChanged:0`/`triggersChanged:0` はコード設計上の報告値であり、現行GASの実測確認はない。実行前後のトリガー・台帳差分など独立確認を別途行う。
4. `getRuns()` のリッチテキスト評価やV3 JSON読込で例外が生じうるため、実行時は対象別のエラー証拠を保存し、部分成功と区別。
5. EP-06630の関連記事3本とEP-06631のゲスト固有Xリンクは既存W列の更改提案に留める。EP-06630記事2の見出しは未確定であるため、公式原文から再抽出してから差分案を確定。ユーザー承認までは更新しない。

## 次指令
- COPY GASへ対象関数のみ追加して手動実行。既存トリガー・既存関数・ScriptPropertiesに触れない。
- 実行前後のCOPYトリガー件数・対象5行・採番履歴・V3状態の差分を可能な範囲で独立確認。
- 実機ログ `sourceChecks`/`plans`/`holds` を収集し、公式RSS/JSON HTTP可否、対象セル、保留理由、処理時間を明記。
- 完成の判定は実機ログと差分の再読後に司令塔が行う。
- 本番台帳/COPY既存値/Spotify/Pagesの更新、自動採番、本番トリガー設定は禁止。COPY朝の自動トリガーは維持。
