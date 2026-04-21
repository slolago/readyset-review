---
phase: 61
plan: 01
subsystem: transactional-mutations
tags: [firestore, transactions, concurrency, versioning, upload]
requirements: [TXN-01, TXN-02, TXN-03, TXN-04]
dependency-graph:
  requires: [firebase-admin Transaction API, src/lib/version-groups.ts]
  provides: [fetchGroupMembersTx helper, transactional merge/unstack/auto-version]
  affects:
    - src/app/api/assets/merge-version/route.ts
    - src/app/api/assets/unstack-version/route.ts
    - src/app/api/upload/signed-url/route.ts
tech-stack:
  added: []
  patterns: [Firestore runTransaction — reads-before-writes, tx-aware fetch helpers]
key-files:
  created: []
  modified:
    - src/lib/version-groups.ts
    - src/app/api/assets/merge-version/route.ts
    - src/app/api/assets/unstack-version/route.ts
    - src/app/api/upload/signed-url/route.ts
decisions:
  - Added fetchGroupMembersTx alongside fetchGroupMembers (rather than overloading) so non-tx callers are untouched — surgical change.
  - Kept signed-url auto-version scan as a projectId-filtered query + in-memory filter (existing pattern) to avoid requiring a new composite index on (projectId, folderId, name).
  - Combined TXN-03 + TXN-04 into a single transaction in signed-url since both touch the same request and TXN-04 must happen before the asset doc is reserved.
  - Used sentinel errors (FOLDER_NOT_FOUND, NOT_A_STACK) thrown inside the transaction and caught outside to translate to HTTP status codes — keeps the tx closure pure and avoids leaking NextResponse into tx retries.
metrics:
  duration: ~15 min
  completed: 2026-04-20
---

# Phase 61 Plan 01: Transactional Mutations Summary

Wrapped merge-version, unstack-version, and upload/signed-url auto-versioning in Firestore `runTransaction`, and added an in-tx folder liveness check so soft-deleted folders can't receive new uploads.

## What Changed

### `src/lib/version-groups.ts`
Added `fetchGroupMembersTx(db, tx, groupId)` — mirror of `fetchGroupMembers` that routes all reads through a `Transaction`. Handles legacy-root inclusion via `tx.get(rootDoc)`. Sorted ascending by version.

### `src/app/api/assets/merge-version/route.ts` (TXN-01)
Replaced `db.batch()` with `db.runTransaction()`. Both group reads (`fetchGroupMembersTx` for source + target) run at the top of the closure; all `tx.update()` calls follow. Auth check and pre-validation (same-project, same-group) stay outside the tx to avoid retry overhead.

### `src/app/api/assets/unstack-version/route.ts` (TXN-02)
Same refactor. `fetchGroupMembersTx(tx, groupId)` inside the closure, then the detach write + remaining-member re-compaction writes. The "not a stack" validation became `throw new Error('NOT_A_STACK')` → caught outside → 400.

### `src/app/api/upload/signed-url/route.ts` (TXN-03 + TXN-04)
Single transaction wraps:
1. **TXN-04**: `tx.get(folders/{folderId})` — if missing or `deletedAt` set, throw `FOLDER_NOT_FOUND` → 404.
2. **TXN-03**: name-collision scan (tx-read of `assets where projectId==...`, in-memory filter by folder+name+status), pick highest-version representative, `tx.get` its group query, compute next version.
3. `tx.set(assets/{assetId}, {...})` — the single write.

Concurrent uploads of the same `(projectId, folderId, filename)` will now serialize via Firestore's optimistic concurrency — the second one re-runs and sees V1 already written, producing V2 (not a duplicate V1).

## Commits

| Task | Commit    | Description                                                          |
| ---- | --------- | -------------------------------------------------------------------- |
| 1    | `b30cf981` | fix(61-01): task 1 — TXN-01 wrap merge-version in runTransaction     |
| 2    | `b3cbea70` | fix(61-01): task 2 — TXN-02 wrap unstack-version in runTransaction   |
| 3+4  | `0fc3c0bf` | fix(61-01): tasks 3+4 — TXN-03/04 transactional auto-version + folder live-check |

## Grep Checks

- `db\.batch\(\)` in `src/app/api/assets/{merge,unstack}-version`: **0 matches** (confirmed scrubbed)
- `runTransaction` present in all three target routes: confirmed
- Out-of-scope `db.batch()` usages remain in `assets/copy/route.ts` and `assets/[assetId]/route.ts` (delete/soft-delete flows) — **NOT in scope** for this plan

## Firestore Rule Compliance

All three transaction closures were audited: every `tx.get()` call precedes every `tx.update()` / `tx.set()` call within the same closure. No reads after writes.

## Tests

`npx tsc --noEmit` — clean.
`npx vitest run` — 156/156 passed (5 files: names, jobs, format-date, permissions, permissions-api).

## Deviations from Plan

None — plan executed exactly as written. No auto-fixes required.

## Self-Check: PASSED

- Files modified exist: confirmed via git log
- Commits exist: b30cf981, b3cbea70, 0fc3c0bf all present on master
