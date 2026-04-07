# Architecture Patterns — v1.3 Video Review Polish

**Project:** readyset-review (Frame.io V4 clone)
**Researched:** 2026-04-07
**Milestone:** v1.3

---

## Existing Architecture Snapshot

```
src/
  app/(app)/
    projects/[projectId]/
      page.tsx                    ← FolderBrowser entry (grid/list view)
      folders/[folderId]/page.tsx ← same FolderBrowser with folderId
      assets/[assetId]/page.tsx   ← AssetViewerPage (single-page state machine)
  components/
    files/
      AssetCard.tsx               ← grid card; DnD source via onDragStart prop
      AssetGrid.tsx               ← thin wrapper, passes DnD callbacks to AssetCard
      AssetListView.tsx           ← list view; already has _commentCount badge
      FolderBrowser.tsx           ← DnD orchestrator (rubber-band, move, drop-on-folder)
    viewer/
      VideoPlayer.tsx             ← Video.js-less custom player; timecode, safe zones
      SafeZonesOverlay.tsx        ← renders a single <img> overlay (no opacity prop)
      SafeZoneSelector.tsx        ← dropdown to pick active safe zone
      CommentSidebar.tsx          ← single-tab panel; comments only
      VersionSwitcher.tsx         ← header pill for switching versions
      VersionComparison.tsx       ← existing side-by-side component (versions only)
  app/api/assets/
    route.ts                      ← GET: list assets, inlines _commentCount, _versionCount
    [assetId]/route.ts            ← GET/PUT/DELETE single asset + versions array
    copy/route.ts                 ← POST: duplicate or copy-to-folder
    size/route.ts                 ← GET: folder size in bytes
```

### Key data patterns

- **Version stack** — assets share `versionGroupId` (= root asset ID). The grid list endpoint groups by `versionGroupId` and returns only the latest version with `_versionCount` injected.
- **Comment counts** — computed server-side in `GET /api/assets` by scanning `comments` collection filtered by `projectId`, then joined into `_commentCount` on each asset. Already consumed by `AssetListView`. **Grid view does not currently display this badge.**
- **DnD move** — uses `application/x-frame-move` dataTransfer type carrying `{ ids: string[] }`. Only folder cards are drop targets today; asset cards are drag sources only.
- **Timecode** — `DEFAULT_FPS = 30` is hardcoded in `VideoPlayer.tsx`. SMPTE formatter uses this constant. `formatTimestamp` in `utils.ts` is just an alias for `formatDuration` (MM:SS only, no frame digits).
- **Safe zone** — `SafeZonesOverlay` takes no `opacity` prop; opacity is implicitly 1.
- **Asset metadata** — `Asset` type has `width`, `height`, `duration`, `size`, `mimeType` but **no codec, frameRate, or bitrate fields**. These are never stored or displayed anywhere.

---

## Feature Integration Analysis

### Feature 1: Version Stacking via Drag-and-Drop

**What it does:** Drop asset A onto asset B in the grid to absorb A into B's version stack.

**Current state:** DnD drop targets are folder cards (`handleFolderDrop` in `FolderBrowser.tsx`). Asset cards are drag sources but have no `onDragOver` / `onDrop` handlers. The existing `PUT /api/assets/[assetId]` accepts arbitrary field updates including `versionGroupId`.

**Integration approach:**

1. **Modified: `AssetCard.tsx`** — Add `onDragOver`, `onDragLeave`, `onDrop` props. When `application/x-frame-move` payload arrives and the drop target is a different asset card (not a folder), fire an `onDropAsset` callback instead of a folder-move callback. Visual: highlight border on drag-over (same pattern as `isDropTarget` on folder cards).

2. **Modified: `AssetGrid.tsx`** — Accept `onDropAssetOntoAsset?: (sourceId: string, targetId: string) => void` prop. Wire it through to each `AssetCard`.

3. **Modified: `FolderBrowser.tsx`** — Implement `handleAssetDrop(targetAssetId, e)`. Logic:
   - Read `application/x-frame-move` payload (`ids`).
   - Filter to the source asset ID (single item — version stacking with multiple sources is ambiguous; reject or take first).
   - Guard: source and target must not already share the same `versionGroupId`.
   - Call `PUT /api/assets/[sourceId]` with `{ versionGroupId: targetGroupId }`. **No new API route needed** — the existing PUT already accepts field updates.
   - After success, call `refetchAssets()`.

