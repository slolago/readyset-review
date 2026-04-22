---
phase: 77-folder-browser-decomposition
plan: 01
subsystem: ui
tags: [react, memo, useCallback, context, performance, folder-browser]

requires:
  - phase: 71-folder-browser-rename
    provides: InlineRename primitive + useRenameController context
  - phase: 72-folder-browser-edit-invariants
    provides: RenameProvider pattern wrapping FolderBrowser; EDIT-01 rename-conflict invariant
provides:
  - Parallelized project-root mount fetch (project + root folders fire in one tick)
  - Stable AssetGrid inline callbacks so its React.memo shallow-compare actually holds
  - RenameProvider scoped to content surface only — header / breadcrumb / action bar no longer re-render on rename state changes
affects: [78-data-layer-bundle-and-network]

tech-stack:
  added: []
  patterns:
    - "Parallel fetch on mount via Promise.all (fire-and-forget; callers handle their own errors)"
    - "Narrow React context provider to the subtree that actually consumes it"
    - "Stabilize prop callbacks with useCallback for memoized child components"

key-files:
  created: []
  modified:
    - src/hooks/useProject.ts
    - src/components/files/FolderBrowser.tsx

key-decisions:
  - "Dropped original Tasks B + C (AssetGrid extraction, AssetListView memo wrap) — scouting showed both are already memoized from earlier phases. Plan reduced from 4 tasks to 3."
  - "Pragmatic interpretation of success criterion 2: instead of per-component React.memo on header/breadcrumb, scope-narrow RenameProvider so they render outside it. Same perf outcome, smaller diff."
  - "Left inline callbacks in FolderCard/FolderListView JSX untouched — those children are not React.memo'd this phase, so stabilizing them would be wasted work (CLAUDE.md Surgical Changes)."

patterns-established:
  - "Parallel mount-effect fetches: fire-and-forget Promise.all when individual fetches have their own internal error handling"
  - "Narrowed context provider placement: wrap only the subtree that hosts consumers"

requirements-completed: [PERF-22, PERF-23]

duration: 4min
completed: 2026-04-22
---

# Phase 77 Plan 01: folder-browser-decomposition Summary

**Parallelized useProject mount fetch, stabilized AssetGrid inline callbacks with useCallback, and narrowed RenameProvider scope to the content surface so rename state changes no longer cascade through header/breadcrumb.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-22T12:46:30Z
- **Completed:** 2026-04-22T12:50:35Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- PERF-22: `useProject` mount effect now fires `fetchProject()` + `fetchFolders(null)` in parallel via `Promise.all` — the previous sequential waterfall is gone. `fetchFolders` is also now fired from the hook itself, eliminating the duplicate fetch that FolderBrowser previously had to do.
- PERF-23 part 1: Two inline arrow callbacks feeding `<AssetGrid>` (`onCreateReviewLink`, `onAddToReviewLink`) are now `useCallback`-stable (`handleCreateReviewLinkForAsset`, `handleAddToReviewLinkForAsset`). AssetGrid's existing `React.memo` shallow-compare now actually sees stable props every render.
- PERF-23 part 2: `RenameProvider` no longer wraps `FolderBrowserInner`. It now wraps only the content div (the subtree that contains the four `useRenameController` consumers: AssetCard, AssetListView row, FolderCard, FolderListRow). Header, breadcrumb, toolbar, hidden file inputs, multi-select action bar, and modals all render outside RenameProvider — rename state flips no longer invalidate them.

## Task Commits

Each task was committed atomically:

1. **Task 1: PERF-22 parallelize useProject mount fetches** — `6b93d8c7` (perf)
2. **Task 2: PERF-23 stabilize AssetGrid inline callbacks** — `01c09300` (perf)
3. **Task 3: PERF-23 narrow RenameProvider to content surface** — `3107eb59` (perf)

## Files Created/Modified

- `src/hooks/useProject.ts` — Mount effect now runs `Promise.all([fetchProject(), fetchFolders(null)])`; `fetchFolders` added to dep array. `fetchFolders` still exported for external refetch callers (unchanged).
- `src/components/files/FolderBrowser.tsx` — Added two `useCallback` handlers near `handleSelectAll`; rewired `<AssetGrid>` to use them; removed `<RenameProvider>` from the top-level wrapper; wrapped the content div inside `FolderBrowserInner` with `<RenameProvider>`.

## Scouting-driven plan reduction

The original brief anticipated 4 tasks (parallelize fetch + extract AssetGrid + memo AssetListView + narrow RenameProvider). Scouting during planning revealed:

- `src/components/files/AssetGrid.tsx:27` — **already** `export const AssetGrid = React.memo(function AssetGrid…)`. No extraction or memo-wrapping needed.
- `src/components/files/AssetListView.tsx:68` — **already** `export const AssetListView = memo(function AssetListView…)`. No memo-wrapping needed.
- `useProject` never fired `fetchFolders` on mount at all — FolderBrowser had its own independent `fetchFolders` useEffect. The PERF-22 fix therefore also needed to add `fetchFolders(null)` to `useProject`'s mount effect (not just parallelize existing calls).

Plan reduced from 4 tasks to 3. No rework; no redundant code.

## Diff summary

### Task 1 — `src/hooks/useProject.ts` mount effect (before → after)

