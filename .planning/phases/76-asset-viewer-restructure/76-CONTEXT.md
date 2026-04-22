# Phase 76: asset-viewer-restructure - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Heavy modals dynamic-import on demand, comments feel instant via optimistic updates, annotation overlay lifecycle is clean, version compare toggles without dangling resources.

Requirements in scope: PERF-18, PERF-19, PERF-20, PERF-21.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Audit + CONTEXT point to concrete files.

</decisions>

<code_context>
## Existing Code Insights

**PERF-18 — dynamic-import heavy modals**

Modals that are bundled into parent routes but only open on user action:
- `ExportModal` (src/components/viewer/ExportModal.tsx, ~420 lines) — imported by asset viewer
- `AssetCompareModal` (~440 lines) — imported by FolderBrowser
- `VersionStackModal` (~251 lines) — imported by AssetCard
- `CreateReviewLinkModal` (~200 lines) — imported by review-links pages
- `UserDrawer` — imported by admin page

Use `next/dynamic(() => import('...'), { ssr: false, loading: () => <Skeleton /> })`. Grep for each static import, replace with dynamic. The `Skeleton` primitive from Phase 75 can power the `loading` prop.

Scout: prior milestone v1.9 established Modal a11y (focus trap, escape). The dynamic-import wrapper must not break those. `next/dynamic` returns a component that renders the imported component when resolved — a11y works transparently.

**PERF-19 — optimistic comment add**

`src/hooks/useComments.ts` — `addComment()` currently:
1. Fires POST
2. `await fetchComments()` on success — full thread refetch
3. Returns

Fix pattern (from audit):
```ts
const addComment = async (commentData, projectId) => {
  const tempId = `temp-${Date.now()}-${Math.random()}`;
  const optimistic = { ...commentData, id: tempId, createdAt: new Date() };
  setComments(prev => [...prev, optimistic]);
  try {
    const res = await fetch('/api/comments', { ... });
    if (!res.ok) throw new Error(...);
    const real = await res.json();
    setComments(prev => prev.map(c => c.id === tempId ? real : c));
  } catch (err) {
    setComments(prev => prev.filter(c => c.id !== tempId));
    throw err;
  }
};
```

Edge cases to handle:
- Reply to parent (threaded) — make sure parent relationship survives the reconciliation
- Temp comment shown with a subtle "sending..." indicator if possible (optional — skip if complicates scope)
- Error rollback surfaces an error toast (don't swallow)

Verify `useComments` signature compatible with all call sites (grep `addComment` usage).

**PERF-20 — AnnotationCanvas read-only cleanup + ExportModal deferred src**

- `src/components/viewer/AnnotationCanvas.tsx` currently mounts even when `displayShapes` is empty string or `'[]'`. Audit recommended: only render when `displayShapes && displayShapes !== '[]'`.
- `useEffect` cleanup: the Fabric dispose call should run in a dedicated cleanup so rapid comment-switching cleans up each canvas instance before mounting the next.
- `ExportModal` has a hidden `<video>` element used for preview scrubbing. Currently `src` is set eagerly. Change to `src={open ? previewUrl : undefined}` so the video only loads when the modal is open.

**PERF-21 — VersionComparison stable keys**

`src/components/viewer/VersionComparison.tsx` — dual VideoPlayer mount. Audit flagged that toggling compare ↔ single accumulates AnnotationCanvas + VUMeter instances because React re-uses DOM nodes when keys aren't explicit.

Fix: use stable keys `key={compare-A-${assetA.id}}` / `key={compare-B-${assetB.id}}` on the two `<VideoPlayer>` instances inside compare mode, and `key={displayAsset.id}` on the single-mode player. This forces React to cleanly unmount/remount each player on toggle, which runs the existing cleanup paths inside VideoPlayer (Fabric dispose, AudioContext close).

</code_context>

<specifics>
## Specific Ideas

- Four REQs → ideally 4 tasks in one plan. They touch different surfaces so minimal conflict:
  - Task 1 (PERF-18): 5 dynamic-import conversions across 5 files. Each is a ~3-line change.
  - Task 2 (PERF-19): `useComments` refactor, preserve public API.
  - Task 3 (PERF-20): AnnotationCanvas render guard + ExportModal deferred src.
  - Task 4 (PERF-21): VersionComparison key structure.
- PERF-19 is the riskiest — optimistic updates need careful rollback. Keep the implementation as close to the audit's recommended snippet as possible.
- Do NOT attempt an RSC split of `src/app/review/[token]/page.tsx` — that's a bigger architectural change and should go to a future milestone. The page is complex enough that a bad refactor would regress. Respect Phase 76 scope.
- For PERF-18's `next/dynamic` fallback, prefer a small `ModalSkeleton` that shows the scaffold (rounded rect) rather than `null` — otherwise the user sees a flash of nothing between click and modal-open.

</specifics>

<deferred>
## Deferred Ideas

- `/review/[token]` page RSC split (complex, multi-phase — out of v2.3 scope)
- FPS detection optimization on upload (out of v2.3 scope)

</deferred>