4. **New API endpoint: `POST /api/assets/merge-version`** — Preferred over raw PUT for correctness. A merge must also update `versionGroupId` on all assets in the source's existing group, reassign `version` numbers to avoid collisions, and optionally delete or re-parent. A raw PUT on a single asset would leave sibling versions orphaned with the old `versionGroupId`. The dedicated endpoint handles the batch atomically via Firestore batch write.

   ```
   POST /api/assets/merge-version
   Body: { sourceId: string, targetId: string }
   Logic:
     1. Fetch source and all its group siblings (versionGroupId == source.versionGroupId)
     2. Fetch target's versionGroupId (the authoritative group to join)
     3. Compute next version numbers (max existing version in target group + 1, +2, ...)
     4. Batch update: set all source group members' versionGroupId = targetGroupId, version = new numbers
     5. Update target's _versionCount (or rely on server-computed value at read time)
   ```

**Self-drop guard:** In `AssetCard.onDrop`, skip if `dragPayload.ids.includes(asset.id)`.

**Same-group guard:** Check `asset.versionGroupId === source.versionGroupId` before firing callback.

---

### Feature 2: Asset Comparison (Side-by-Side)

**What it does:** Select 2+ assets in the grid then open a side-by-side comparison view.

**Current state:** `VersionComparison` already exists at `src/components/viewer/VersionComparison.tsx` — it renders two assets side-by-side. It is currently only accessible from the asset viewer when a version stack has 2+ versions. It is not reachable from the grid.

**Integration approach — no new route needed:**

The cleanest path is a modal overlay launched from `FolderBrowser` when 2+ items are selected:

1. **Modified: `FolderBrowser.tsx`** — When `selectedIds.size >= 2`, show a "Compare" button in the multi-select action bar. On click, open `<AssetCompareModal>`.

2. **New: `src/components/files/AssetCompareModal.tsx`** — Full-screen modal that accepts an array of `Asset` objects (already in scope in FolderBrowser via the `assets` array). Internally uses `VersionComparison` (or a refactored version of it) to show two panels side-by-side. If more than 2 are selected, the modal lets the user pick which two to compare (or defaults to the first two).

3. **VersionComparison reuse vs. duplication:** `VersionComparison` currently expects `assetA` and `assetB` props of type `Asset`. Reusing it directly inside `AssetCompareModal` works if the signed URLs are already available (they are — the grid API inlines `signedUrl` on each ready asset). No refetch needed for the modal. Check whether `VersionComparison` renders a `<video>` or calls back into `VideoPlayer` — if it has its own playback controls, it is already self-contained.

**Alternative (new route):** A dedicated route like `/projects/[projectId]/compare?a=id1&b=id2` is cleaner for deep-linking but requires passing signed URLs through the URL (not safe) or re-fetching. The modal approach avoids this.

---

### Feature 3: File Information Tab

**What it does:** New tab in the asset viewer sidebar showing fps, resolution, size, codec, duration.

**Current state:** `CommentSidebar` is a single-purpose panel with no tab mechanism. Its interface takes `asset` and surfaces comment-related UI only.

**Integration approach:**

1. **Modified: `src/app/(app)/projects/[projectId]/assets/[assetId]/page.tsx`** — Replace `<CommentSidebar>` with a tabbed sidebar wrapper. Add a tab state (`'comments' | 'info'`). Render tab header ("Comments" | "Info") above the panel, then conditionally render `CommentSidebar` or `FileInfoPanel`.

2. **New: `src/components/viewer/FileInfoPanel.tsx`** — Stateless display component. Props: `asset: Asset`. Displays:
   - Resolution: `asset.width` x `asset.height` (already stored)
   - Duration: formatted from `asset.duration` (already stored)
   - File size: formatted from `asset.size` (already stored)
   - MIME type: `asset.mimeType` (already stored)
   - Frame rate: **not stored** — requires schema change (see below)
   - Codec: **not stored** — requires schema change (see below)

