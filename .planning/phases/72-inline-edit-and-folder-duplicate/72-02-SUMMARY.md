---
phase: 72-inline-edit-and-folder-duplicate
plan: 02
subsystem: api
tags: [firestore, folders, duplicate, soft-delete, composite-index]

# Dependency graph
requires:
  - phase: 63-dashboard-query-performance
    provides: Composite index on (projectId, parentId, deletedAt) used by GET /api/folders; established the contract that all folder docs must carry an explicit deletedAt field (null when live).
  - phase: 55-folder-copy
    provides: deepCopyFolder BFS helper and /api/folders/copy route — the code path this plan repairs.
provides:
  - deepCopyFolder now writes deletedAt:null on every folder doc it creates (root + BFS children), so duplicates appear in the composite-indexed listing query.
  - Side-effect repair of "Copy to folder" flow (same helper, same bug).
affects: [folder-duplicate, copy-to-folder, folder-listing, soft-delete-invariants]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "All folder writers must set deletedAt:null explicitly (index contract from Phase 63)."

key-files:
  created: []
  modified:
    - src/lib/folders.ts

key-decisions:
  - "Two-line additive fix only — no signature change, no refactor, no touch of asset-copy delete logic (already correct via delete copyData.deletedAt)."
  - "No client changes: handleDuplicateFolder already awaits the 201 and refetches; it only looked broken because the listing excluded the new doc."

patterns-established:
  - "deletedAt:null invariant for folder docs: any code path that creates folders must set it explicitly so composite-indexed queries surface the doc."

requirements-completed: [FS-01]

# Metrics
duration: <1min
completed: 2026-04-21
---

# Phase 72 Plan 02: deepCopyFolder deletedAt fix Summary

**Two-line additive fix to src/lib/folders.ts so duplicated folders carry deletedAt:null and appear in the Phase-63-indexed listing query (repairs Duplicate AND Copy-to-folder).**

## Performance

- **Duration:** <1 min
- **Started:** 2026-04-21T21:13:13Z
- **Completed:** 2026-04-21T21:13:51Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Root folder `.set(...)` in `deepCopyFolder` now writes `deletedAt: null` with a Phase 63 (IDX-03) comment explaining the listing-query contract.
- Subfolder `.set(...)` inside the BFS loop writes the same field for the same reason.
- Bug manifested as "Duplicate toast fires on nothing" — the API returned 201, the new doc was written, but `fetchFolders` returned a list that correctly excluded it (the composite-indexed query `where('deletedAt', '==', null)` skips docs where the field is absent). Fix makes the write shape match the read contract.
- "Copy to folder" flow silently repaired as a side effect — it shares the same helper and was broken the same way.

## Task Commits

1. **Task 1: Set deletedAt:null on every folder doc written by deepCopyFolder** — `97afb310` (fix)

## Files Created/Modified
- `src/lib/folders.ts` — Added `deletedAt: null` to the root-folder `.set(...)` (line ~47) and to the subfolder `.set(...)` inside the BFS loop (line ~128). No other changes.

## Decisions Made
- **Kept signature frozen.** `deepCopyFolder` has one caller (`/api/folders/copy`); no parameter additions needed.
- **Did not touch asset-copy logic** inside the BFS. Asset copy already strips `deletedAt` via `delete copyData.deletedAt` then re-inherits from `...data` — pre-existing behavior, out of scope for FS-01, CLAUDE.md §3 (surgical changes).
- **Did not revisit the listing-query fallback branch** (`src/app/api/folders/route.ts:58-72`). That branch filters `!f.deletedAt` in-memory, which accepts both `null` and missing fields, so it handled the bug already. The fix only matters for the composite-indexed branch (the production path). Both branches continue to handle the field identically.

## Deviations from Plan

None — plan executed exactly as written. Two targeted `.set(...)` additions, exactly as specified in `<action>`.

## Issues Encountered
None.

## Verification

- `npx tsc --noEmit` — passed (clean, no output).
- `npm test` — 171/171 passing (7 test files, 2.72s). No regressions.
- `git diff` confirms minimal surgical change: 4 insertions across two locations, zero deletions, zero adjacent edits.

## User Setup Required
None — no external service configuration, no env vars, no dashboard changes.

## Next Phase Readiness
- FS-01 satisfied: Duplicate produces a real persistent copy visible in the current listing.
- Parity with asset-duplicate is complete (client already awaited the 201; this fix closes the DB-write / read-query gap).
- No blockers. Milestone v2.2 progress advances.

---
*Phase: 72-inline-edit-and-folder-duplicate*
*Completed: 2026-04-21*

## Self-Check: PASSED

- `.planning/phases/72-inline-edit-and-folder-duplicate/72-02-SUMMARY.md` — FOUND
- Commit `97afb310` — FOUND in git log
- `src/lib/folders.ts` contains 2 occurrences of `deletedAt: null` (root + subfolder `.set`) — matches plan `<done>` criteria
