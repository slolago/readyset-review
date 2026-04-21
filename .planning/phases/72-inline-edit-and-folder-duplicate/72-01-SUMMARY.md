---
phase: 72-inline-edit-and-folder-duplicate
plan: 01
subsystem: ui
tags: [react, inline-rename, context, file-browser, click-away]

requires:
  - phase: 57-inline-rename-primitive
    provides: <InlineRename> shared controlled input (Enter commits, Escape cancels)
  - phase: 53-rename-blur-no-commit
    provides: Blur-doesn't-commit behavior that Phase 72 preserves
provides:
  - Document-level pointerdown listener on <InlineRename> that cancels on click-away
  - RenameController context (activeId / setActiveId) exported from FolderBrowser
  - Single-active-rename invariant across FolderCard, FolderListRow, AssetCard, AssetListView row
affects: [future file-browser work, new rename surfaces, any cards added to FolderBrowser]

tech-stack:
  added: []
  patterns:
    - "Lifted singleton state via React context for mutually-exclusive UI modes"
    - "Module-level circular import (hook called at render time, not load time) — already used by useContextMenuController"

key-files:
  created: []
  modified:
    - src/components/ui/InlineRename.tsx
    - src/components/files/FolderBrowser.tsx
    - src/components/files/AssetCard.tsx
    - src/components/files/AssetListView.tsx

key-decisions:
  - "Use pointerdown (not click or focusout) so cancel fires before any sibling-card click handler"
  - "Key activeId as `${kind}-${id}` (folder-… / asset-…) so folder+asset with the same id cannot collide"
  - "Guard every close with `if (activeId === myRenameKey) setActiveId(null)` to prevent a stale-cancel race (unmounting card clobbering the new active rename)"
  - "Keep <InlineRename> prop shape unchanged — click-away is purely internal"
  - "Leave Check/X imports in FolderBrowser.tsx untouched — both are still used by selection badges, status menu, cancel upload button, and the CTX-05 cancel icon elsewhere in the file"
  - "Inline RenameProvider inside FolderBrowser rather than extracting to a new file — bundler handles the render-time-only cycle, same as useContextMenuController"

patterns-established:
  - "Singleton-across-browser: lift transient per-card mode (editing, opening, …) to a FolderBrowser-scoped context so the invariant is structurally enforced rather than manually coordinated"

requirements-completed: [EDIT-01]

duration: 4min
completed: 2026-04-21
---

# Phase 72 Plan 01: Inline rename click-away + single-active invariant — Summary

**Click-away on the inline rename input now cancels (not commits), and only one rename input can be open across the entire file browser at any time.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-21T21:13:45Z
- **Completed:** 2026-04-21T21:17:50Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `<InlineRename>` now self-cancels on `pointerdown` outside its container — covers grid/list + folder/asset in one change (all four surfaces consume the same primitive).
- `RenameController` context (`activeId`, `setActiveId`) exported from `FolderBrowser.tsx`; all four rename-capable cards derive `isRenaming` from it.
- Starting rename on a second card immediately unmounts the first one's input — drafts are discarded silently, original name preserved, no PUT fires for the abandoned edit.

## Task Commits

Each task was committed atomically:

1. **Task 1: InlineRename click-away cancel + FolderCard migration** — `e807854e` (feat)
2. **Task 2: RenameController context + wire all four surfaces** — `0aba2f75` (feat)

## Files Created/Modified

- `src/components/ui/InlineRename.tsx` — Added document-level `pointerdown` listener via `useEffect`; cancel fires when the click lands outside `containerRef`. Kept `onCancel` stable via a ref so the listener isn't re-attached on every parent render. No prop-shape change.
- `src/components/files/FolderBrowser.tsx` — Added `RenameController` context, `RenameProvider` wrapper inside `FolderBrowser`, exported `useRenameController`. Migrated FolderCard's hand-rolled rename input to `<InlineRename>` (deleted `renameValue` state, `renameInputRef`, the select-on-mount `setTimeout`, and the two hand-rolled buttons). Wired both `FolderCard` and `FolderListRow` to the controller with guarded `closeRename()` helpers.
- `src/components/files/AssetCard.tsx` — Imports `useRenameController` from `./FolderBrowser`; replaced local `isRenaming` state with controller-derived `isRenaming = activeId === myRenameKey`; `handleRename` now calls `setActiveId(myRenameKey)`; rename commit finally + `<InlineRename onCancel>` use `closeRename`.
- `src/components/files/AssetListView.tsx` — Same pattern as AssetCard for the list row.

## Decisions Made

### InlineRename click-away: `pointerdown` over `click` or `focusout`