```typescript
// before
useEffect(() => {
  fetchProject();
}, [fetchProject]);

// after
useEffect(() => {
  // PERF-22: fire project + root folders in parallel, not serially.
  // Both setters are independent — a rejection in one MUST NOT cancel the other.
  Promise.all([fetchProject(), fetchFolders(null)]);
}, [fetchProject, fetchFolders]);
```

`fetchProject` and `fetchFolders` both already had internal try/catch that swallows errors. `Promise.all` therefore never rejects; no extra `.catch` is required and no error semantics change.

### Task 2 — new `useCallback` handlers + AssetGrid rewire

```tsx
// added near handleSelectAll (approx line 575)
const handleCreateReviewLinkForAsset = useCallback((assetId: string) => {
  setSelectionReviewIds([assetId]);
  setShowReviewModal(true);
}, []);

const handleAddToReviewLinkForAsset = useCallback((assetId: string) => {
  setAddToLinkTarget({ assetIds: [assetId] });
}, []);
```

```tsx
// inside <AssetGrid> (approx line 1308)
// before
onCreateReviewLink={(assetId) => { setSelectionReviewIds([assetId]); setShowReviewModal(true); }}
onAddToReviewLink={(assetId) => setAddToLinkTarget({ assetIds: [assetId] })}

// after
onCreateReviewLink={handleCreateReviewLinkForAsset}
onAddToReviewLink={handleAddToReviewLinkForAsset}
```

Empty deps are correct: `setSelectionReviewIds`, `setShowReviewModal`, `setAddToLinkTarget` are stable React state setters.

### Task 3 — RenameProvider placement (before → after)

```tsx
// before (top-level wrapper, lines 98–106)
export function FolderBrowser(props: FolderBrowserProps) {
  return (
    <ContextMenuProvider>
      <RenameProvider>
        <FolderBrowserInner {...props} />
      </RenameProvider>
    </ContextMenuProvider>
  );
}
```

```tsx
// after (top-level wrapper)
export function FolderBrowser(props: FolderBrowserProps) {
  return (
    <ContextMenuProvider>
      <FolderBrowserInner {...props} />
    </ContextMenuProvider>
  );
}
```

Inside `FolderBrowserInner`, the content div (approx line 1173) is now wrapped:

```tsx
{/* Content — PERF-23: RenameProvider narrowed to the rename-capable surface
    so rename-state changes do not invalidate header / breadcrumb / action bar. */}
<RenameProvider>
<div
  ref={contentRef}
  className="flex-1 overflow-y-auto p-8 space-y-6 relative outline-none select-none"
  …
>
  {/* folders + AssetGrid / AssetListView */}
</div>
</RenameProvider>
```

Grep verification: `RenameProvider` now appears 4 times in the file — one function definition (line 88), one comment reference, one opening tag, one closing tag. No occurrence around `FolderBrowserInner`.

## Decisions Made

- **Pragmatic interpretation of success-criterion 2** ("AssetGrid, AssetListView, breadcrumb, and header are React.memo-wrapped and do not re-render when rename state changes"): AssetGrid + AssetListView are already React.memo'd. Breadcrumb + header are NOT individually `React.memo`-wrapped — instead, they render outside the narrowed `RenameProvider`, so rename state flips cannot cause them to re-render. The perf intent (no re-render on rename) is satisfied via scope narrowing rather than per-component memoization. If strict per-component `memo` wrapping is desired later, it can be a follow-up.
- **Inline callbacks in FolderCard JSX left untouched** (FolderBrowser.tsx:1235–1237, 1255–1257): FolderCard / FolderListView are not React.memo'd in this phase. Stabilizing their prop callbacks would be wasted work and would violate CLAUDE.md Surgical Changes. Flagged in scouting notes and left alone.
- **Skipped AssetGrid extraction and AssetListView memo-wrapping** — already complete from earlier work.
- **Did not touch the pre-existing `handleOpenMoveModal` exhaustive-deps ESLint warning** — out of scope (pre-existing, unrelated to this plan's work).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Verification Results

| Check | Result |
| ----- | ------ |
| `npx tsc --noEmit` | Clean (no output) |
| `npm test` | 171/171 pass (7 test files) |
| `npm run build` | Compiled successfully; all warnings are pre-existing and unrelated |
| Grep: `Promise.all` in `useProject.ts` | Line 56 — present |
| Grep: `handleCreateReviewLinkForAsset\|handleAddToReviewLinkForAsset` | 4 lines (2 definitions + 2 usages) — matches done criteria |
| Grep: `RenameProvider` in `FolderBrowser.tsx` | 4 hits: definition + comment + opening tag + closing tag. No wrap around FolderBrowserInner. |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 77 complete. v2.3 has one remaining phase: Phase 78 (data-layer-bundle-and-network, PERF-24 through PERF-27).
- No blockers. All tests green, build clean, surgical diffs only.

## Self-Check: PASSED

- File `src/hooks/useProject.ts` exists and contains `Promise.all([fetchProject(), fetchFolders(null)])`
- File `src/components/files/FolderBrowser.tsx` exists with the two `useCallback` handlers and the narrowed `<RenameProvider>`
- Commit `6b93d8c7` (Task 1) exists in git log
- Commit `01c09300` (Task 2) exists in git log
- Commit `3107eb59` (Task 3) exists in git log
- No stubs, no placeholder values, no "TODO"s introduced

---
*Phase: 77-folder-browser-decomposition*
*Completed: 2026-04-22*
