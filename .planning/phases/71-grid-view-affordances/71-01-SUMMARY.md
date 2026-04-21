---
phase: 71-grid-view-affordances
plan: 01
subsystem: files-browser
tags: [view-toggle, hover-preview, three-dots, z-index, folder-list]
requires: [phase-70 ctx-menu + action helper, AssetListView, FolderCard]
provides:
  - List-view branch for folders when the current folder contains only folders
  - Asset three-dots button reachable on hover-preview video cards
affects:
  - src/components/files/FolderBrowser.tsx
  - src/components/files/AssetCard.tsx
tech-stack:
  added: []
  patterns:
    - "viewMode branch in folders block (grid → FolderCard grid, list → FolderListView table)"
    - "pointer-events-none on hover-preview chrome; z-20 on three-dots wrapper"
key-files:
  created: []
  modified:
    - src/components/files/FolderBrowser.tsx
    - src/components/files/AssetCard.tsx
decisions:
  - "Lifted onCopyTo/onDuplicate inline lambdas into module-scope helpers so grid + list rows share one code path"
  - "FolderListRow rebuilds buildFileBrowserActions('folder', …) locally — same labels/handlers as FolderCard, no cross-component hook extraction (two call sites don't justify a shared hook)"
  - "Chose approach (a) from CONTEXT.md: raise three-dots z-index + make hover overlays pointer-transparent. Cleaner than hit-region exclusion (b)."
  - "z-20 for three-dots wrapper (above z-[1] sprite and z-[2] scrub bar; matches AssetCard's existing z-20 on job-indicator)"
metrics:
  duration: "≈20 minutes"
  completed: "2026-04-21"
  tasks: 2
  files: 2
---

# Phase 71 Plan 01: grid-view-affordances Summary

Folders render as list rows when viewMode is 'list' (VIEW-01); asset three-dots stays reachable over the video hover-preview (VIEW-02). Two surgical fixes in two files.

## Changes

### Task 1 — VIEW-01: folders list view (src/components/files/FolderBrowser.tsx)

1. **Added imports:** `formatRelativeTime` from `@/lib/utils`, `InlineRename` from `@/components/ui/InlineRename`. (Plan stated "no new deps" but the list row needs both — added as a Rule 3 blocking-issue fix.)
2. **Lifted helpers:** Replaced the two inline `onCopyTo` / `onDuplicate` lambdas in the grid FolderCard block with `handleCopyFolder(folder, targetParentId)` and `handleDuplicateFolder(folder)` module-local helpers. Grid + list consume them identically.
3. **Branched the folders block** on `viewMode`:
   - Grid: existing `<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">` of `FolderCard`s preserved verbatim.
   - List: new `<FolderListView>` component — a `<table>` matching AssetListView's shell (same thead styling, same `py-2 px-3 text-xs …` header cell class).
