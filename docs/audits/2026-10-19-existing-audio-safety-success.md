# 2026-10-19 11:25 V3 Existing Audio Safety 実測結果

隔離GAS `previewLibraryV3ExistingAudioSafety()`、11:25:59開始、11:27:43終了、`elapsedMs=101274`、`status=READ_ONLY`。前回11:16実行は約6分でタイムアウト。数式列を1回で `getFormulas()` 一括取得するよう修正した後、完走した。

- 公式Omny RSS項目: 2650
- identityMatched: 2353
- **uniqueCandidateEpisodes: 2162**
- duplicateEpisodeCandidates: 0
- formulaProtected: 0
- existingAudio: 125
- missingSourceAudio: 0
- identityAmbiguous: 268
- identityMissing: 29
- metadataHold: 66（全件 `title_mismatch`）
- excludedHold: 0
- sourceGuidDuplicate: 0
- writes/propertyWrites/triggerChanges/spotifyPosts: 0
- playbackVerified: false
- sourceSnapshotHash: `apMMoBYIZVzGTPDrMqK2B2gvLHdIZ87PCThpgGOTh1k=`
- formulaReadMode: `BULK_ONCE`

2650 = 2162 + 125 + 268 + 29 + 66。2162候補はEP-ID一意性・数式セル保護・既存値の空欄などの現時点の検査を通過。**保存は未実行**。保存前に台帳/元RSSの変化、GUID、行ハッシュ、セル空欄、数式、保留状態を再検証し、まず隔離コピーの1件のみで再実行0件を確認すること。

保留268件の原因詳細は未分類。29件の未一致には最新エピソードらしい項目もあり、新着収蔵パイプラインで別途扱う。66件のタイトル不一致は自動上書きしない。

今後は同じ全件RSS取得を反復せず、既存の公式Omny API差分取得とスナップショット/進捗保存の設計を検証する。自動化、本番反映、Spotify POSTは明示承認まで禁止。
