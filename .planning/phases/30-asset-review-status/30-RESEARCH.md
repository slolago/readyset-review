# Phase 30: asset-review-status - Research

**Researched:** 2026-04-08
**Domain:** Asset QC status — Firestore field, Next.js API route extension, React badge component, context menu + viewer wiring
**Confidence:** HIGH

## Summary

Phase 30 is a tightly scoped feature. The data model decision is already made in STATE.md: assets carry a `reviewStatus` field (not `status`, which is the upload lifecycle) with the enum `approved | needs_revision | in_review`, absent meaning pending (no badge shown). The existing `PUT /api/assets/[assetId]` route already accepts arbitrary field updates via `updates = await request.json()` — it will write `reviewStatus` with zero code change as long as the field is in the allow-list (currently it accepts any field except when `folderId` is present for the batch-move path). A dedicated `PATCH /api/assets/[assetId]/review-status` route is cleaner and more explicit, but not strictly necessary.

The two deliverables are: (1) a `ReviewStatusBadge` component that maps enum value → color + label, and (2) surfacing the setter in the `AssetCard` context menu / Dropdown and in the `CommentSidebar` (or the asset viewer header). The badge appears in the card's info row (below the asset name, alongside the comment count and version count) and in the viewer header or sidebar header.

Because the PUT route already works, the entire phase can be completed without touching Firestore indexes or introducing a new collection. The `Asset` type needs `reviewStatus?: 'approved' | 'needs_revision' | 'in_review'` added.

**Primary recommendation:** Add `reviewStatus` to the Asset type, add a set-status endpoint (or re-use PUT), build `ReviewStatusBadge`, add a "Set status" submenu or flyout to AssetCard's Dropdown/ContextMenu, and render the badge in AssetCard's info row and in the viewer header.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STATUS-01 | User can set a review status on an asset (approved / needs_revision / in_review) | Existing PUT `/api/assets/[assetId]` accepts field updates; context menu + Dropdown patterns established in AssetCard |
| STATUS-02 | Review status badge is displayed on asset grid cards and in the asset viewer | `Badge` component exists in `src/components/ui/Badge.tsx`; card info row and viewer header are the render sites |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 14 | API route (PUT extension or new PATCH route) | Project baseline |
| Firebase Admin SDK | — | Firestore single-doc update | Project baseline |
| React | 18 | Badge component + menu state | Project baseline |
| Tailwind CSS | 3 | Badge color tokens (green/yellow/blue from theme) | Project baseline |
| lucide-react | — | Status icons (CheckCircle2, AlertCircle, Clock) | Already imported in viewer components |

No new npm packages required for this phase.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing PUT route | New PATCH /api/assets/[assetId]/review-status | PATCH is more explicit and easier to test; PUT already works with no code change — PATCH preferred for clarity |
| Inline status colors | Badge.tsx variant extension | Extending Badge avoids duplicated color logic |

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── files/
│   │   └── AssetCard.tsx           # Add Set Status to Dropdown + ContextMenu; render badge
│   ├── viewer/
│   │   └── CommentSidebar.tsx OR asset viewer header  # Render badge; surface Set Status action
│   └── ui/
│       └── ReviewStatusBadge.tsx   # New component — pure display, no data fetch
├── app/api/assets/[assetId]/
│   └── route.ts                    # Extend PUT (or add PATCH branch) to accept reviewStatus
└── types/index.ts                  # Add reviewStatus?: ReviewStatus to Asset interface
```

### Pattern 1: ReviewStatus Type Addition

**What:** Add a union type alias and extend the Asset interface.
**When to use:** Always — the type guards all set/read paths.

```typescript
// src/types/index.ts
export type ReviewStatus = 'approved' | 'needs_revision' | 'in_review';

