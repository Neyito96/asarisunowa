# 朝リスの田｜ニュースの現場から 音声URL空欄調査（2026-10-19 20:50 JST）

## 実測根拠
隔離GASの `previewLibraryV3AudioGaps` 実行ログ。実行 20:50:05–20:50:33、処理時間 26,627 ms、status=`READ_ONLY_COMPLETE`。
隔離コピーID: `19Dv6cgM33NYbrMGLofuVvxM4-WHiuPqxmivZUuwoBqc`。

| 指標 | 件数 |
|---|---:|
| 対象行 `showRows` | 2,641 |
| コピーO列URLあり `copyAudioPresent` | 464 |
| コピーO列空欄 `copyAudioBlank` | 2,177 |
| 一意のRSS候補なし `noUniqueRssMatch` | 288 |
| RSS一意候補にHTTPS音声あり・O列空欄 `rssHasAudioButStillBlank` | 1,889 |
| I列Omny URL候補 `omnyPageCandidate` | 0 |
| I列Omny URL判定なし `noOmnyPageCandidate` | 2,177 |

RSSスナップショット利用可、作成から8.1時間経過。 `networkProbes=0`、`writes=0`、`sourceWrites=0`、`propertyWrites=0`、`triggerChanges=0`、`spotifyPosts=0`。

## 解釈・留保
- 1,889件はRSSに音声URL候補があるが、既存の自動保存が適用するメタデータ・除外・数式・状態・コピー差分の全条件を通過したと確認したわけではない。
- 288件は一意のGUID/アンカー照合に失敗した行。音源不在の証明ではない。
- I列Omny URL候補0件は調査コードの列・URL形式判定に依存する。別列に存在する可能性を排除できない。
- 数値は20:50時点のスナップショット。バックフィルの自動運転で変化する。
- GASログは自動的にGitHubへ転記されない。このファイルはユーザー提示の実測ログに基づく手動監査記録。

## 次の検証
1. 未照合288件を、台帳行の列別リンク所在・GUID候補・RSS側の曖昧照合件数で分類する。
2. 追加取得は読み取り専用。URLやタイトルのみから音源同一性を断定しない。
3. 既存の自動保存と同じコピーに並列書き込みしない。
