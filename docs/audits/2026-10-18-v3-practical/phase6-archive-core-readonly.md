# Phase 6 — 原文版管理・関連記事の構造化（READ_ONLY第一段階）

Date: 2026-10-18. Source base: commit 71114be and Issue #222.

## Implemented in this commit

`scripts/library-v3-archive-core.mjs` is an **independent pure JavaScript proposal builder**. It is not imported into `LibraryV3.js`, not a GAS writer, not a completed storage pipeline. It has **no Sheets, Properties, triggers, network or file write calls**.

- `planArchive` requires an externally confirmed one-to-one EP-ID/GUID identity, source URL and externally supplied RSS sourceHash. Exclusions and identity conflicts remain on HOLD. Its immutable proposal holds the **unmodified original description**, original source, snapshot time if provided, and key `EP-ID|GUID|sourceHash`.
- A different existing V-cell value becomes `ALTERNATE_VERSION` proposal, **not** a replacement of V or W; matching content can be represented as a snapshot proposal. Repeated saved keys are ignored. This is only proposal-level idempotence, not a database transaction guarantee.
- `parseRelatedLinks` enumerates explicit Markdown links, HTML anchors and plain URLs. Title is populated **only if an explicit link label exists**; URLs without labels are unverified. All links have `LINK_REVIEW` status; **this does not claim all URLs are news articles**. Preserve event, source, and reference URLs until classified by stronger evidence.

## Storage schema for a future independently approved pilot

Propose `RAW_VERSIONS`: `versionKey, EP-ID, GUID, show, rssUrl, sourceHash, originalRaw, fetchedAt, preservedAt, relation, parserVersion, auditStatus`. This is append-only; never overwrite prior raw versions or existing V cells. A separate `RELATED_LINKS` collection can have `versionKey, EP-ID, position, URL, explicitTitle, linkType, confidence, evidenceSpan, checkedAt`. Ensure original order and duplicate-safe keys; `linkType` remains unknown until verified. Do not infer missing article titles.

The full pipeline should be:
RSS description/encoded → immutable version proposal → safe clean W proposal using the **same version** → explicit cast/staff evidence and links → protected copy-write review → separately approved scheduled collector.

## Important gaps and safety

- No real sheet tab was created; no originals or copy ledgers changed.
- This implementation has not yet been integrated with GAS/V3 or a persistent writer. Row-level optimistic checks, concurrent locks, checkpoint persistence, atomicity, retry bounds, quota/runtime and restoration still need integration.
- Hash must be calculated from the **exact raw source** using a stable documented algorithm; current function accepts a supplied hash, does not authenticate its content. Require proof the sourceHash matches the submitted raw before enabling writes.
- The example in tests is synthetic, not an actual RSS row. Existing 196 V3 tests have **not** been rerun in this chat.
- Any actual copy-pilot requires separate approval for project, tab, exact EP IDs, write columns, max rows, dry-run vs real write, stop rule, audit log and restore procedure. The original 6,591-row ledger is off-limits.

## Next work

1. Add full exact-raw hash validation, richer citation-aware link categorization (article vs show notice, reference, event), and source snippet offsets.
2. Integrate proposal flow with V3 preview (no writes) and test on archived seven-show samples.
3. Only after approval: reflect to isolated GAS and manually preview. No automatic collection/production deployment until separately approved.
