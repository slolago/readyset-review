---
phase: 28-version-stack-dnd
plan: 02
subsystem: ui
tags: [react, drag-and-drop, version-stack, firebase, tailwind]

# Dependency graph
requires:
  - phase: 28-version-stack-dnd
    plan: 01
    provides: POST /api/assets/merge-version endpoint

provides:
  - AssetCard isDropTarget highlight prop (accent border + ring when drop target)
  - AssetCard onDragOver/onDragLeave/onDrop event forwarding props
  - AssetGrid dragOverAssetId + three handler prop thread
  - FolderBrowser dragOverAssetId state and handleAssetDragOver/Leave/Drop handlers
  - Dual MIME type (x-frame-move + x-frame-version-stack) on drag start
  - End-to-end drag-to-stack UX: highlight → drop → toast → grid refresh

affects: [version-stack, asset-grid, folder-browser, dnd]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual MIME type on drag start: set both application/x-frame-move (folder move) and application/x-frame-version-stack (version stack) so handlers can distinguish intent"
    - "Belt-and-suspenders upload guard: AssetCard suppresses onDragOver when isUploading; FolderBrowser handleAssetDragOver also checks status !== 'ready'"
    - "e.stopPropagation() in handleAssetDrop prevents event bubbling to OS file-upload container drop handler"

key-files:
  created: []
  modified:
    - src/components/files/AssetCard.tsx
    - src/components/files/AssetGrid.tsx
    - src/components/files/FolderBrowser.tsx

key-decisions:
  - "isDropTarget placed before isSelected in className ternary — drop target highlight has higher visual priority than selection ring"
  - "handleAssetDragOver checks assets.find() for status !== 'ready' as server-side guard; AssetCard isUploading prop is the client-side guard — both layers required"
  - "Same-group no-op checked via versionGroupId fallback to asset id — prevents redundant stack merges in UI before API call"

patterns-established:
  - "DnD prop thread pattern: FolderBrowser owns state → AssetGrid threads props → AssetCard binds to outer div"
  - "Blocking drop on uploading cards: pass undefined for handler (not noop function) so preventDefault is never called and browser shows no-drop cursor"

requirements-completed: [P28-08, P28-09, P28-10, P28-11, P28-12, P28-13, P28-14, P28-15]

# Metrics
duration: 20min
completed: 2026-04-08
---

# Phase 28 Plan 02: Version Stack DnD UI Summary

**Drag-to-version-stack end-to-end: accent border highlight on drop target, dual MIME type drag start, and FolderBrowser orchestration calling POST /api/assets/merge-version with toast and grid refresh**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-08
- **Completed:** 2026-04-08
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 3

## Accomplishments

- AssetCard now accepts `isDropTarget`, `onDragOver`, `onDragLeave`, `onDrop` props; outer div shows accent border with ring-2 and bg tint when `isDropTarget=true`; uploading cards block all drop events by passing `undefined` handlers
- AssetGrid threads `dragOverAssetId` state and three new handler props through to each AssetCard, computing `isDropTarget={dragOverAssetId === asset.id}` inline
- FolderBrowser adds `dragOverAssetId` state, dual MIME type in `handleItemDragStart` (x-frame-version-stack alongside x-frame-move), and three `useCallback` handlers that validate the drag type, guard uploading targets, enforce self-drop and same-group no-ops, call POST /api/assets/merge-version, show a success/error toast, and call `refetchAssets()` on success
- All 6 manual verification checks passed: drag highlight, merge toast + grid refresh, self-drop no-op, same-stack no-op, uploading card blocks drop, folder-move unchanged

## Task Commits

1. **Task 1: Add isDropTarget highlight and drop event props to AssetCard** - `5e182ae3` (feat)
2. **Task 2: Thread version-stack DnD props through AssetGrid and wire FolderBrowser orchestration** - `a609efa1` (feat)
3. **Task 3: Checkpoint — human verification** - approved by user (all 6 checks passed)

## Files Created/Modified

- `src/components/files/AssetCard.tsx` — Added `isDropTarget`, `onDragOver`, `onDragLeave`, `onDrop` props; updated outer div className ternary and event bindings
- `src/components/files/AssetGrid.tsx` — Added `dragOverAssetId`, `onAssetDragOver`, `onAssetDragLeave`, `onAssetDrop` props; threaded to each AssetCard
- `src/components/files/FolderBrowser.tsx` — Added `dragOverAssetId` state, dual MIME type in `handleItemDragStart`, three new asset DnD handlers, updated AssetGrid JSX

## Decisions Made

- `isDropTarget` placed before `isSelected` in className ternary so drop highlight takes visual priority over selection ring
- `handleAssetDragOver` in FolderBrowser checks `status !== 'ready'` as a belt-and-suspenders server-side guard; AssetCard passing `undefined` for `onDragOver` when `isUploading` is the primary client-side guard
- `e.stopPropagation()` in `handleAssetDrop` prevents bubbling to the container OS file-upload drop handler

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 28 is complete: POST /api/assets/merge-version (plan 01) + full drag-to-stack UI (plan 02) are both shipped
- The complete version-stacking feature is ready for end-to-end use: drag one asset onto another to create a version group

---
*Phase: 28-version-stack-dnd*
*Completed: 2026-04-08*
