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

## 20:57 JST 追加診断（ユーザー提供のGAS実行ログ）
- `previewLibraryV3AudioUnmatched288`: `READ_ONLY_COMPLETE`, 25,557ms。
- `unmatchedTotal=288`、`hasSomeUrlInLedger=288`、`embeddedUuidCandidate=288`。
- RSSステージング8.3時間経過、2,650件。
- URLホスト出現数: `www.asahi.com=1031`、`omny.fm=323`、`open.spotify.com=290`、`pca.st=288`。ホスト数はエピソード数でなくURL出現回数。
- 列の報告 `I,J,L,V,W,j,X,o,p` のうち、`j,o,p` は旧診断コードの26列超の列名変換バグによる誤表記。補正が必要。
- `writes=0`、`sourceWrites=0`、`propertyWrites=0`、`triggerChanges=0`、`networkProbes=0`、`spotifyPosts=0`。
- UUIDは番組IDなどの可能性があり、個別エピソードの音声と一致したとはまだ判定しない。

## 21:01 JST 再実行
- `READ_ONLY_COMPLETE`、41,988ms。`unmatchedTotal=288`、`hasSomeUrlInLedger=288`、`embeddedUuidCandidate=288`、全書き込み・トリガー変更・ネットワーク検証ゼロ。
- 列名に `j/o/p` が引き続き出現。修正コミット `240ac99` が隔離GASにまだ反映されていない可能性。旧式の文字コード変換による表示を正すと `j→AJ`、`o→AO`、`p→AP`。
- 20:57と主要件数は一致。これは同じロジックの再実行であり、新たなRSS照合成功や音声確認を示さない。

## 21:08 JST 修正版再実行
- `READ_ONLY_COMPLETE`、28,520ms。未照合288、URLあり288、UUID候補あり288、RSS 2,650件、ステージング8.4時間。
- 列名の修正反映を確認: `AP=288`、`AU=3`、`AV=3`（ほか I/J/L 各288、V/W各158、X=3）。
- `omny.fm=323` はURLの出現回数であり、288件の個別エピソードに対する一致数ではない。
- 書き込み、トリガー変更、ネットワーク照合、Spotify投稿はすべて0。