3. **Schema change required for fps/codec:** The `Asset` type in `src/types/index.ts` has no `frameRate` or `codec` fields. These must be:
   - Added to the `Asset` interface: `frameRate?: number; codec?: string;`
   - Populated at upload time by the upload-complete handler (currently sets `width`, `height`, `duration`).
   - If the upload-complete endpoint does not extract these today, `FileInfoPanel` must gracefully show "—" for missing values rather than failing.

   **Confidence on current extraction:** The codebase has no `codec` or `frameRate` in any API or type definition (verified by grep). This is a gap. Displaying only the already-stored fields (resolution, size, duration, mimeType) is safe for MVP; fps/codec can be deferred or added in a follow-up.

4. **No new API route needed.** All displayable data is returned by the existing `GET /api/assets/[assetId]` response (via `useAsset` hook).

---

### Feature 4: Safe Zones Opacity Slider

**What it does:** Add an opacity control to the safe zones overlay.

**Current state:** `SafeZonesOverlay` renders a single `<img>` with hardcoded `opacity: 1` (via `objectFit: fill` style, no opacity). `SafeZoneSelector` is the dropdown that sets `activeSafeZone` state in `VideoPlayer`. The active safe zone and the overlay are both local state inside `VideoPlayer`.

**Integration approach — minimal, self-contained:**

1. **Modified: `SafeZonesOverlay.tsx`** — Add `opacity?: number` prop. Apply as `style={{ opacity: opacity ?? 1, ... }}` on the `<img>` element.

2. **Modified: `VideoPlayer.tsx`** — Add `safeZoneOpacity` state (default `0.8` or `1`). Pass it to `SafeZonesOverlay`. Render an opacity slider in the controls bar adjacent to `SafeZoneSelector` — visible only when `activeSafeZone` is non-null.

   Slider placement: right side of the controls row, immediately after `<SafeZoneSelector>`. A 60px `<input type="range" min={0} max={1} step={0.05}>` with the same styling as the existing volume slider.

**No new components, no new API routes.**

---

### Feature 5: Comment Count Badge on AssetCard (Grid View)

**What it does:** Show the comment count on each card in grid view, matching the existing badge in list view.

**Current state:** The `GET /api/assets` route already injects `_commentCount` on each asset object. `AssetListView` already renders this count (`(asset as any)._commentCount ?? 0`). `AssetCard.tsx` never reads `_commentCount`.

**Integration approach — trivial modification:**

1. **Modified: `AssetCard.tsx`** — In the `<div className="p-3">` info section, add a comment count badge. Read `(asset as any)._commentCount as number | undefined`. Render a `MessageSquare` icon + count when `_commentCount > 0`. Position: bottom-right of the info strip, alongside the existing "N versions" text.

   ```tsx
   // In the info div, after versionCount display:
   {commentCount > 0 && (
     <span className="flex items-center gap-0.5 text-xs text-frame-textMuted">
       <MessageSquare className="w-3 h-3" />
       {commentCount}
     </span>
   )}
   ```

2. **No changes to API, hooks, or types.** `_commentCount` is already on the wire; it is already typed as optional on `Asset` (`_commentCount?: number` in `src/types/index.ts`).

**Data freshness:** Count is computed at page load (server-side in the list endpoint). It is not real-time — consistent with the list view behavior. Acceptable for a grid badge.

---

### Feature 6: Timecode Frame Mode Bug Fix

**What it does:** Fix the SMPTE timecode display not updating correctly when stepping frame-by-frame.

**Root cause (inferred from code):** `formatSMPTE` in `VideoPlayer.tsx` uses `DEFAULT_FPS = 30` (hardcoded). The `currentTime` state is updated inside a `requestAnimationFrame` loop with a 0.25s threshold (`TIME_THRESHOLD`). When `stepFrame` increments by `1 / DEFAULT_FPS` (~33ms), this change is **smaller than the 0.25s threshold**, so `setCurrentTime` is never called unless `scrubbing` is true. The timecode display does not update after single-frame steps.

**Fix:** The rAF loop must bypass the threshold when the video is paused and a frame step just occurred. Two approaches:

**Option A (cleanest):** In `stepFrame()`, after setting `videoRef.current.currentTime`, also call `setCurrentTime(videoRef.current.currentTime)` and `onTimeUpdate?.(videoRef.current.currentTime)` directly. The rAF loop already polls continuously; the redundant call is harmless and guarantees the UI is immediately updated without waiting for the next tick to cross the threshold.

**Option B:** Add a `stepping` ref similar to `scrubbing`. When `stepping === true`, the rAF loop fires without threshold gating. Reset after one tick. More complex, less necessary.

**Recommended: Option A.** One-line fix in `stepFrame`:

```typescript
const stepFrame = (dir: 1 | -1) => {
  const v = videoRef.current;
  if (!v) return;
  onUserInteraction?.();
  v.pause(); setPlaying(false);
  v.currentTime = Math.max(0, Math.min(duration, v.currentTime + dir / DEFAULT_FPS));
  // Immediately sync display — threshold-based rAF loop misses sub-250ms changes
  setCurrentTime(v.currentTime);
  onTimeUpdate?.(v.currentTime);
};
```

**Files changed:** `VideoPlayer.tsx` only. No API, no types, no new components.

---

## Component Inventory: New vs Modified

| Component / File | Status | Notes |
|---|---|---|
| `AssetCard.tsx` | **Modified** | Add DnD drop target props + comment count badge |
| `AssetGrid.tsx` | **Modified** | Add `onDropAssetOntoAsset` prop; thread to cards |
| `FolderBrowser.tsx` | **Modified** | Add `handleAssetDrop` callback; wire "Compare" button |
| `SafeZonesOverlay.tsx` | **Modified** | Add `opacity` prop |
| `VideoPlayer.tsx` | **Modified** | Safe zone opacity state + slider; `stepFrame` fix |
| `CommentSidebar.tsx` | **Unchanged** | Sidebar content is preserved as-is |
| `AssetViewerPage` (page.tsx) | **Modified** | Add tab switcher state + conditional sidebar render |
| `FileInfoPanel.tsx` | **New** | `src/components/viewer/FileInfoPanel.tsx` |
| `AssetCompareModal.tsx` | **New** | `src/components/files/AssetCompareModal.tsx` |
| `POST /api/assets/merge-version` | **New route** | Atomic version group merge via Firestore batch |
| `Asset` type (types/index.ts) | **Modified** | Add `frameRate?: number; codec?: string;` (optional, for future use) |

---

## New API Routes

| Route | Method | Purpose | Urgency |
|---|---|---|---|
| `/api/assets/merge-version` | POST | Atomically merge one version group into another: reassign `versionGroupId` + renumber `version` fields for all members of the source group | Required for version-stack DnD |

No other new API routes are needed. All other features read or mutate through existing endpoints.

---

## Data Flow: Comment Count

```
Page load
  → GET /api/assets?projectId=X&folderId=Y
  → Server scans comments collection (projectId == X)
  → Builds commentCountMap keyed by assetId
  → Injects asset._commentCount for each grouped asset
  → JSON response to client
  → useAssets hook stores in local state
  → AssetCard reads (asset as any)._commentCount  ← NEW
  → AssetListView reads (asset as any)._commentCount  ← existing
```

This is a static count at list time. It does not update when new comments arrive without a page reload or explicit refetch. This is the same behavior as the list view. Real-time counts would require a Firestore listener per-asset in the grid, which is expensive; static is the right call here.

---

## Build Order (Dependency-Driven)

**Phase order recommendation:**

1. **Timecode frame bug fix** — Zero dependencies, zero risk, isolated to `VideoPlayer.tsx`. Ship first to unblock QA on other player features.

2. **Safe zones opacity slider** — Isolated to `SafeZonesOverlay.tsx` + `VideoPlayer.tsx`. No new components. Can be done in the same session as the timecode fix.

3. **Comment count on AssetCard** — One-line read from an already-available field. No API changes. Completely independent of everything else.

4. **File information tab** — Requires: (a) adding tab state to `AssetViewerPage`, (b) creating `FileInfoPanel`. Independent of grid features. Should be done before the grid features since it modifies `page.tsx` which the comparison feature might also touch.

