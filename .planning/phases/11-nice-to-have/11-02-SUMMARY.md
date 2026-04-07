---
phase: 11-nice-to-have
plan: "02"
subsystem: files/ui
tags: [context-menu, right-click, ux, portal]
dependency_graph:
  requires: []
  provides: [right-click-context-menus]
  affects: [AssetCard, FolderBrowser, AssetGrid, AssetListView]
tech_stack:
  added: [ReactDOM.createPortal]
  patterns: [portal-rendered-overlay, viewport-edge-flip, event-stopPropagation]
key_files:
  created:
    - src/components/ui/ContextMenu.tsx
  modified:
    - src/components/files/AssetCard.tsx
    - src/components/files/AssetGrid.tsx
    - src/components/files/FolderBrowser.tsx
    - src/components/files/AssetListView.tsx
decisions:
  - MenuItem type imported but items inlined as object literals — type import is harmless and documents the shape
  - Copy to excluded from AssetListView rows: AssetListRow does not own CopyModal state; users use grid view or asset detail page
  - FolderCard ContextMenu rendered inside card div (portal escapes to body anyway) for correct React tree scoping
metrics:
  duration: "15 min"
  completed_date: "2026-04-06"
  tasks_completed: 4
  tasks_total: 4
  files_created: 1
  files_modified: 4
---

# Phase 11 Plan 02: Context Menu Wiring Summary

One-liner: Portal-based ContextMenu component wired into asset/folder cards (grid + list view) and empty canvas space with viewport-edge flip and full dismiss logic.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create ContextMenu portal component | 12dfe31f | src/components/ui/ContextMenu.tsx |
| 2 | Wire context menu into AssetCard with Move to support | 38322f1d | src/components/files/AssetCard.tsx |
| 3 | Wire context menu into FolderCard and canvas in FolderBrowser | fb3f0752 | src/components/files/FolderBrowser.tsx, AssetGrid.tsx |
| 4 | Wire context menu into AssetListView rows | b5c8fed7 | src/components/files/AssetListView.tsx, FolderBrowser.tsx |

## What Was Built

### ContextMenu.tsx (new)
Reusable portal-rendered context menu using `ReactDOM.createPortal(menu, document.body)` with:
- `position: fixed` at cursor coordinates
- Viewport-edge flip: shifts left/up when menu would overflow window bounds
- Dismisses on `mousedown` outside, `Escape` key, scroll (capture phase)
- Visual classes match `Dropdown.tsx` exactly: `bg-frame-card border border-frame-border rounded-xl shadow-2xl`
- Exports `ContextMenu` function component and `MenuItem` interface

### AssetCard context menu (8 items)
Right-clicking an asset card in grid view shows: Open, Rename, Duplicate, Copy to, Move to, Download, Get link, Delete.
- `e.stopPropagation()` prevents canvas handler from also firing
- `handleDownload` creates anchor element with `download` attribute
- `handleGetLink` copies asset URL to clipboard via navigator.clipboard
- `onRequestMove` prop added to AssetCardProps

### FolderCard context menu (7 items)
Right-clicking a folder card shows: Open, Rename, Duplicate, Copy to, Move to, Create review link, Delete.
- `e.stopPropagation()` prevents canvas handler from also firing
- `onRequestMove` prop added to FolderCard

### Canvas context menu (3 items)
Right-clicking empty space in FolderBrowser shows: New Folder, Upload files, Upload folder.
- Guard: `closest('[data-selectable]')` check — if a card was right-clicked, the card's own handler already fired via stopPropagation

### AssetGrid forwarding
`onRequestMove?: (assetId: string) => void` added to `AssetGridProps`, forwarded to each `AssetCard` as `() => onRequestMove(asset.id)`.

### AssetListView row context menu (7 items)
Right-clicking a list view row shows: Open, Rename, Duplicate, Move to, Download, Get link, Delete.
- Action handlers inline in `AssetListRow`: handleRename (prompt), handleDuplicate, handleDelete, handleDownload, handleGetLink
- Copy to intentionally excluded: `AssetListRow` does not own the folder picker modal state

### handleRequestMoveItem
`FolderBrowser` helper that sets `selectedIds` to `[itemId]` then opens `MoveModal` — enables single-item "Move to" from context menu.

## Decisions Made

1. **MenuItem import**: Imported but not directly referenced in JSX since items are inlined. TypeScript `import type` is harmless and serves as documentation.
2. **Copy to excluded from list rows**: `AssetListRow` is an internal component with no access to the copy modal state managed by `AssetCard`. Users can use grid view or the asset detail page.
3. **ContextMenu rendered inside card div**: Even though portal escapes to `document.body`, React tree scoping ensures context menu state lifecycle is tied to the card component.
4. **Viewport-edge flip at render time**: Calculated using `window.innerWidth`/`window.innerHeight` at portal render, not on position update — this is safe since the menu is created fresh on each right-click.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FolderCard onRequestMove not destructured from props**
- **Found during:** Task 4 (build verification)
- **Issue:** `onRequestMove` was added to the FolderCard inline type definition but not destructured in the function parameter list, causing TypeScript error: "Cannot find name 'onRequestMove'"
- **Fix:** Added `onRequestMove` to the FolderCard destructured parameters
- **Files modified:** src/components/files/FolderBrowser.tsx
- **Commit:** b5c8fed7 (included with Task 4 commit)

## Known Stubs

None — all context menu items wire to real handlers.

## Self-Check: PASSED

- src/components/ui/ContextMenu.tsx: FOUND
- src/components/files/AssetCard.tsx: FOUND (contains onContextMenu, ContextMenu, onRequestMove)
- src/components/files/AssetGrid.tsx: FOUND (contains onRequestMove)
- src/components/files/FolderBrowser.tsx: FOUND (contains canvasMenu, handleRequestMoveItem, onContextMenu)
- src/components/files/AssetListView.tsx: FOUND (contains onContextMenu, ContextMenu)
- Build: PASSED (npx next build compiled without type errors)
