# Semantic classification bulk engine — 2026-10-23

Scope: 5,848 published EP-IDs. Work only on branch `work/semantic-classification-bulk-20261023`. No changes to main, source spreadsheet, GAS, Spotify, or published site.

## Operation
- Fetch read-only source snapshot of EP-ID, title, description and eligibility into local JSON; never infer eligibility from EP-ID ranges.
- Preserve all 109 user-approved decisions and every existing decision unless an explicit revision is approved.
- Classify title **and cleaned description** semantically. Strip common show descriptions/boilerplate; never decide from keywords alone.
- Classify in 500 eligible-ID windows, checkpoint every 100–200 IDs.
- Store `confirmed`, `provisional`, `held` separately. Missing description => provisional at most.
- Reject invalid IDs, duplicates, unsupported labels, missing evidence and accidental overwrites.
- Verify saved JSON by read-back and counts before advancing cursor.
- Use idempotent, append-only batch files and a manifest. Never treat a write request alone as success.

## Current verified baseline
- Existing 310 classifications (109 user-approved, 162 AI proposals, 34 title-only, 5 held).
- New batch-001: 33 summary-reviewed.
- New batch-002: 68 title-only provisional.
- Total records: 411; remaining 5,437 (includes review requirements).
- Next ID to inspect: EP-00601. IDs must be checked against eligibility sheet.

## Automation prerequisite
The runner needs a read-only, complete source snapshot and a configured LLM API credential to perform real semantic judgments. Without these, it must stop with a clear error, not silently switch to keyword-only classification. Do not enable unattended GitHub Actions until the inputs and review tests are verified.