export interface Asset {
  // ... existing fields ...
  reviewStatus?: ReviewStatus;   // absent = pending, no badge shown
}
```

### Pattern 2: ReviewStatusBadge Component

**What:** Pure display component. Receives `status: ReviewStatus | undefined`. Returns null when undefined.
**When to use:** Everywhere the badge appears (AssetCard info row, viewer header).

```typescript
// src/components/ui/ReviewStatusBadge.tsx
import { cn } from '@/lib/utils';

const STATUS_META: Record<string, { label: string; className: string }> = {
  approved:       { label: 'Approved',       className: 'bg-frame-green/15 text-frame-green' },
  needs_revision: { label: 'Needs Revision', className: 'bg-yellow-500/15 text-yellow-400' },
  in_review:      { label: 'In Review',      className: 'bg-blue-500/15 text-blue-400' },
};

export function ReviewStatusBadge({ status }: { status?: string }) {
  if (!status || !STATUS_META[status]) return null;
  const { label, className } = STATUS_META[status];
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium', className)}>
      {label}
    </span>
  );
}
```

Color mapping uses existing Tailwind theme tokens: `frame-green` (#00d084), `yellow-400`, `blue-400`.

### Pattern 3: Set Status in AssetCard Dropdown + ContextMenu

**What:** Add a "Set status" group (or submenu) to the existing Dropdown items array and the ContextMenu items array.
**When to use:** The Dropdown and ContextMenu both already accept `DropdownItem[]` / `MenuItem[]` — append status items with a `divider: true` separator.

The Dropdown component does not support nested submenus natively. The simplest approach is to add three flat items in a divider-separated group:

```typescript
// In AssetCard, add to Dropdown items (and ContextMenu items):
{ label: 'Approved',       icon: <CheckCircle2 className="w-4 h-4 text-frame-green" />,  onClick: () => handleSetStatus('approved'),       divider: i === 0 },
{ label: 'Needs Revision', icon: <AlertCircle  className="w-4 h-4 text-yellow-400" />,   onClick: () => handleSetStatus('needs_revision') },
{ label: 'In Review',      icon: <Clock        className="w-4 h-4 text-blue-400" />,      onClick: () => handleSetStatus('in_review') },
```

The `handleSetStatus` function calls `PUT /api/assets/[assetId]` with `{ reviewStatus }`, then calls `onDeleted?.()` (the existing parent-refresh callback pattern, as used for Rename).

### Pattern 4: API Update — Extend PUT Route

**What:** The existing PUT handler in `/api/assets/[assetId]/route.ts` processes `updates = await request.json()`. Adding `reviewStatus` to an asset only requires that the body is `{ reviewStatus: 'approved' }`. The current code already calls `db.collection('assets').doc(params.assetId).update(updates)` for any non-`folderId` body. This means no code change is required in the route for the basic case.

However, the `folderId` branch only updates `folderId` on siblings — it should NOT spread `reviewStatus` to the entire version group. The current code for the folderId branch only applies `updates` to the primary asset and then only `{ folderId }` to siblings, so this is already safe.

**Recommendation:** No route changes needed for STATUS-01. Add a PATCH endpoint only if explicit separation is desired.

### Pattern 5: Badge in AssetCard Info Row

**What:** Render `<ReviewStatusBadge status={asset.reviewStatus} />` in the info row at the bottom of the card, consistent with where the comment count badge and version count are rendered.

Current info row structure (in the `<div className="p-3">` block):
```
Asset name
[size]     [comment count icon] [version count] [← add ReviewStatusBadge here]
```

Since the status badge is wider than the comment/version chips, it should go on a new line or replace the row to avoid overflow. The cleanest placement is a conditional second row:

```tsx
{asset.reviewStatus && (
  <div className="mt-1">
    <ReviewStatusBadge status={asset.reviewStatus} />
  </div>
)}
```

### Pattern 6: Badge in Asset Viewer

**What:** Render the badge in the viewer header, next to the asset name or beside the Share/Download buttons. The header is in `src/app/(app)/projects/[projectId]/assets/[assetId]/page.tsx`.

```tsx
// In the header flex row, after the asset name:
<ReviewStatusBadge status={displayAsset?.reviewStatus} />
```

The viewer also needs the Set Status action. The cleanest surface is a small dropdown in the header (similar to how Download is a header button), or a "Set status" section at the top of the CommentSidebar. Given the sidebar already has tabs (Comments / Info), adding it to the header is less intrusive.

### Anti-Patterns to Avoid

- **Writing reviewStatus to the entire version group:** Status is per-asset, not per-group. The PUT route's folderId branch batch-updates siblings — do not replicate this pattern for reviewStatus. Each version can have its own status independently.
- **Using the `status` field name:** `status` is already `'uploading' | 'ready'` (upload lifecycle). The field MUST be `reviewStatus`.
- **Conditional badge that shows for `status === 'uploading'`:** The upload overlay already handles the uploading state — do not conflate it with review status.
- **Storing display strings in Firestore:** Store enum keys (`approved`, `needs_revision`, `in_review`), not display labels. Map to labels in `ReviewStatusBadge`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color badge styling | Custom CSS classes per status | Tailwind utility classes with existing theme tokens | Consistent with Badge.tsx pattern; theme-aware |
| HTTP layer for status update | New fetch utility | Existing `getIdToken` + `fetch` pattern (matches rename, move, etc.) | Already battle-tested in AssetCard |
| Context menu rendering | Custom portal | Existing `ContextMenu` + `Dropdown` components | Already handle viewport-flip, outside-click, z-index |

## Common Pitfalls

### Pitfall 1: Status Bleeds to Version Group on Move

**What goes wrong:** If the developer copies the folderId batch-update pattern, setting reviewStatus on one asset accidentally updates all versions in the group.
**Why it happens:** The folderId PUT branch iterates siblings and applies updates to all of them.
**How to avoid:** Do not use the folderId batch path for reviewStatus. Write only to the single asset document.
**Warning signs:** Changing status on V1 also changes V2 and V3.

### Pitfall 2: Badge Renders on Uploading Assets

**What goes wrong:** `reviewStatus` is undefined on uploading assets, but if the condition is `asset.reviewStatus !== undefined`, it could still render for assets that somehow have a stale status.
**Why it happens:** Copied assets inherit all Firestore fields, including reviewStatus.
**How to avoid:** ReviewStatusBadge is intentionally unfiltered by upload status — this is correct behavior. A copied asset keeping its reviewStatus is valid. Document this explicitly.

### Pitfall 3: Viewer Uses Stale reviewStatus After Update

**What goes wrong:** User sets status from the grid card, then opens the viewer — the viewer shows the old status because it fetches asset independently via `useAsset(assetId)`.
**Why it happens:** The grid and viewer load data independently.
**How to avoid:** If setting status from inside the viewer, call the API and update local state immediately (`setActiveVersion({ ...activeVersion, reviewStatus: newStatus })`). Grid refresh on return is handled by the existing `onDeleted?.()` refresh pattern.

### Pitfall 4: `needs_revision` Label Display

**What goes wrong:** Storing `needs_revision` but displaying it as a raw string ("needs_revision") somewhere in the UI.
**Why it happens:** Forgetting to run the value through `ReviewStatusBadge` or the STATUS_META map.
**How to avoid:** Always use `ReviewStatusBadge` for display. Never render `asset.reviewStatus` directly as text.

## Code Examples

### Setting reviewStatus via existing PUT endpoint

```typescript
// In AssetCard handleSetStatus:
const handleSetStatus = async (reviewStatus: ReviewStatus | null) => {
  try {
    const token = await getIdToken();
    const res = await fetch(`/api/assets/${asset.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reviewStatus }),
    });
    if (res.ok) {
      toast.success(reviewStatus ? 'Status updated' : 'Status cleared');
      onDeleted?.();  // trigger parent grid refresh (existing pattern)
    } else {
      toast.error('Failed to update status');
    }
  } catch {
    toast.error('Failed to update status');
  }
};
```

### Null/clear status

Include a "Clear status" item in the menu group (sets `reviewStatus` to `null` or deletes the field). Firestore `update({ reviewStatus: deleteField() })` is cleaner than storing `null`. In the API route, when `updates.reviewStatus === null`, use `FieldValue.delete()` instead of writing `null`.

```typescript
// In PUT handler, add field-delete guard:
import { FieldValue } from 'firebase-admin/firestore';

const safeUpdates: Record<string, unknown> = {};
for (const [k, v] of Object.entries(updates)) {
  safeUpdates[k] = v === null ? FieldValue.delete() : v;
}
await db.collection('assets').doc(params.assetId).update(safeUpdates);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-asset `status` for lifecycle | Separate `reviewStatus` for QC | Decided in STATE.md v1.4 | Avoids field collision |
| Inline style per badge | Tailwind utility classes with theme tokens | v1.3 patterns | Consistent dark-theme appearance |

## Open Questions

1. **Should setting status from the viewer update local React state immediately (optimistic), or wait for a full refetch?**
   - What we know: The grid uses a callback-based refresh (`onDeleted?.()` triggers parent refetch). The viewer uses `useAsset(assetId)` which is a one-time fetch.
   - What's unclear: Whether the viewer should optimistically update `activeVersion` state or re-run `useAsset`.
   - Recommendation: Optimistic update (`setActiveVersion({ ...activeVersion, reviewStatus })`). Avoids a full refetch round-trip and is consistent with the pattern used for comments.

2. **Clear status option in the menu?**
   - What we know: Requirements say "no badge" when status is absent. A user may want to remove a previously set status.
   - Recommendation: Add a "Clear status" item (uses `FieldValue.delete()`). Low cost, completes the UX.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this phase is code/config changes only; Firebase Admin SDK and Tailwind are already installed and confirmed working).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected (no test config found) |
| Config file | none — manual testing per HUMAN-UAT pattern |
| Quick run command | n/a |
| Full suite command | n/a |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STATUS-01 | Setting status via context menu persists after page refresh | manual | n/a | n/a — manual-only (browser interaction) |
| STATUS-02 | Colored badge appears on grid card and in viewer | manual | n/a | n/a — visual/render check |

### Wave 0 Gaps
None — project uses manual UAT verification pattern (consistent with phases 25–29; no automated test infrastructure exists).

## Sources

### Primary (HIGH confidence)
- `src/types/index.ts` — confirmed `Asset` interface lacks `reviewStatus`; `status` field is upload lifecycle only
- `src/components/files/AssetCard.tsx` — confirmed Dropdown + ContextMenu patterns, info row structure, `onDeleted` refresh callback
- `src/app/api/assets/[assetId]/route.ts` — confirmed PUT handler passes `updates` directly to Firestore; folderId batch path is separate
- `src/components/ui/Badge.tsx` — confirmed existing badge component and color variants
- `src/components/ui/ContextMenu.tsx` — confirmed MenuItem interface (label, icon, onClick, dividerBefore, danger)
- `src/components/ui/Dropdown.tsx` — confirmed DropdownItem interface (label, onClick, icon, danger, divider)
- `tailwind.config.ts` — confirmed color tokens: `frame-green`, `frame-yellow`, `frame-red`, standard `yellow-400`, `blue-400`
- `src/app/(app)/projects/[projectId]/assets/[assetId]/page.tsx` — confirmed viewer header structure and state shape
- `.planning/STATE.md` — confirmed locked decisions: field name is `reviewStatus`, enum is `approved | needs_revision | in_review`, absent = pending

### Secondary (MEDIUM confidence)
- Phase 25 pattern (comment count badge) as precedent for adding a badge to AssetCard info row
- Phase 29 pattern (move-to-folder) as precedent for context menu item → API call → `onDeleted?.()` refresh

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all confirmed from codebase
- Architecture: HIGH — patterns directly derived from existing AssetCard, Badge, and PUT route code
- Pitfalls: HIGH — derived from reading actual code paths (folderId batch logic, field naming)

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable codebase, no fast-moving dependencies)
