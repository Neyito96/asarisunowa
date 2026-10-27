# Phase15｜Lite最終テスト・READ_ONLY実機試験ゲート
2026-10-28 JST
対象: `lab/phase15-safe-ingest-engine-20261027` commit `65a4cc6eb0374fc802b64607f4f67e50607600fd`。
司令塔はLiteGas.gs、adapter.mock.test.js、LiteCore.jsをGitHubから直接静的確認。本番シートA=番組名/H=RSS URL、台帳G=GUID、7件(Omny5/Megaphone2)のREAD_ONLY照合は担当ロボ報告として受入。mock 6/6は担当報告、追加8件は未実行。司令塔の独立Node再実行も未完了。オンライン設置未承認。

## P0 まず実行して合否を報告（GitHub LABからcheckoutしたコード）
`node lab/phase15-safe-ingest/lite/adapter.mock.test.js`
`node lab/phase15-safe-ingest/lite/lite.test.js`
必要なら従来エンジンの16+7テストも回帰。失敗時は当該LABブランチ内で最小修正し再実行する。テストコマンド/exit code/全ケース件数/commitを保存。

## P0 8件PASS後に実機に持ち込む草案だけ作る
- LiteCore.jsとLiteGas.gsを、新規READ_ONLY専用GASプロジェクトに配置する手順を提案。既存の本番GASに追記しない方式を優先し、誤操作による既存収蔵コードとの混在を防ぐ。
- スクリプトは既存の本番台帳をREAD_ONLY参照し、7番組RSSをGETするだけ。実機での最初の手動1回実行までを別途ユーザーの明示承認で進める。トリガーは作らない。
- 実機結果: 7番組それぞれのfetched/existing/unregistered/duplicate/error、source completeness、実測実行時間、スクリーンショットまたはログ。未確認はSOURCE_PENDING。
- GASサービスの初回OAuth権限画面にスプレッドシートへの編集権限が表示される場合、実際のコードが非書込でも権限は読み取り専用に細分されない可能性がある。ユーザーに無条件に同意させない。スコープと公開情報を確認し、必要なら停止して報告。実機から台帳書込API/ScriptProperties/トリガーを使わない。
- GASでは .js 側を .gs ファイルとして貼り付ける場合のCommonJSとtop-level定義の互換性、およびXmlServiceのXML名前空間処理を実機前に点検。
- 本番EP-06632保護、COPY ID転用禁止。本番台帳/GAS/トリガー/main/公開への変更は未承認。
## 報告
8件 + 13件の実行結果、ログ証拠、実機一回限りのREAD_ONLY試験準備が完了したか。ユーザーのMacで必要になる具体的一操作の案内案。実行・設置は今回の指令には含まない。
