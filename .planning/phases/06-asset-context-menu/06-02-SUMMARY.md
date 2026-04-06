---
phase: 06-asset-context-menu
plan: 02
subsystem: ui+api
tags: [react, lucide, dropdown, copy, duplicate, firebase, next.js]

# Dependency graph
requires: [06-01]
provides:
  - POST /api/assets/copy — shallow Firestore copy with new versionGroupId
  - POST /api/folders/copy — shallow folder doc copy with recomputed path[]
  - Copy to folder picker modal in AssetCard (AssetFolderPickerModal)
  - Duplicate (same-folder copy, no modal) in AssetCard
  - Copy to and Duplicate in FolderCard via reused MoveModal with title prop
  - onCopied/onDuplicated props thread through AssetGrid for grid refresh
affects: [07-version-management, any plan touching AssetCard or FolderBrowser]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shallow copy: new Firestore doc reuses same gcsPath/url — no GCS file duplication"
    - "Asset copy starts new independent versionGroupId (version: 1)"
    - "Folder copy recomputes path[] from destination parent doc"
    - "ensureAllFolders: lazy load folder tree for copy modal, skip if already loaded"
    - "MoveModal reused for FolderCard copy picker via optional title prop"

key-files:
  created:
    - src/app/api/assets/copy/route.ts
    - src/app/api/folders/copy/route.ts
  modified:
    - src/components/files/AssetCard.tsx
    - src/components/files/AssetGrid.tsx
    - src/components/files/FolderBrowser.tsx

key-decisions:
  - "Shallow copy only: new doc references same gcsPath/url — no GCS file copy; correct for large-file media managers"
  - "Asset copy creates new independent versionGroupId so copy is not versioned against original"
  - "AssetFolderPickerModal is an inline component at end of AssetCard.tsx; MoveModal is reused for FolderCard with title prop"
  - "ensureAllFolders helper in FolderBrowser loads lazily on first Copy to click, skips if allFolders already populated"
  - "onCopied/onDuplicated callbacks thread through AssetGrid so grid refreshes after copy/duplicate"

patterns-established:
  - "Lazy folder tree load: ensureAllFolders skips fetch if allFolders.length > 0"
  - "MoveModal title prop: optional override for the hardcoded 'Move N item(s)' heading"

requirements-completed: [REQ-06B, REQ-06C]

# Metrics
duration: ~18min
completed: 2026-04-06
---

# Phase 6 Plan 2: Copy to and Duplicate Actions Summary

**Two new API endpoints for shallow Firestore-doc copy plus folder picker modal and duplicate handlers in AssetCard and FolderCard — new item appears in grid immediately via onCopied/onDuplicated callbacks**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-06T16:21:00Z
- **Completed:** 2026-04-06T16:39:00Z
- **Tasks:** 2/2
- **Files created:** 2
- **Files modified:** 3

## Accomplishments

### API Routes (Task 1)

- Created `POST /api/assets/copy` — shallow copy: new Firestore doc with same `gcsPath`/`url`, new `versionGroupId` (independent from source), `version: 1`, `createdAt: now()`. `targetFolderId` defaults to source folder if omitted (Duplicate behaviour).
- Created `POST /api/folders/copy` — creates new folder doc with recomputed `path[]` from destination parent. `targetParentId` defaults to same parent if omitted (Duplicate behaviour). Intentionally shallow: does not copy folder contents.
- Both endpoints: 401 auth, 404 not found, 403 project access guard.

### UI (Task 2)

- **AssetCard**: Added `Copy to` (opens `AssetFolderPickerModal` with lazily-fetched project folder tree) and `Duplicate` (fires immediately, no modal) to the MoreHorizontal dropdown. New `onCopied` and `onDuplicated` optional props trigger parent grid refresh.
- **AssetGrid**: Added `onCopied` / `onDuplicated` props, threaded them to each `AssetCard`.
- **FolderBrowser**: Wired `onCopied={refetchAssets}` and `onDuplicated={refetchAssets}` to `AssetGrid`. Added `ensureAllFolders` helper (lazy loader). Passed `allFolders`, `onBeforeCopyTo`, `onCopyTo`, `onDuplicate` to `FolderCard`.
- **FolderCard**: Added `Copy to` and `Duplicate` dropdown items. `handleOpenCopyModal` awaits `onBeforeCopyTo` before opening. `MoveModal` reused with new optional `title` prop.
- **MoveModal**: Added optional `title` prop; heading renders `{title ?? "Move N item(s)"}`.

## Task Commits

1. **Task 1: Create POST /api/assets/copy and POST /api/folders/copy** — `285f1f2a` (feat)
2. **Task 2: Add Copy to and Duplicate to AssetCard, FolderCard, AssetGrid** — `d3b0120c` (feat)

## Files Created/Modified

- `src/app/api/assets/copy/route.ts` — NEW: POST handler for shallow asset copy
- `src/app/api/folders/copy/route.ts` — NEW: POST handler for shallow folder copy
- `src/components/files/AssetCard.tsx` — Added Copy/CopyPlus/Home/FolderIcon/X imports; onCopied/onDuplicated props; showCopyToModal state; openCopyTo/handleCopyTo/handleDuplicate handlers; Copy to+Duplicate dropdown items; AssetFolderPickerModal inline component
- `src/components/files/AssetGrid.tsx` — Added onCopied/onDuplicated to props interface and AssetCard render
- `src/components/files/FolderBrowser.tsx` — Added Copy/CopyPlus imports; ensureAllFolders helper; Copy to+Duplicate props on FolderCard render; onCopied/onDuplicated on AssetGrid; FolderCard allFolders+onBeforeCopyTo+onCopyTo+onDuplicate props; showFolderCopyModal state; handleOpenCopyModal; MoveModal title prop

## Decisions Made

- **Shallow copy only**: new Firestore doc references the same `gcsPath`/`url` — no GCS file duplication. This is correct for a media manager where files can be large. The copy is a new metadata record pointing to the same binary.
- **Asset copy starts a new versionGroupId**: the copy is independent from the original's version stack. It starts at version 1 and can accumulate its own versions.
- **AssetFolderPickerModal in AssetCard.tsx**: small inline component keeps folder tree rendering logic co-located with the parent card; avoids importing from FolderBrowser.
- **MoveModal reused for FolderCard**: avoided duplicating the tree-picker UI by adding a `title` prop to the existing MoveModal. Clean and minimal change.
- **ensureAllFolders**: lazy folder load for FolderCard copy — skips the fetch if allFolders is already populated from a previous move or copy action.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Prior to execution, discovered that the 06-01 feature commits (d95ff2cf, 2b943357) were on branch `worktree-agent-a2fb445f` and had not been merged into master. The docs commit (ae953a94) was on master but without the code. Resolved by merging `worktree-agent-a2fb445f` into master before proceeding with 06-02 work. This was a parallel agent artifact, not a plan deviation.

## Known Stubs

None — all copy/duplicate operations wire through to real API endpoints with toast confirmation and grid refresh.

## User Setup Required

None — no new environment variables or external services required.

## Next Phase Readiness

- Copy to and Duplicate are live on both asset and folder cards
- Phase 7 (version-management) can proceed

---
*Phase: 06-asset-context-menu*
*Completed: 2026-04-06*

## Self-Check: PASSED

- src/app/api/assets/copy/route.ts: FOUND
- src/app/api/folders/copy/route.ts: FOUND
- 06-02-SUMMARY.md: FOUND
- Commit 285f1f2a (Task 1): FOUND
- Commit d3b0120c (Task 2): FOUND
