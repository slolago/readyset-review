---
phase: 21-admin-panel-polish
plan: 01
subsystem: ui, api
tags: [admin, firestore, nextjs, tailwind, react]

# Dependency graph
requires:
  - phase: 15-dashboard-and-storage
    provides: admin panel base with UserTable, stats, requireAdmin pattern
provides:
  - Admin "All Projects" tab showing every project with owner name/email and collaborator count
  - /api/admin/projects GET endpoint with batch owner join via db.getAll()
  - ProjectsTable component mirroring UserTable styling conventions
  - UserRoleSelect.tsx deleted (dead code with stale role type)
affects: [any future admin panel extensions, project management features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Batch Firestore owner join: collect ownerIds via Set, then db.getAll() single RPC"
    - "Lazy tab data loading: fetch on first activeTab switch, guard with projects.length===0 && !loading"
    - "-mb-px tab underline pattern for connected border overlap (established Phase 09)"

key-files:
  created:
    - src/app/api/admin/projects/route.ts
    - src/components/admin/ProjectsTable.tsx
  modified:
    - src/app/(app)/admin/page.tsx
  deleted:
    - src/components/admin/UserRoleSelect.tsx

key-decisions:
  - "Delete UserRoleSelect.tsx (dead code, stale 'admin'|'user' two-value type) — not fix it"
  - "Stats grid only shown on Users tab (user-specific data, not relevant to Projects view)"
  - "Projects tab lazy-fetches on first visit — avoids unnecessary API call if admin only checks users"
  - "Array.from(new Set(...)) instead of [...new Set()] to satisfy tsconfig target without downlevelIteration"

patterns-established:
  - "Admin API route pattern: requireAdmin guard → db query → batch owner join → enrich → return"

requirements-completed: [P21-01, P21-02, P21-03, P21-04, P21-05]

# Metrics
duration: 2min
completed: 2026-04-07
---

# Phase 21 Plan 01: Admin Panel Polish Summary

**Tabbed admin panel with all-projects view (owner name/email, collaborator count) via batch Firestore join, and deletion of dead UserRoleSelect.tsx with stale two-value role type**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-07T20:33:00Z
- **Completed:** 2026-04-07T20:35:01Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 1 modified, 1 deleted)

## Accomplishments
- New `/api/admin/projects` GET route fetches all projects with owner name/email joined via a single `db.getAll()` RPC (not N+1 per-owner lookups)
- `ProjectsTable` component renders admin project list with color dot, description snippet, owner column, collaborator count, and relative creation date — matching UserTable styling conventions
- Admin page upgraded with Users / All Projects tab navigation using the established `-mb-px` underline pattern; stats grid visible only on Users tab; projects lazy-loaded on first tab switch
- Deleted `UserRoleSelect.tsx` (confirmed zero imports across codebase) — used stale `'admin' | 'user'` two-value type incompatible with the four-value system role enum

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /api/admin/projects route and ProjectsTable component** - `bb714be2` (feat)
2. **Task 2: Add tab navigation to admin page and delete UserRoleSelect.tsx** - `2c7b1031` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `src/app/api/admin/projects/route.ts` - Admin-only GET endpoint; requireAdmin guard; batch owner join; returns enriched project list
- `src/components/admin/ProjectsTable.tsx` - Table component with Project/Owner/Collaborators/Created columns; Spinner+empty state mirrors UserTable
- `src/app/(app)/admin/page.tsx` - Tab navigation added; fetchProjects callback; lazy load on tab switch; stats grid gated to Users tab; subtitle updated
- `src/components/admin/UserRoleSelect.tsx` - DELETED (dead code, stale type)

## Decisions Made
- Used `Array.from(new Set(...))` instead of spread syntax to avoid TypeScript `downlevelIteration` flag requirement
- Stats grid only shown on the Users tab (admin/manager/editor/viewer counts are user-system data, meaningless on Projects tab)
- Projects tab uses lazy loading: data fetched only on first tab switch, guarded by `projects.length === 0 && !projectsLoading`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript error on Set spread**
- **Found during:** Task 1 verification (`npx tsc --noEmit`)
- **Issue:** `[...new Set(...)]` failed with TS2802 — requires `--downlevelIteration` or ES2015+ target
- **Fix:** Replaced with `Array.from(new Set(...))` which works at any target without flag changes
- **Files modified:** `src/app/api/admin/projects/route.ts`
- **Verification:** `npx tsc --noEmit` returned clean after fix
- **Committed in:** `bb714be2` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Trivial one-line fix for TypeScript compatibility. No scope creep.

## Issues Encountered
None beyond the TS2802 error caught and fixed inline.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Admin panel now surfaces all projects system-wide with owner visibility
- Phase 22 (asset-download-button) is independent of this phase — ready to proceed

---
*Phase: 21-admin-panel-polish*
*Completed: 2026-04-07*
