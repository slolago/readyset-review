---
phase: 12-download-and-polish
plan: "02"
subsystem: files-ui
tags: [download, react-memo, performance, memoization, review-page]
dependency_graph:
  requires: []
  provides: [download-action-bar, download-canvas-menu, download-three-dot, download-review-page, asset-grid-memo, asset-list-memo, folder-card-memo]
  affects: [FolderBrowser, AssetCard, AssetGrid, AssetListView, review-page]
tech_stack:
  added: []
  patterns: [React.memo, useCallback stabilization, anchor-download-trick]
key_files:
  created: []
  modified:
    - src/components/files/FolderBrowser.tsx
    - src/components/files/AssetCard.tsx
    - src/components/files/AssetGrid.tsx
    - src/components/files/AssetListView.tsx
    - src/app/review/[token]/page.tsx
decisions:
  - Download button in action bar uses same bg-frame-border styling as Move button for visual consistency
  - Download all canvas menu item disabled when assets.length === 0 to prevent no-op confusion
  - Download item in three-dot Dropdown inserted between Manage version stack and Delete
  - Review page download button uses opacity-0 group-hover:opacity-100 matching AssetCard three-dot button pattern
  - Only outer AssetListView wrapped in memo; inner AssetListRow benefits automatically
  - closeCanvasMenu useCallback stabilizes ContextMenu onClose reducing useEffect re-registrations
  - handleRequestMoveItem passed directly (already useCallback) instead of wrapping in new arrow
metrics:
  duration: 4 min
  completed_date: "2026-04-06"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 5
---

# Phase 12 Plan 02: Download Functionality and React.memo Memoization Summary

**One-liner:** Four download entry points (action bar, canvas menu, three-dot, review page) plus React.memo wrapping of AssetGrid, AssetListView, and FolderCard with useCallback-stabilized props.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Download handlers + action bar, canvas menu, three-dot, review page | 214c7c6e |
| 2 | React.memo + useCallback memoisation | 280dac55 |

## What Was Built

### Task 1: Download Functionality

**FolderBrowser.tsx:**
- Added `Download` to lucide-react imports
- `handleDownloadSelected` — iterates selected assets, triggers sequential anchor downloads with 100ms delay between each
- `handleDownloadAll` — same pattern for all assets in folder
- Download button in multi-select action bar (between Move and Delete, matching Move button styling)
- "Download all" item appended to canvas right-click menu with `dividerBefore: true`, disabled when `assets.length === 0`

**AssetCard.tsx:**
- Download item added to three-dot Dropdown between "Manage version stack" and "Delete"
- Uses the existing `handleDownload` function (anchor trick with `signedUrl`)
- `Download` icon was already imported

**review/[token]/page.tsx:**
- Added `Download` to lucide-react import
- Asset grid items wrapped in `relative group` container
- Per-asset download button overlay: absolute positioned at bottom-right, `opacity-0 group-hover:opacity-100`, only shown when `allowDownloads === true` AND `signedUrl` is available

### Task 2: Performance Memoization

**AssetGrid.tsx:**
- Added `import React from 'react'`
- Exported as `React.memo(function AssetGrid(...) { ... })`

**AssetListView.tsx:**
- Added `memo` to react imports
- Outer `AssetListView` exported as `memo(function AssetListView(...) { ... })`
- Inner `AssetListRow` unchanged (benefits automatically)

**FolderBrowser.tsx:**
- Added `React` to the default import for `React.memo` usage
- `FolderCard` changed from `function FolderCard(...)` to `const FolderCard = React.memo(function FolderCard(...))`
- `handleSelectAll` added as `useCallback` replacing inline `(ids) => setSelectedIds(new Set(ids))`
- `closeCanvasMenu` added as `useCallback` replacing inline `() => setCanvasMenu(null)` on canvas ContextMenu
- Both `onRequestMove` props now pass `handleRequestMoveItem` directly (already a `useCallback`)

## Deviations from Plan

None — plan executed exactly as written. The build environment shows Firebase API key errors during static prerendering (pre-existing, not related to changes). TypeScript `tsc --noEmit` passes cleanly.

## Known Stubs

None.

## Self-Check: PASSED

- src/components/files/FolderBrowser.tsx: FOUND
- src/components/files/AssetCard.tsx: FOUND
- src/components/files/AssetGrid.tsx: FOUND
- src/components/files/AssetListView.tsx: FOUND
- src/app/review/[token]/page.tsx: FOUND
- Commit 214c7c6e: FOUND
- Commit 280dac55: FOUND
