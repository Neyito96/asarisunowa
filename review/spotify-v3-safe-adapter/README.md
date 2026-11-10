# Spotify Access V3 safe adapter patch — 2026-10-05

## Status

Review-only branch. No GAS deployment and no Spotify production write.

This patch is based directly on the uploaded `spotify-access-v3-candidate-20261004(2).zip` source, not reconstructed code.

The repository main at `0b61d8f0ee2b591ce1c88d3a6b3d71027f408795` does not contain the `access-v3/` candidate tree, so this branch stores the verified patch artifact first rather than pretending it can be applied cleanly to main.

## What the patch does

It introduces a domain adapter boundary while keeping existing Nordic V3 behavior intact. Phase 1 registers Nordic only. Unknown playlist domains fail closed with `SP3_DOMAIN_ADAPTER_MISSING` before any Spotify write can occur.

The adapter is resolved per persisted job / playlist, not once per run. This avoids a future Nordic/speaker mixed-job run from inheriting the wrong adapter.

## Safety core left unchanged

No changes are made to the V3 safety core, including:
- `sp3Gateway_`
- `sp3Membership_`
- `sp3Enqueue_`
- `sp3SaveJob_`
- `sp3RefreshJob_`
- request budget / 429 / cooldown logic
- stable playlist snapshot construction
- ambiguous POST verify flow
- journal-before-send sequence

## Local verification

Command:

```sh
node --test access-v3/tests/access-v3.test.cjs tests/theme-v2.test.cjs tests/theme-write-gate.test.cjs tests/canary.test.cjs
```

Result: **95/95 PASS**.

Original 92 tests remain green plus 3 adapter-boundary tests:
1. Nordic resolves exactly; unknown playlist fails closed.
2. Unknown-domain write fails before any Spotify request.
3. Nordic adapter preserves classifier and queue-row semantics.

## Important next step

Do not deploy this patch to GAS yet.

Before speaker Phase 2, obtain the actual current production source for the existing speaker decision/classifier paths (especially human exclusion). Build one speaker adapter only against those exact functions and add integration tests.

The companion file `spotify-v3-safe-adapter.patch` is the exact audited patch against the uploaded V3 candidate.
