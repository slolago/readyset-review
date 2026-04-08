# Phase 29: move-to-folder - Research

**Researched:** 2026-04-08
**Domain:** Asset organization — context menu move, folder picker modal, Firestore batch update
**Confidence:** HIGH

## Summary

Phase 29 requires users to relocate assets between folders via a right-click context menu "Move to..." option. The key finding is that **almost all of the required code already exists** in the codebase from prior phases. The context menu item, folder picker modal, `handleRequestMoveItem` handler, `handleMoveSelected` function, and the Firestore batch-move API endpoint are all implemented and connected. Phase 29 is fundamentally a verification and gap-closing pass rather than a greenfield implementation.

The one area that needs confirmation is whether `handleRequestMoveItem` in `FolderBrowser` correctly distinguishes asset IDs from folder IDs when `selectedIds` is set to a single asset ID. Because `handleMoveSelected` filters `ids` by checking `assets.some(a => a.id === id)`, passing an asset ID will route through the asset PUT call correctly. The version-group batch move logic in the API is already implemented and tested (Phase 28 pattern).

**Primary recommendation:** Read and exercise the existing wiring. Add "Move to" to the Dropdown actions list in `AssetCard` (currently only in the context menu, not the `...` hover dropdown) and confirm the `handleRequestMoveItem` → `MoveModal` → `handleMoveSelected` pipeline produces the expected outcome end-to-end.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOVE-01 | User can use a "Move to..." context menu option to relocate an asset to another folder | Context menu item exists in AssetCard; folder picker modal exists in FolderBrowser; API handles version group batch move |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 14 | API routes + page components | Project baseline |
| Firebase Admin SDK | — | Firestore batch writes | Project baseline |
| React | 18 | Component state + memo | Project baseline |
| Tailwind CSS | 3 | Dark-theme styling | Project baseline |

No new npm packages required for this phase.

## Architecture Patterns

### Existing Move Flow (already implemented)

```
AssetCard (right-click)
  → onRequestMove() prop
    → FolderBrowser.handleRequestMoveItem(assetId)
      → setSelectedIds(new Set([assetId]))
      → handleOpenMoveModal()
        → GET /api/folders?projectId=...&all=true
        → setAllFolders(data.folders)
        → setShowMoveModal(true)

MoveModal (user picks destination)
  → onMove(targetFolderId)
    → FolderBrowser.handleMoveSelected(targetFolderId)
      → assetIds = selectedIds filtered by assets array
      → PUT /api/assets/:id { folderId: targetFolderId }  (per asset)
      → refetchAssets() + fetchFolders()

PUT /api/assets/[assetId]/route.ts
  → detects 'folderId' in updates
  → queries all assets where versionGroupId == groupId
  → Firestore batch: update all siblings + root asset with new folderId
```

### Key Components

**`src/components/files/AssetCard.tsx`**
- `onRequestMove` prop: `() => void` — called when "Move to" context menu item is clicked
- Context menu (line 432): `{ label: 'Move to', icon: <MoveIcon>, onClick: () => onRequestMove?.() }`
- `MoveIcon` already imported from lucide-react
- The Dropdown (hover `...` menu) does NOT currently include "Move to" — only the right-click context menu does. This is a gap to assess.

**`src/components/files/AssetGrid.tsx`**
- `onRequestMove?: (assetId: string) => void` prop — already wired through to `AssetCard`

**`src/components/files/AssetListView.tsx`**
- `onRequestMove?: (assetId: string) => void` prop
- Context menu at line 366: `{ label: 'Move to', ... onClick: () => onRequestMove?.(asset.id) }`

**`src/components/files/FolderBrowser.tsx`**
- `handleRequestMoveItem(itemId)`: sets `selectedIds` to single-item set, calls `handleOpenMoveModal()`
- `handleMoveSelected(targetFolderId)`: filters selected IDs into asset IDs vs folder IDs, issues PUT requests
- `MoveModal`: pre-built folder tree picker with indent, root option, current folder disabled
- Passes `onRequestMove={handleRequestMoveItem}` to both `AssetGrid` and `AssetListView`

**`src/app/api/assets/[assetId]/route.ts` PUT handler**
- When `'folderId' in updates`: fetches all siblings by `versionGroupId`, batch-updates all to new `folderId`
- Root asset (which may lack `versionGroupId`) is also updated via explicit `doc(params.assetId)` in the batch
- This satisfies success criterion 4 (version group members all move together)

