# 2026-10-19 READ_ONLY audit findings

Actual GAS run: 10:58:17 to 10:58:32. Ledger rows 6591, 51 columns. Audio URLs present 1226, missing 5365; HTTP verification evidence current 0, stale 0. Duplicate recorded GUIDs 0. Writes 0, API calls 0.

Priority missing audio URLs: ニュースの現場から 2514 of 2641; MEDIA TALK 1647 of 1750; こどもそうだんしつ 1103 of 1123. Together 5264 of 5365 missing URLs. Other shows: ニュースの学校 1, 報談 2, スポンジ 0, ドーナツ 0, アルキキ 81, AJW 2, 朝ポキTV 15.

News old years 2020-2021: 561 rows; 474 different raw/clean requiring review, 43 mechanically equal, 44 raw missing. News total raw description missing 243. ニュースの学校 clean description missing 467 of 486 and cast missing 486 of 486.

Interpretation: missing URL does NOT imply missing audio. Existing previewLibraryV3RssCandidates is READ ONLY, 50 feed items per run and one show per invocation. Do not ask user to repeat dozens of runs. Design resumable bounded bulk audit, preserving source snapshot identity, GUID uniqueness, formula protection and no production writes. Distinguish URL recorded, URL retrievable, audio actually playable. Omny API fast path and Megaphone RSS tested Oct 18, but integration and copy-pilot remain untested.

Next step: inspect configured feeds and current RSS candidate matching; build READ ONLY batched bulk audit on branch, with explicit test before any GAS execution. No main merge, production sheet, properties, trigger, Spotify writes.
