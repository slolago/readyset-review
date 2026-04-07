# Phase 12: download-and-polish - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning
**Source:** User decisions (conversation)

<domain>
## Phase Boundary

Seven UX / performance improvements across the file browser and review links:

1. **Bulk download** — when ≥1 asset is selected, a Download button appears in the selection action bar; clicking it downloads all selected files to the user's machine.
2. **Select-all toggle** — the header checkbox in list view currently only selects all; a second click must deselect all (toggle behaviour). Works in both grid and list view.
3. **"Download all" in canvas right-click** — the empty-canvas context menu gains a "Download all" item that downloads every asset in the current folder.
4. **Right-click menu dismiss fix** — clicking anywhere outside an open `ContextMenu` must close it immediately. Currently the menu stays open (event listener not firing).
5. **Checkbox styling** — checkboxes throughout the app (list view rows, select-all header) get a custom design consistent with the dark theme: `frame-accent` (`#7a00df`) border + fill on checked state, no browser default appearance.
6. **Download from three-dot menu + review links** — the Phase 11 "Download" item in the three-dot/MoreHorizontal dropdown on asset cards should work (trigger a real file download). The review page (`/review/[token]`) should also have a download button per asset when `allowDownloads` is true.
7. **Performance** — reduce redundant Firestore reads, memoize expensive renders, lazy-load non-critical components; target: folder navigation feels instant after first load.

</domain>

<decisions>
## Implementation Decisions

### Bulk Download
- Selection state (`selectedIds`) already lives in `FolderBrowser`
- When `selectedIds.size > 0`, show a floating action bar or inline toolbar with a "Download X files" button
- Each file download: fetch the asset's signed URL from Firestore/GCS (already available as `asset.url`) and trigger via `<a download href={url}>` click or `window.open(url)`
- For multiple files: iterate and trigger each download sequentially with a short delay (browsers throttle simultaneous downloads)
- No zip bundling — individual file downloads only (simpler, no server-side work)

### Select-All Toggle
- The existing header checkbox calls `onSelectAll(allIds)` when unchecked
- Add logic: if all items are already selected, `onSelectAll([])` instead (deselect all)
- The `indeterminate` state should still work: if some (not all) are selected → indeterminate; if all → checked; if none → unchecked
- This requires knowing whether all items are currently selected — pass `allSelected` boolean to the component

### Download All (Canvas Context Menu)
- Add "Download all" to the canvas `ContextMenu` items array in `FolderBrowser`
- Handler: iterate over all assets in current folder (already in `assets` state) and trigger individual downloads

### Right-Click Menu Dismiss Fix
- Root cause: `ContextMenu` adds a `mousedown` listener to `document` to detect outside clicks, but the listener is being removed before it fires (cleanup race), OR it isn't being added at all
- Fix: ensure the `useEffect` in `ContextMenu.tsx` adds the document listener *after* the current event loop tick (use `setTimeout(..., 0)` or add the listener in `useEffect` without the race)
- Also add: `window.addEventListener('scroll', onClose)` and `window.addEventListener('blur', onClose)` for robustness
- Escape key listener already planned — verify it's wired

### Checkbox Styling
- Remove browser default with `appearance-none` (Tailwind)
- Custom styles on the `<input type="checkbox">`:
  - Unchecked: `w-4 h-4 rounded border border-white/30 bg-transparent`
  - Checked: `bg-[#7a00df] border-[#7a00df]` + a white checkmark via `bg-[url(...)]` or pseudo-element
  - Use Tailwind's `checked:` variants
  - Apply consistently in `AssetListView.tsx` row checkboxes and select-all `<th>` checkbox
  - Also style any checkbox in grid view if applicable

### Download from Three-Dot Menu
- The "Download" item was wired in Phase 11 but may not have a real handler (may be `onClick: () => {}` stub)
- Implement: fetch `asset.url` (already on the asset object as signed URL or GCS URL) and trigger download anchor click
- For GCS signed URLs that don't include `Content-Disposition: attachment`, use `fetch(url).then(blob → createObjectURL → anchor.click())` to force download instead of opening in browser
- Same pattern for the review page download button

### Review Link Download Button
- On `/review/[token]/page.tsx`: when `reviewLink.allowDownloads === true`, show a download button per asset in the asset grid/list
- Button triggers same download flow as above
- If `allowDownloads === false`, no download button shown (consistent with existing behaviour)

### Performance
- Memoize `AssetGrid`, `AssetListView`, `FolderCard` with `React.memo` + `useCallback` for handlers
- Avoid re-fetching assets on every render — ensure `useEffect` deps are stable (no object literals inline)
- `useProjectTree`: deduplicate folder fetches; don't re-fetch already-loaded subtrees
- `FolderBrowser`: memoize sorted/filtered asset list with `useMemo`
- Avoid creating new function references on every render for `onSelect`, `onDelete`, etc.
- No major architectural changes — incremental memoization only

### Claude's Discretion
- Exact positioning of the Download action bar (floating overlay vs. top toolbar)
- Whether to show a progress indicator for multi-file downloads
- Specific performance targets (no hard latency numbers required)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### File Browser & Selection
- `src/components/files/FolderBrowser.tsx` — owns `selectedIds`, canvas context menu, asset list; bulk download action bar goes here
- `src/components/files/AssetListView.tsx` — header select-all checkbox + row checkboxes; styling goes here
- `src/components/files/AssetCard.tsx` — three-dot menu; "Download" handler fix here
- `src/components/files/AssetGrid.tsx` — grid view; checkbox styling if any

### Context Menu
- `src/components/ui/ContextMenu.tsx` — Phase 11 portal component; dismiss fix goes here

### Review Links
- `src/app/review/[token]/page.tsx` — review page; download button per asset when `allowDownloads` is true

### Styling Reference
- Tailwind config / `globals.css` — `frame-accent: #7a00df`, `frame-bg: #08080f`; existing `checked:` usage patterns
- `src/components/ui/Dropdown.tsx` — existing dropdown style; checkbox should match overall dark aesthetic

### Project State
- `.planning/STATE.md` — architecture decisions log
- `.planning/ROADMAP.md` — phase 12 goal and success criteria

</canonical_refs>

<specifics>
## Specific Ideas

From user conversation:
- Download must work from: selected items action bar, three-dot menu, right-click context menu, review links
- Select-all header checkbox: toggle — click once to select all, click again to deselect all
- "Download all" in empty-canvas right-click menu
- Checkboxes must visually match the dark app design (not browser default grey)
- Right-click menu currently stays frozen after click — fix outside-click dismiss

</specifics>

<deferred>
## Deferred Ideas

- Zip bundling for multi-file downloads (server-side complexity, not requested)
- Download progress bar / notification toast
- Download history / tracking
- Performance: code-splitting, Suspense boundaries (out of scope for incremental pass)

</deferred>

---

*Phase: 12-download-and-polish*
*Context gathered: 2026-04-07 via conversation*
