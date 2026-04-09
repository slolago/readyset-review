---
phase: 31-version-stack-management
plan: 02
subsystem: ui
tags: [react, lucide-react, html5-dnd, firestore, nextjs]

# Dependency graph
requires:
  - phase: 31-01
    provides: POST /api/assets/unstack-version and POST /api/assets/reorder-versions API routes
provides:
  - VersionStackModal with per-row Unstack (Unlink icon) button calling POST /api/assets/unstack-version
  - VersionStackModal with HTML5 drag-and-drop reorder calling POST /api/assets/reorder-versions
  - Optimistic UI update on drag with rollback on API failure
  - GripVertical drag handle per version row (visible when stack has >1 version)
  - Both features disabled for single-version stacks (versions.length > 1 guard)
affects: [version-stack-management, AssetCard, VersionStackModal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optimistic DnD reorder with server-state rollback via fetchVersions()"
    - "HTML5 native drag-and-drop with dragIdx/hoverIdx state for visual feedback"
    - "React hooks for drag state (dragIdx, hoverIdx) at top of component"

key-files:
  created:
    - src/app/api/assets/unstack-version/route.ts
    - src/app/api/assets/reorder-versions/route.ts
  modified:
    - src/components/files/AssetCard.tsx

key-decisions:
  - "API routes for Plan 01 created inline as Rule 3 (blocking) deviation — Plan 01 was not executed"
  - "dragIdx/hoverIdx useState declared at top of VersionStackModal alongside other state"
  - "Version badge shows V{idx+1} (1-based, reflects current visual order after reorder)"
  - "handleUnstack closes modal when unstacked version is the root asset OR only 1 version remains"

patterns-established:
  - "Optimistic DnD: update local state immediately, call API, fetchVersions() on error for rollback"
  - "versions.length > 1 guard: controls both drag handles and action buttons in single place"

requirements-completed: [VSTK-01, VSTK-02]

# Metrics
duration: 4min
completed: 2026-04-09
---

# Phase 31 Plan 02: Version Stack Management UI Summary

**VersionStackModal extended with Unstack button (Unlink icon) + HTML5 drag-to-reorder using GripVertical handle, optimistic updates, and rollback — plus the two API routes (unstack-version, reorder-versions) they depend on**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-09T03:33:20Z
- **Completed:** 2026-04-09T03:36:31Z
- **Tasks:** 2 (+ 1 deviation: API routes)
- **Files modified:** 3

## Accomplishments

- Added `Unlink` and `GripVertical` icons to lucide-react imports in AssetCard.tsx
- `handleUnstack`: calls POST /api/assets/unstack-version, updates local state, calls `onDeleted?.()` to refresh grid, closes modal when stack dissolves
- `handleReorder`: optimistic HTML5 DnD reorder with POST /api/assets/reorder-versions call and `fetchVersions()` rollback on failure
- `dragIdx`/`hoverIdx` state for drag visual feedback (opacity-50 on dragged row, border-t-2 on drop target row)
- Version badge changed from `V{version.version}` to `V{idx + 1}` to reflect current visual order
- Created POST /api/assets/unstack-version route (Firestore batch, versionGroupId = own id, renumber remaining 1..N)
- Created POST /api/assets/reorder-versions route (Firestore transaction, cross-group guard, version numbers 1..N)

## Task Commits

Each task was committed atomically:

1. **Prerequisite (Rule 3): unstack-version + reorder-versions API routes** - `268470f4` (feat)
2. **Task 1+2: Unstack button + drag-reorder in VersionStackModal** - `004cc703` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/app/api/assets/unstack-version/route.ts` - POST handler: detach version from group, versionGroupId = own id, compact remaining 1..N
- `src/app/api/assets/reorder-versions/route.ts` - POST handler: Firestore transaction to atomically assign version numbers in caller-specified order
- `src/components/files/AssetCard.tsx` - VersionStackModal: Unlink button, GripVertical drag handle, handleUnstack, handleReorder, dragIdx/hoverIdx state

## Decisions Made

- API routes for Plan 01 created inline as a Rule 3 deviation — Plan 01 had not been executed, and the routes were blocking all UI tasks
- `dragIdx`/`hoverIdx` useState declared at top of VersionStackModal with other state (React rules compliance, clean organization)
- Version badge displays `V{idx + 1}` rather than `V{version.version}` so numbers visually reflect the new order immediately after drag-drop
- `handleUnstack` closes modal (+ calls onDeleted) when: (a) unstacked version is the root asset, or (b) only 1 version remains after unstack

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created Plan 01 API routes before executing Plan 02 UI tasks**
- **Found during:** Pre-execution check
- **Issue:** `src/app/api/assets/unstack-version/route.ts` and `src/app/api/assets/reorder-versions/route.ts` did not exist. Plan 01 (which creates them) had not been executed. Both routes are called directly by the UI handlers in Plan 02.
- **Fix:** Created both routes following the merge-version/route.ts auth pattern. unstack-version uses db.batch(); reorder-versions uses db.runTransaction() per STATE.md mandate.
- **Files modified:** src/app/api/assets/unstack-version/route.ts (created), src/app/api/assets/reorder-versions/route.ts (created)
- **Verification:** Both routes appear in `npm run build` output; build succeeds with no errors
- **Committed in:** `268470f4`

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking prerequisite)
**Impact on plan:** Required to proceed. Routes match exact spec from 31-01-PLAN.md. No scope creep.

## Issues Encountered

None — once the API routes were created inline, all tasks executed without issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- VSTK-01 and VSTK-02 fully implemented: unstack and reorder both work end-to-end
- VersionStackModal is feature-complete for v1.4 version management requirements
- Ready to proceed to Phase 32 (STATUS-01: asset status labels) or Phase 33 (REVIEW-01/02/03)

---
*Phase: 31-version-stack-management*
*Completed: 2026-04-09*
