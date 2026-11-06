# Phase25 review follow-up — no production migration

## Fix and tests
`P25CopyAdapter.js` membership page limit changed from 100 to 50.
Official specification checked 2026-11-06:
https://developer.spotify.com/documentation/web-api/reference/get-playlists-items
(limit maximum 50; offset identifies the first returned item).

Added `tests/gas-phase25-copy-adapter.test.mjs`. These tests execute the actual
adapter, not a replacement readMembership implementation, with isolated in-memory
GAS spreadsheet/property/lock/HTTP fixtures:
- 51 items => offsets 0,50; 101 items => offsets 0,50,100. Every request asserts limit=50.
- Existing nine-column request -> ledger -> review -> approve -> 51 existing items
  plus exactly one new episode -> durable journal -> readback -> rerun POST zero.
- Second-page 429 fails closed (no partial membership returned).
- Changed snapshot fails closed; empty page with next cannot loop.
- Latest human-deleted request suppresses older active request.
`node --test tests/gas-*.test.mjs`: 35 passed, 0 failed.
This is an adapter-level MOCK integration test, not live COPY GAS/Spotify proof.

## Online trigger audit (authenticated UI, read-only)
Google login was restored through secure authentication. The actual Spotify-management
project trigger page showed **six** triggers owned by the signed-in account, all Head,
all time based, each listed once. Other users' triggers and other projects are outside
this inventory. No trigger was saved, created or deleted.

| Handler | Configuration / observed latest run on Nov 6 (JST) |
| --- | --- |
| runAutoUpdateBackfillHourlyV1 | Edit dialog: every 1 hour; latest 20:48:29 |
| runAutoUpdateAutomationV1 | Edit dialog: daily 04:00–05:00, GMT+09:00; latest 04:38:52 |
| syncKinoDougaPlaylist | latest 04:26:50; interval not opened |
| syncIsshoShinbunPlaylist | latest 04:39:56; interval not opened |
| syncToyohidePlaylist | latest 04:26:52; interval not opened |
| syncListenerPodcastPlatforms | latest 04:32:26; interval not opened |

All displayed error rates were 0%; this does not establish correctness of their writes.
Both inspected configuration dialogs were cancelled without changing fields.
The earlier report's inaccessible-GAS limitation is superseded **for trigger audit**.
Full online source comparison and COPY target/credentials are still outstanding.

## Routing design after this audit
Keep existing 04:00–05:00 / hourly schedules. The three standalone playlist writers
also need coverage: guarding only shared daily/hourly handlers is insufficient.
Before migrating a playlist, all routes (standalone three, fixed managed daily,
request incremental, hourly/daily bootstrap, theme V3/review, manual launch helpers)
must check a single authoritative playlistId -> LEGACY/P25/PAUSED owner record inside
the same production ScriptLock. Only the matching writer may POST. A separate COPY
ScriptLock cannot coordinate with production. Never enable COPY writes to real
production playlists. Set owner PAUSED and drain any running legacy job before switch.
No routing code was activated and no schedule was modified in this change.

## First canary review candidate — HOLD, not an authorized missing item
Live ledger search and existing request conditions identify the following concrete
review candidate for the existing 楽屋裏 series. Membership, playability and human
exclusions have NOT yet been checked, so do not call it a confirmed addition.

| Field | Value |
| --- | --- |
| Playlist ID | 1u1qT0BxRZT1OeNM0LDA72 |
| Request keyword/type | 楽屋裏 / series |
| EP-ID | EP-00028 |
| GUID (ledger G) | ae4285e6-67af-4aba-afbf-b4b8007f2f96 |
| Spotify episode ID (ledger L) | 0dfOcLSR0wxgSU7hDWok68 |
| Title | （楽屋裏）5速6千回転まで回したい！ クルマ好きの2人が向かった先は？ |
| Release / ledger row | 2026/09/29 04:00 / row 29 |
| Gate | HOLD: membership/access/playability/exclusion review outstanding |
| Authorized production additions now | 0 |

If already present, this candidate is a no-op and MUST NOT be removed merely to make
a test add possible. Select another confirmed missing candidate instead. No claim that
this is the newest matching episode or a completed production manifest.

## COPY live test and rollback
A live COPY run still needs: independent COPY project, request/state sheet IDs, an
explicit test-only playlist ID, and separately usable COPY Spotify authorization.
The production project authentication is not authorization to copy its secrets or to
reuse a real playlist as a test target. No COPY resources or live test POST were made.

Once these are available: dry-run COPY, inspect exact candidate evidence, approve one,
set maxAdditions=1, execute, read complete membership, execute again and require POST 0.
Do not require a production deployment for this test.

Rollback for the eventual approved canary:
1. Set migrated target PAUSED; stop new dispatch, leaving schedules unchanged.
2. Preserve state journal, exclusions, observed membership and pending write IDs.
3. Read Spotify membership before deciding whether an uncertain POST succeeded.
4. Revert only the reviewed routing/code revision; enable LEGACY only after pending
   writes are reconciled and exclusions are preserved. Never run both writers.
5. Do not remove the added item automatically. If removal is requested separately,
   verify exact canary episode + current membership and remove only that confirmed ID.
6. Roll back site state separately only if it was changed; none was changed here.

Production writes this turn: GAS code 0, sheets 0, Spotify 0, triggers 0, site 0.
