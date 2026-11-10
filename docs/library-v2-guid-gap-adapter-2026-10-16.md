# V2 GUID gap adapter implementation — 2026-10-16

Commit: 42f3256. Added `scripts/google-apps-script/LibraryV2GuidGapAdapter.js`.

## Confirmed source state
- Google Sheets metadata: ledger grid 6,592 rows including header; history tab A:J exists.
- Existing V2 writer: parallel RSS fetch, GUID-only matching, 10/80 batch limit, script lock, append-only history.
- 2026-10-16 recorded preview: 4,010 strict title/show/JST-date candidates; no GUID writes.

## New read-only adapter
`previewLibraryV2GuidGapBatch()` fetches RSS in parallel, indexes GUID-empty ledger rows, checks one-to-one title/show/date and unique GUID, consults human deletion history, and checks Spotify episode ID uniqueness. It deliberately leaves all matches at `SPOTIFY_IDENTITY_UNVERIFIED`; zero write eligibility and zero writes. No Spotify API calls or triggers.

## Limitations and next work
- The adapter has not yet been deployed to GAS or run against live RSS; the 4,010 figure is the prior preview, not a new adapter result.
- No Spotify-to-Omny episode identity bridge is established. A Spotify URL's presence or uniqueness is not proof of RSS GUID identity.
- Integrate verified identity evidence into the existing V2 writer only after real-world audit and a defined provenance contract. Recheck EP-ID, GUID, human exclusions, and all target blanks immediately before any write. Append to existing history A:J and verify post-write.
- Do not enable a writer or alter triggers without explicit approval. Existing V1/V2 scheduler conflicts remain a deployment gate.
- Important: duplicate GUID across feeds can represent legitimate feed overlap, but conflicting title/show/date is held.
- Existing V2 writer still has potential partial writes on interruption; verify results before retries.