### Recommended Project Structure
No new directories needed. All changes are within:
```
src/
├── components/files/
│   ├── AssetCard.tsx        # verify + possibly add to Dropdown menu
│   ├── AssetGrid.tsx        # no changes expected
│   ├── AssetListView.tsx    # no changes expected
│   └── FolderBrowser.tsx   # verify wiring; no structural changes expected
└── app/api/assets/
    └── [assetId]/route.ts   # verify batch-move logic; no changes expected
```

### Anti-Patterns to Avoid

- **Duplicate move logic in AssetCard:** `AssetCard` already has `showCopyToModal` + `allFolders` state for the Copy To flow. Do NOT add separate move state inside `AssetCard`. Keep move triggered via `onRequestMove` prop bubbling up to `FolderBrowser`, which owns `MoveModal` state. Keeping move state centralized in `FolderBrowser` is the existing pattern.
- **Calling `handleMoveSelected` with a folder ID as `assetId`:** `handleRequestMoveItem` sets `selectedIds` to a single item. `handleMoveSelected` partitions that set by checking `assets.some(a => a.id === id)`. If you trigger this for an asset, it will correctly route to the asset PUT path. Do not mix folder IDs and asset IDs in a single move invocation when coming from the asset context menu.
- **Forgetting to refetch after move:** `handleMoveSelected` calls `refetchAssets()` and `fetchFolders()` after success. The moved asset must disappear from the current view — this is handled by the refetch triggering a re-render with the updated Firestore data.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Folder tree picker | Custom recursive folder tree component | Existing `MoveModal` in FolderBrowser.tsx | Already built with indent, root option, disabled state for current folder |
| Batch Firestore move | Sequential individual updates | Existing batch in PUT `/api/assets/[assetId]` | Atomic, handles version group, already tested |
| Version group discovery | Manual query construction | Existing `versionGroupId` query in PUT handler | Edge case: root asset may lack `versionGroupId` — existing code handles this |

**Key insight:** The entire move pipeline was scaffolded in an earlier phase (drag-to-move infrastructure). Phase 29 reuses it entirely through the context menu trigger path.

## Common Pitfalls

### Pitfall 1: Dropdown (hover `...` menu) does not include "Move to"
**What goes wrong:** Users right-clicking see "Move to" but users using the hover `...` menu (Dropdown) do not. This inconsistency is a gap in AssetCard.
**Why it happens:** The Dropdown items list in AssetCard (lines 327–368) was not updated to include "Move to" when the context menu was set up.
**How to avoid:** Add a "Move to" item to the Dropdown items array in `AssetCard`, calling `onRequestMove?.()` — matching the context menu.
**Warning signs:** If Dropdown has "Copy to" and "Duplicate" but no "Move to", the gap is confirmed.

### Pitfall 2: `handleRequestMoveItem` is a `useCallback` with `handleOpenMoveModal` as dependency
**What goes wrong:** If `handleOpenMoveModal` is not itself stable (defined with `useCallback`), every render recreates `handleRequestMoveItem`, causing downstream re-renders.
**Why it happens:** `handleOpenMoveModal` is currently defined as a plain `async` function without `useCallback` (line 344). `handleRequestMoveItem` depends on it (line 358).
**How to avoid:** This is pre-existing and not a blocker for Phase 29 functionality. Only note it if performance issues arise.
**Warning signs:** Re-renders not caused by data changes.

### Pitfall 3: Moving an asset that is not the version group root
**What goes wrong:** If the user right-clicks a version (not the root asset displayed in the grid), and its `versionGroupId` points to a different asset ID, the batch query finds all siblings, but the explicit `doc(params.assetId)` update also runs. Both updates are idempotent since they set the same `folderId`.
**Why it happens:** The grid only ever shows group root assets (by design from Phase 28), so this case should not arise in practice. But the API handles it correctly anyway.
**How to avoid:** No action needed. Document as confirmed-safe.

### Pitfall 4: Moving into the current folder is allowed by the API
**What goes wrong:** The API will happily accept a `PUT` with `folderId` equal to the asset's current `folderId`. This is a no-op but causes an unnecessary refetch.
**Why it happens:** `MoveModal` disables the current folder in the UI for the `FolderBrowser.currentFolderId`, but `currentFolderId` is the folder being browsed, not the asset's `folderId`. Since both typically match, it effectively prevents the no-op.
**How to avoid:** No code change required. Existing UI guard is sufficient.

## Code Examples

### Context Menu "Move to" item (existing, AssetCard.tsx ~line 432)
```typescript
// Source: src/components/files/AssetCard.tsx
{ label: 'Move to', icon: <MoveIcon className="w-4 h-4" />, onClick: () => onRequestMove?.() },
```