4. **Added `FolderListView`** (React.memo'd) and **`FolderListRow`** components in-file, placed between `FolderCard` and `MoveModal`. Each row:
   - Checkbox cell (matches AssetListRow selection styling).
   - 40×40 folder-icon cell.
   - Name cell with `InlineRename` when renaming, truncated `<span>` otherwise.
   - Date-created cell using `formatRelativeTime`, with Firestore REST `_seconds * 1000` fallback (same pattern as AssetListRow).
   - Three-dots cell with `<Dropdown>` fed by the same `buildFileBrowserActions('folder', …)` call the grid FolderCard uses.
   - Row `onClick` navigates (with CTX-05 `suppressNextClickRef` synthetic-click suppression copied verbatim from FolderCard).
   - Row `onContextMenu` opens `ctxMenu` with identical `folder-${folder.id}` key + action list.
   - Drag-and-drop target — row gets `ring-2 ring-inset ring-frame-accent bg-frame-accent/10` when `isDropTarget`.
5. **Did not touch** the view-toggle markup (lines 1010-1033) — already unconditional. **Did not change** `AssetListView`'s empty-assets `return null` — folder block now renders independently in list mode.

### Task 2 — VIEW-02: asset three-dots (src/components/files/AssetCard.tsx)

1. **Raised three-dots wrapper to `z-20`** (line 613-ish). Preview overlays (`z-[1]` sprite, `z-[2]` scrub bar) can no longer cover it.
2. **Marked all hover-preview chrome `pointer-events-none`:**
   - Sprite overlay (`absolute inset-0 z-[1] bg-black`) → `… pointer-events-none`
   - Scrub progress bar (`absolute bottom-0 … h-[3px] bg-black/40 z-[2]`) → `… pointer-events-none`
   - Sprite-loading spinner (`absolute bottom-1 right-1 z-[2] bg-black/70 …`) → `… pointer-events-none`

   Safe because `onMouseMove` lives on the PARENT thumbnail div, not on any overlay. Mouse events bubble to the parent for scrub; events over the three-dots region now fall through to the wrapper above.

## Files Modified

| File | Change |
| --- | --- |
| src/components/files/FolderBrowser.tsx | +271 lines (FolderListView + FolderListRow + 2 imports + 2 lifted helpers + branched folders block) |
| src/components/files/AssetCard.tsx | 4 className edits (z-20 + 3× pointer-events-none) |

## Acceptance Criteria — Task 1

- [x] `grep "viewMode === 'grid'\s*\?"` → 1 match (folders block branch)
- [x] `grep "FolderListView"` → 5 matches (≥2 required)
- [x] `grep "FolderListRow"` → 6 matches (≥2 required)
- [x] `grep "ctxMenu\.open(\`folder-\${folder\.id}\`"` → 2 matches (grid + list)
- [x] `grep "buildFileBrowserActions('folder'"` → 2 matches (grid FolderCard + FolderListRow)
- [x] `grep "suppressNextClickRef"` → 10 matches (grid + list + setter + clear each)
- [x] `grep "grid grid-cols-2 sm:grid-cols-3"` → 1 match (grid-mode folder grid preserved)
- [x] `npx tsc --noEmit` — clean
- [x] `npm run lint -- --file src/components/files/FolderBrowser.tsx` — only two pre-existing warnings (`handleOpenMoveModal` useCallback dep at line 517, FolderCard preview `<img>` at line 1741), neither touched by this plan

## Acceptance Criteria — Task 2

- [x] `grep "absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100"` → 1 match
- [x] `grep "absolute inset-0 z-\[1\] bg-black pointer-events-none"` → 1 match
- [x] `grep "h-\[3px\] bg-black/40 z-\[2\] pointer-events-none"` → 1 match
- [x] `grep "bottom-1 right-1 z-\[2\].+pointer-events-none"` → 1 match
- [x] `grep "onMouseMove={asset\.type === 'video' && isHovering && spriteLoaded \? handleHoverScrub"` → 1 match (parent scrub handler preserved)
- [x] `npx tsc --noEmit` — clean
- [x] `npm run lint -- --file src/components/files/AssetCard.tsx` — no warnings or errors

## Verification Results

- **`npx tsc --noEmit`** — no output (clean)
- **`npm test`** — 171/171 passed (7 test files, 1.95s)
- **`npm run lint`** — 0 new warnings; 2 pre-existing warnings in FolderBrowser.tsx untouched

## Deviations from Plan

**1. [Rule 3 — Missing Imports] Added `InlineRename` + `formatRelativeTime` imports**
- **Found during:** Task 1 (writing FolderListRow)
- **Issue:** Plan step 6 claimed "no new dependencies — all icons already imported". True for icons, but `InlineRename` and `formatRelativeTime` were NOT imported. Without them the new FolderListRow wouldn't compile.
- **Fix:** Added both to the import block (`formatRelativeTime` alongside `formatBytes` from `@/lib/utils`; `InlineRename` from `@/components/ui/InlineRename`).
- **Files modified:** src/components/files/FolderBrowser.tsx (imports only)

Nothing else diverged — plan executed exactly as written.

## Edge Cases Handled

- **Firestore REST vs client SDK timestamp shapes** — `FolderListRow` uses the same `typeof folder.createdAt?.toDate === 'function' ? … : new Date((… as any)?._seconds * 1000 || Date.now())` fallback as `AssetListRow`, so folder rows format correctly regardless of which fetch path loaded them.
- **CTX-05 synthetic click suppression** — ported verbatim from FolderCard (`suppressNextClickRef` + `onMouseDown button=2 preventDefault` + 300ms clear) so right-click on a list row behaves identically to right-click on a grid card.
- **Drop-target visual** — list rows get `ring-2 ring-inset ring-frame-accent bg-frame-accent/10` (ring-inset avoids bleeding into adjacent row borders); grid cards use `ring-2 ring-frame-accent` (no inset) because they have rounded corners. Both reach visual parity for "this is a drop zone".
- **Three-dots click isolation** — wrapped the `<Dropdown>` in `<div onClick={(e) => e.stopPropagation()}>` inside the `<td>` so opening the menu doesn't propagate to the row `onClick` navigation.

## Self-Check: PASSED

- FOUND: src/components/files/FolderBrowser.tsx
- FOUND: src/components/files/AssetCard.tsx
- FOUND: .planning/phases/71-grid-view-affordances/71-01-SUMMARY.md
- Tests: 171/171 PASS
- tsc: clean
