---
phase: 06-asset-context-menu
plan: 01
subsystem: ui
tags: [react, lucide, dropdown, inline-editing, firebase, next.js]

# Dependency graph
requires: []
provides:
  - Inline rename for AssetCard via PUT /api/assets/[assetId]
  - Inline rename for FolderCard via PUT /api/folders/[folderId]
  - Rename item in both asset and folder dropdowns
affects: [06-02, any plan touching AssetCard or FolderBrowser]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline rename: isRenaming state + controlled input replacing static text; Enter/blur commits, Escape cancels"
    - "Reuse existing onDeleted/onRename callbacks to trigger parent refetch after mutation"

key-files:
  created: []
  modified:
    - src/components/files/AssetCard.tsx
    - src/components/files/FolderBrowser.tsx

key-decisions:
  - "Reuse onDeleted prop in AssetCard as rename refresh trigger (parent already wires it to refetchAssets)"
  - "FolderCard onRename threads fetchFolders from FolderBrowser — consistent with how onDelete is handled"
  - "divider: true placed on Delete item (not Rename) to visually separate destructive action"

patterns-established:
  - "Inline rename pattern: useState(isRenaming) + useRef(input) + setTimeout select() for focus; Enter/blur commits, Escape cancels without network call"

requirements-completed: [REQ-06A]

# Metrics
duration: 10min
completed: 2026-04-06
---

# Phase 6 Plan 1: Rename Action for Asset and Folder Cards Summary

**Inline rename via Pencil dropdown item: Enter/blur commits to PUT API, Escape cancels; wired to both AssetCard and FolderCard**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-06T17:31:00Z
- **Completed:** 2026-04-06T17:41:00Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- Added `Rename` as the first item in the AssetCard dropdown; clicking it switches the filename `<p>` to a focused `<input>` pre-filled with the current name
- Added the same inline rename pattern to FolderCard inside FolderBrowser.tsx, with `commitFolderRename` calling PUT /api/folders/[folderId]
- Threaded `onRename={fetchFolders}` from FolderBrowser to FolderCard so the folder list refreshes on successful rename

## Task Commits

1. **Task 1: Add inline rename to AssetCard** - `d95ff2cf` (feat)
2. **Task 2: Add inline rename to FolderCard and thread through FolderBrowser** - `2b943357` (feat)

## Files Created/Modified

- `src/components/files/AssetCard.tsx` - Added useState/Pencil imports, isRenaming state, handleRename, commitRename, conditional rename input, Rename dropdown item
- `src/components/files/FolderBrowser.tsx` - Added Pencil import, onRename prop to FolderCard, isRenaming state, handleRenameFolder, commitFolderRename, conditional rename input, Rename dropdown item, onRename={fetchFolders} in render

## Decisions Made

- Reused `onDeleted` in AssetCard as the post-rename refresh hook (it triggers refetchAssets in the parent — no dedicated `onRenamed` prop needed)
- `divider: true` placed on Delete item (not Rename) to visually group the destructive action separately from editing actions
- `commitFolderRename` only makes a network call when `trimmed !== folder.name`; no-op on blank or unchanged input

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Rename is live on both asset and folder cards
- Plan 06-02 can proceed (additional context menu actions such as Move or Copy)

---
*Phase: 06-asset-context-menu*
*Completed: 2026-04-06*

## Self-Check: PASSED

- AssetCard.tsx: FOUND
- FolderBrowser.tsx: FOUND
- 06-01-SUMMARY.md: FOUND
- Commit d95ff2cf (Task 1): FOUND
- Commit 2b943357 (Task 2): FOUND
- Commit ae953a94 (docs): FOUND