### handleRequestMoveItem (existing, FolderBrowser.tsx ~line 356)
```typescript
// Source: src/components/files/FolderBrowser.tsx
const handleRequestMoveItem = useCallback(async (itemId: string) => {
  setSelectedIds(new Set([itemId]));
  await handleOpenMoveModal();
}, [handleOpenMoveModal]);
```

### handleMoveSelected — asset path (existing, FolderBrowser.tsx ~line 379)
```typescript
// Source: src/components/files/FolderBrowser.tsx
const assetIds = ids.filter((id) => assets.some((a) => a.id === id));
await Promise.all([
  ...assetIds.map((id) =>
    fetch(`/api/assets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ folderId: targetFolderId }),
    })
  ),
]);
```

### API batch-move for version group (existing, /api/assets/[assetId]/route.ts ~line 89)
```typescript
// Source: src/app/api/assets/[assetId]/route.ts
if ('folderId' in updates) {
  const groupId = asset.versionGroupId || params.assetId;
  const siblingsSnap = await db.collection('assets')
    .where('versionGroupId', '==', groupId)
    .get();
  const batch = db.batch();
  batch.update(db.collection('assets').doc(params.assetId), updates);
  for (const sib of siblingsSnap.docs) {
    if (sib.id !== params.assetId) {
      batch.update(sib.ref, { folderId: updates.folderId });
    }
  }
  await batch.commit();
}
```

### Adding "Move to" to Dropdown (gap to fill in AssetCard.tsx)
```typescript
// Pattern to follow — add after "Copy to" item in the Dropdown items array
{
  label: 'Move to',
  icon: <MoveIcon className="w-4 h-4" />,
  onClick: () => onRequestMove?.(),
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual sequential Firestore updates | Atomic Firestore batch for version group | Phase 28 | No partial state under concurrent moves |
| No version group move | Batch-move all siblings when folderId changes | Phase 28/API design | Success criterion 4 satisfied automatically |

## Open Questions

1. **Does "Move to" need to appear in the Dropdown (hover `...` menu) as well as the right-click context menu?**
   - What we know: Context menu has it; Dropdown does not.
   - What's unclear: Is the omission intentional or an oversight from when the feature was wired?
   - Recommendation: Add it to the Dropdown for consistency (same items in both menus is the pattern throughout the codebase).

2. **Should moving to the same folder be blocked at the UI level?**
   - What we know: MoveModal disables `currentFolderId` (the browsed folder) but not the asset's actual `folderId` if they differ.
   - What's unclear: Whether this matters in practice.
   - Recommendation: Not a blocker; existing behavior is adequate.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this phase is code/config-only changes using existing Firestore + Next.js infrastructure).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual browser testing (no automated test suite detected) |
| Config file | none |
| Quick run command | `npm run dev` then exercise in browser |
| Full suite command | `npm run build` (TypeScript compilation gate) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOVE-01 | Right-click asset → "Move to..." opens folder picker | manual | `npm run build` (TS check) | N/A |
| MOVE-01 | Confirm move → asset disappears from source folder | manual | `npm run build` | N/A |
| MOVE-01 | Asset appears in destination folder after move | manual | `npm run build` | N/A |
| MOVE-01 | Version group: all members move together | manual | `npm run build` | N/A |

### Sampling Rate
- **Per task commit:** `npm run build` — ensures no TypeScript errors
- **Phase gate:** Manual browser walkthrough of all 4 success criteria before `/gsd:verify-work`

### Wave 0 Gaps
None — no new test files required. TypeScript compilation (`npm run build`) is the automated gate.

## Sources

### Primary (HIGH confidence)
- Direct code read: `src/components/files/AssetCard.tsx` — full component including context menu wiring
- Direct code read: `src/components/files/AssetGrid.tsx` — prop interface confirms `onRequestMove` is wired
- Direct code read: `src/components/files/AssetListView.tsx` — confirms "Move to" in list context menu
- Direct code read: `src/components/files/FolderBrowser.tsx` — `handleRequestMoveItem`, `handleMoveSelected`, `MoveModal`
- Direct code read: `src/app/api/assets/[assetId]/route.ts` — batch-move implementation for version groups
- Direct code read: `src/types/index.ts` — `Asset.folderId: string | null`, `Asset.versionGroupId: string`

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` plan hint: "29-01: Verify + wire move-to context menu option" — confirms intent is verification-focused

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all code read directly from source
- Architecture: HIGH — existing pipeline traced end-to-end in source code
- Pitfalls: HIGH — gaps identified from direct code inspection (Dropdown missing "Move to")

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable codebase; no fast-moving external dependencies)