- **`click`** would fire *after* the target card's own `onClick` handler, so the previous card's onClick (e.g. navigation to a folder) would run before the rename's cancel — wrong order.
- **`focusout`** is effectively blur, and Phase 53 explicitly rejected blur-commits. Cancelling on focusout also has the wrong semantic: pressing Tab inside the input shouldn't cancel.
- **`pointerdown`** fires on the first step of the interaction (before mouseup and before any click), which means the cancel is in flight before the sibling card's navigation runs. This mirrors the existing `statusMenuRef` outside-click pattern in AssetListView (which uses `mousedown` for the same reason); `pointerdown` is the unified successor that also handles touch + pen.

### Rename key shape: `${kind}-${id}`

Using just `folder.id` would collide with an asset that happens to share the id (Firestore ids are unique per collection, not globally). Kind-prefixing is cheap insurance and reads well in devtools.

### Stale-cancel guard

Without the guard:
1. User clicks rename on folder A — `activeId = 'folder-A'`.
2. User clicks rename on folder B — `activeId = 'folder-B'`. Folder A's card re-renders, `isRenaming = false`, its `<InlineRename>` unmounts.
3. If any path on the way out calls `setActiveId(null)` unconditionally, it clobbers folder B's just-opened active slot.

The guard `if (activeId === myRenameKey) setActiveId(null)` ensures only the currently-active card can close the slot. Added in all four call sites (FolderCard, FolderListRow, AssetCard, AssetListView row) as `closeRename()`.

### Circular import (inline vs extracted file)

`AssetCard` and `AssetListView` are imported by `FolderBrowser` (lines 9-10). Them importing `useRenameController` *from* `FolderBrowser` creates a cycle. This is fine because:
- The hook is only called at render time inside function bodies (not at module-load time).
- The codebase already does this with `useContextMenuController` (AssetCard imports it from `@/components/ui/ContextMenu`, which imports nothing back).
- TypeScript compiles cleanly; webpack/Node handle late-binding cycles correctly.

If a bundler regression ever appeared, extracting `RenameProvider` + `useRenameController` to `src/components/files/RenameController.tsx` would be a one-file refactor. YAGNI for now.

### Check / X import cleanup

After migrating FolderCard to `<InlineRename>`, the hand-rolled rename JSX no longer uses `Check` or `X` — but both are still used elsewhere in FolderBrowser.tsx (`Check` at lines 1383/1771/2078 for selection & status badges; `X` at lines 1424/2186/2244/2251 for cancel buttons on modals and the upload cancel icon). Imports kept as-is per CLAUDE.md §3 — only remove imports that *your* changes orphaned.

## Deviations from Plan

None — plan executed exactly as written. The plan's specified steps in Part B included a `setRenameValue(next)` line inside `onCommit` for FolderCard, but that's for a `renameValue` state that the same plan tells us to delete in the immediately following step; I followed the deletion step and passed `next` straight through to `commitFolderRename`. That's the plan's end state, not a deviation — just the order in which both were applied.

## Verification

- `npx tsc --noEmit`: clean (0 errors).
- `npm test`: 171 passed across 7 files (names, jobs, file-types, format-date, permissions, review-links, permissions-api). Matches the required 171+ baseline.
- No unused-import warnings introduced.
- `grep -n "setIsRenaming" src/components/` → 0 hits. All surfaces use the controller.

### Behavior matrix (all four surfaces, from the plan's success criteria)

| Surface              | Click-away cancels | Enter commits | Escape cancels | Blur does NOT commit | Opens singleton |
| -------------------- | ------------------ | ------------- | -------------- | -------------------- | --------------- |
| FolderCard (grid)    | yes (pointerdown)  | yes           | yes            | yes                  | yes             |
| FolderListRow (list) | yes                | yes           | yes            | yes                  | yes             |
| AssetCard (grid)     | yes                | yes           | yes            | yes                  | yes             |
| AssetListRow (list)  | yes                | yes           | yes            | yes                  | yes             |

## Known Stubs

None.

## Handoff Notes

- If a future phase adds a new rename surface inside the file browser, drop in `<InlineRename>` + `useRenameController()` and pick a unique key prefix (`link-${id}`, `version-${id}`, etc.) — the singleton will hold automatically.
- If a rename surface ever needs to live *outside* `FolderBrowser` (e.g. a top-level project rename in the sidebar), the current default context value is a no-op (`setActiveId: () => {}`). That surface would need its own `<RenameProvider>` wrapper or a separate controller — they won't participate in the FolderBrowser singleton, which is probably the right boundary.

## Self-Check: PASSED

- All 4 modified source files exist on disk.
- Both task commits present in `git log`: `e807854e`, `0aba2f75`.
- `npx tsc --noEmit` passes.
- `npm test` → 171 passed (matches baseline).
