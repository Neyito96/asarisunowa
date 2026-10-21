# Phase 11 — existing V3 Morning correction

2026-10-21. Reuses PR #230; no new ingestion engine, scheduler, Properties, deployment or production Spotify/Sheets writes.

Library candidate matching now prefers column W clean description over V raw notices (cast stays included). A POST success must include snapshot_id and observed membership in a bounded readback of the previous last page plus at most one following page. The existing durable reservation remains a HOLD until verified. Missing/failed/malformed readback is held; replay never issues a second POST. 401/403/429/5xx remain distinguishable in rejection results. Existing cutover, GUID, EP-ID, baseline, deletion guards, leases and trigger ownership remain unchanged.

Validation: morning suite 47/47; V3 regression suites 123/123. Added missing-membership, page-boundary readback, clean-text and 401 coverage. These are mocked tests; live Spotify token and trigger configuration remain unverified and no online GAS deployment was performed.