5. **Asset comparison modal** — Requires: `AssetCompareModal` (new), `FolderBrowser` multi-select action bar update. `VersionComparison` already exists. No API changes. Does not block version-stack DnD.

6. **Version stacking via DnD** — Most complex. Requires: `AssetCard` drop handling, `AssetGrid` prop threading, `FolderBrowser` orchestration, and the new `POST /api/assets/merge-version` route. Build the API route first, test it, then wire up the UI.

**Rationale for ordering:**
- Bug fixes first — no risk, immediate value.
- Read-only UI changes (comment badge, file info, opacity) before write operations (merge-version).
- Comparison modal before version stacking — both touch `FolderBrowser` but comparison is read-only; having it working makes it easier to visually verify that version stacking produces the right result.
- Version stacking last because it has the only new API route and the highest data-integrity risk (renumbering version fields).

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Raw PUT for Version Group Merge
**What it is:** Calling `PUT /api/assets/[sourceId]` with `{ versionGroupId: targetGroupId }` directly from the client to perform a version merge.
**Why it's bad:** A version stack can have multiple members. A single-asset PUT leaves sibling assets in the source group with a stale `versionGroupId`. The grid then shows orphaned version groups or incorrect `_versionCount` badges.
**Instead:** Use the dedicated `POST /api/assets/merge-version` endpoint that batch-updates all group members atomically.

### Anti-Pattern 2: Real-Time Firestore Listener for Comment Counts in Grid
**What it is:** Adding `onSnapshot` listeners on the `comments` collection inside `AssetCard` or `AssetGrid` to keep counts live.
**Why it's bad:** A grid with 40 assets would open 40 concurrent Firestore listeners. This hits billing limits, slows initial render, and is architecturally inconsistent with the rest of the app.
**Instead:** Use the server-computed `_commentCount` from the list API. Accept eventual consistency; counts update on next page load or manual refetch.

### Anti-Pattern 3: New Comparison Route with URL-Encoded Signed URLs
**What it is:** Creating `/projects/[projectId]/compare?a=id1&b=id2` and re-fetching signed URLs server-side.
**Why it's bad:** Signed URLs are time-limited (120s). A comparison route that re-fetches on navigate works, but is slower and adds latency vs. the modal approach which reuses already-fetched assets.
**Instead:** Use a client-side modal that receives the `Asset` objects (including their cached `signedUrl`) directly from the parent grid state.

### Anti-Pattern 4: Hardcoding FPS in File Info Panel
**What it is:** Displaying `30 fps` as the frame rate in `FileInfoPanel` when no `frameRate` field exists in Firestore.
**Why it's bad:** Misleads users reviewing 24fps film or 60fps content.
**Instead:** Show `—` when `frameRate` is absent. Log a TODO to extract fps at upload time.

---

## Scalability Considerations

| Concern | Current scale | Implication |
|---|---|---|
| Comment count scan | Scans all comments for a project on every grid load | Fine at <10K comments; add Firestore index or denormalized counter if counts exceed that |
| Version merge batch | Touches N docs in one Firestore batch | Batches are capped at 500 writes; version stacks are never that large — no concern |
| Comparison modal assets | Two `<video>` elements simultaneously | Two concurrent signed URL streams; modern browsers handle this without issue |
| Safe zone overlay | One `<img>` per active zone | Negligible |

---

## Sources

- Code read directly: `src/app/(app)/projects/[projectId]/assets/[assetId]/page.tsx`, `src/components/files/AssetCard.tsx`, `src/components/files/AssetGrid.tsx`, `src/components/files/FolderBrowser.tsx`, `src/components/viewer/VideoPlayer.tsx`, `src/components/viewer/SafeZonesOverlay.tsx`, `src/components/viewer/CommentSidebar.tsx`, `src/app/api/assets/route.ts`, `src/app/api/assets/[assetId]/route.ts`, `src/types/index.ts`
- Pattern: Firestore batch write limit = 500 operations (Firestore documentation, HIGH confidence)
- Pattern: `requestAnimationFrame` threshold gating causing sub-threshold updates to be dropped (inferred from code, HIGH confidence — bug is directly visible in `stepFrame` vs rAF loop logic)
