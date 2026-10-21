# Public episode library

The existing site links to `library/`. This is a buildless HTML/ES module surface copied by the existing Pages build. It does not depend on Spotify's API, a new GAS deployment, a database or a service account.

## Snapshot publication

1. Download the current, authenticated library workbook without changing sharing settings. Keep it outside the repository. Snapshot the workbook before changes; this export does not write to Sheets.
2. `python scripts/read-library-workbook.py /private/library.xlsx /private/library-source.json` (requires openpyxl).
3. Optionally update `docs/audits/2026-10-21-phase8/audio-evidence.json` using bounded HTTP Range audio checks. URL presence alone is not proof of playback. The initial ten checks cover only audio headers, not complete listening.
4. `node scripts/export-library-public.mjs /private/library-source.json public/library/data docs/audits/2026-10-21-phase8/audio-evidence.json`
5. `node --test tests/library-public.test.mjs`, `npm run build:pages`, mobile acceptance CI, then publish through a dedicated PR. No raw workbook, private notes, tombstone reasons or credentials belong in the public snapshot.

The exporter validates headers and stable EP-IDs, rejects duplicate/invalid IDs, preserves original/clean description provenance, applies the existing V2 human-exclusion rule and tombstones, and stages output before replacement. Unknown exclusion flags fail closed. A source below 6,000 exportable records requires review instead of silently replacing the current snapshot. A validated new manifest/version invalidates client request caches; failures remain retryable. Revert the snapshot PR to recover. EP-ID must never be regenerated from list position.

## Loading and playback

- Initial request: manifest plus a 40-row summary page; no whole-library descriptions or audio preload.
- Programme browsing: one page at a time. Date/full-text search loads only the selected programme's full-text index, or all programme indexes on demand for global search (two concurrent requests).
- Details: a maximum 50-record ID bucket. Text is inserted with textContent, and only HTTPS external links are accepted. Audio controls only exist for specifically checked URLs; other rows use official/Spotify/Apple links.
- Current JSON footprint is about 25 MB on disk across summaries, indexes and details; it is not transferred at initial display. First global full-text search is the largest transfer (~9 MB uncompressed). Programme selection reduces that transfer. This is a known MVP limit, not server-side search.
- Safari-compatible native form, dialog and audio controls. CI emulates an iPhone viewport with Chromium and WebKit. This is not a physical iPhone validation.

## RSS automation boundary

Reuse the existing V3/Morning work in PR #230/#234; do not introduce another collector or another trigger. The current public library is a dated snapshot. RSS→ledger→Pages scheduled publication is **not connected**. A public snapshot export is separate from ledger ingest. A signed-in Apps Script session/API and the real `ALIB_AUTO_tick` source/status are still required before touching its running automation. No existing GAS properties, triggers, spreadsheet rows or Spotify playlists were changed by this MVP.
