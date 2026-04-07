# Phase 14: review-link-folders - Research

**Researched:** 2026-04-07
**Domain:** Next.js App Router routing, React component re-use, review link data model
**Confidence:** HIGH

---

## Summary

Phase 14 adds a "Review Links" browsable section to each project. The existing codebase already has all the raw ingredients: review links stored in Firestore with `projectId`, `folderId`, `name`, and `createdAt`; the `ReviewLinksTab` component that lists them; and `AssetGrid`/`AssetListView` components that display assets. The work is purely plumbing — a new route, a new view component, and a sidebar entry.

The cleanest path is a **dedicated route** (`/projects/[projectId]/review-links` for the list, `/projects/[projectId]/review-links/[token]` for the asset view) rather than bolting a special mode onto `FolderBrowser`. `FolderBrowser` is already a 970-line component with upload, drag-and-drop, and multi-select that the read-only review-link view does not need. A separate, thin `ReviewLinkFolderBrowser` component re-uses `AssetGrid`/`AssetListView` without inheriting mutation logic.

The sidebar already has `ProjectTreeNav` which shows folders. It must be extended to optionally surface the new "Review Links" entry below folders when a project is expanded.

**Primary recommendation:** Add two new Next.js routes under `projects/[projectId]/review-links/`, build a `ReviewLinkFolderBrowser` component that re-uses `AssetGrid`/`AssetListView` with `hideActions`, extend `ProjectTreeNav` to show a "Review Links" leaf per project, and update the project root `page.tsx` tab to navigate to the new route instead of toggling an inline tab.

---

## Standard Stack

No new dependencies required. Everything needed is already in the project.

### Core (already installed)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Next.js App Router | 14 | Route-based navigation | `src/app/(app)/projects/[projectId]/` pattern already established |
| React | 18 | UI components | `useState`, `useEffect`, `useCallback` — same patterns as existing code |
| Lucide React | existing | Icons | `Link`, `FolderOpen`, `ChevronRight` already imported |
| Tailwind CSS | existing | Styling | `frame-*` design tokens already defined |

### Re-used internal components
| Component | Where used | Props to pass |
|-----------|-----------|---------------|
| `AssetGrid` | Review link asset view (grid mode) | `assets`, `projectId`, no `onAssetDeleted` etc. |
| `AssetListView` | Review link asset view (list mode) | `assets`, `projectId`, no `onRequestMove` etc. |
| `AssetCard` | Used by `AssetGrid` | Pass `hideActions={true}` to suppress mutations |
| `Breadcrumb` | Header of new view | Custom crumb items |
| `Spinner` | Loading state | — |

**Installation:** None required.

---

## Architecture Patterns

### Recommended Route Structure

```
src/app/(app)/projects/[projectId]/
├── page.tsx                          # existing — keep Files tab, add nav link to review-links
├── folders/[folderId]/page.tsx       # existing — unchanged
├── assets/[assetId]/page.tsx         # existing — unchanged
└── review-links/
    ├── page.tsx                      # NEW — ReviewLinkListPage (list of links as folder cards)
    └── [token]/
        └── page.tsx                  # NEW — ReviewLinkAssetPage (assets in one review link)
```

### Pattern 1: Two-Level Virtual Folder Navigation

**What:** Two Next.js routes model the two-level hierarchy: project-level list of review links, then per-link asset view.

**When to use:** Whenever the hierarchy has exactly two fixed levels with no recursion needed.

**Route 1 — list page** (`/projects/[projectId]/review-links`):
- Fetches `GET /api/review-links?projectId=...` (existing endpoint, authenticated)
- Renders each `ReviewLink` as a folder-like card with name + creation date
- Clicking navigates to `/projects/[projectId]/review-links/[token]`

**Route 2 — asset page** (`/projects/[projectId]/review-links/[token]`):
- Fetches `GET /api/review-links/[token]` (existing endpoint — returns `{ reviewLink, assets, folders, projectName }`)
- NOTE: This endpoint is currently unauthenticated (public review page logic). For the internal view we need to pass the user's auth token. The endpoint already handles an unauthenticated read (no password required for non-password-protected links). For authenticated internal viewing, the same endpoint works — it does not require auth, so internal users can call it directly.
- Renders `AssetGrid` or `AssetListView` with `hideActions={true}`
- Shows breadcrumb: Project > Review Links > [link name]

### Pattern 2: Sidebar Entry in ProjectTreeNav

**What:** Add a "Review Links" entry in `ProjectTreeNav` below the folders list for each project.

**When to use:** When a project is expanded in the sidebar, always show this leaf — it does not need its own expand toggle.

**Implementation:** After the `folders.map(...)` block in `ProjectTreeNav`, append a `Link` to `/projects/[project.id]/review-links`. Mark it active when `pathname.startsWith(projectPath + '/review-links')`.

```tsx
// Source: src/components/layout/ProjectTreeNav.tsx (current pattern)
<Link
  href={`/projects/${project.id}/review-links`}
  className={cn(
    'block pl-6 py-1 px-2 text-sm rounded truncate transition-colors hover:bg-frame-accent/10 flex items-center gap-1.5',
    pathname.startsWith(`/projects/${project.id}/review-links`)
      ? 'text-frame-accent bg-frame-accent/10'
      : 'text-frame-textMuted'
  )}
>
  <Link className="w-3 h-3 flex-shrink-0" />
  Review Links
</Link>
```

### Pattern 3: ReviewLinkFolderBrowser Component

**What:** A thin, read-only component in `src/components/review/ReviewLinkFolderBrowser.tsx` that wraps `AssetGrid`/`AssetListView` and renders a review link's assets with a header bar (breadcrumb + view mode toggle).

**Props interface:**
```tsx
interface ReviewLinkFolderBrowserProps {
  projectId: string;
  token: string;
}
```

**Fetching:** Calls `GET /api/review-links/[token]` directly (the existing public endpoint). No new API needed.

**View mode toggle:** `grid` / `list` with `localStorage` key `view-mode-rl-${token}` — same pattern as `FolderBrowser`.

**List view date column:** In list view, the "date" column already shows `asset.createdAt`. No change to `AssetListView` needed — it already has date sorting. The requirement for "creation date of review link folder" in list view means the **folder-card row** on the list page shows `link.createdAt`. This is a column in the list-of-links view, not inside the asset view.

### Pattern 4: ReviewLink Folder Card

**What:** On the list page (`/projects/[projectId]/review-links`), each review link is displayed as a folder-like card. Styled similarly to the existing `FolderCard` in `FolderBrowser`.

**Fields to display:**
- Name: `link.name`
- Creation date: `link.createdAt` (Firestore Timestamp — use the same conversion pattern as `AssetListView` line 63-67)
- Scope indicator: if `link.folderId` is set, show "Folder share"; otherwise "Project share"

### Pattern 5: Project Root Page Update

Current `page.tsx` uses a tab bar with `Files` and `Review Links`. The `Review Links` tab currently shows `ReviewLinksTab` inline (a management view). After Phase 14, the "Review Links" tab should navigate to `/projects/[projectId]/review-links` OR remain as a management view while adding the new browsable route separately.

**Decision point for planner:** Two valid options:
1. Keep the existing tab bar and `ReviewLinksTab` unchanged; the new route is accessible only via sidebar. (Minimal change.)
2. Make the "Review Links" tab button navigate to the new route. The `ReviewLinksTab` management features (rename, delete, copy link) would then live at the new route.

**Recommendation:** Option 1 for this phase — keep the existing tab bar, just add the sidebar link and the new routes. The management tab stays as-is. The new route is a browsable view. This avoids scope creep.

### Anti-Patterns to Avoid

- **Adding a `reviewLinkMode` prop to `FolderBrowser`:** FolderBrowser already has 12+ props and 970 lines. Branching its behavior for a fundamentally different read-only use case will make it unmaintainable. Use a separate component.
- **Fetching assets client-side from Firestore directly:** All existing asset fetches go through `/api/assets?projectId=&folderId=`. The review-link API already returns assets server-side — use that endpoint for consistency.
- **Modifying `AssetCard` or `AssetListView` for the review-link view:** Both already support `hideActions={true}` (AssetCard) and simply omit mutation callbacks when they are not passed (AssetListView). No modifications needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fetching review link assets | Custom Firestore query | `GET /api/review-links/[token]` | Endpoint already exists, handles auth, returns assets + folders |
| Timestamp formatting | Custom date formatter | `formatRelativeTime` from `@/lib/utils` (already used in AssetListView) | Already handles Firestore Timestamp and _seconds fallback |
| Sidebar active-state styling | Custom logic | `cn()` + `pathname.startsWith()` pattern (already used in ProjectTreeNav) | Consistent with existing nav |
| View mode persistence | Custom state | `localStorage.getItem/setItem` with `view-mode-${key}` (same as FolderBrowser lines 75-83) | Already established pattern |

---

## Common Pitfalls

### Pitfall 1: Firestore Timestamp Serialization
**What goes wrong:** `link.createdAt` from the API is a serialized Firestore Timestamp (plain object with `_seconds` and `_nanoseconds` fields), not a `Timestamp` instance. Calling `.toDate()` on it will throw.
**Why it happens:** API routes serialize Firestore Timestamps to JSON which strips the prototype chain.
**How to avoid:** Use the same defensive pattern already in `AssetListView` lines 63-67:
```typescript
const date =
  typeof link.createdAt?.toDate === 'function'
    ? link.createdAt.toDate()
    : new Date((link.createdAt as any)?._seconds * 1000 || Date.now());
```
**Warning signs:** `TypeError: link.createdAt.toDate is not a function`

### Pitfall 2: The Token IS the Doc ID
**What goes wrong:** Confusing `ReviewLink.id` with `ReviewLink.token`. From the API route (`route.ts` line 17): `db.collection('reviewLinks').doc(params.token).get()` — the token IS the document ID. In the `ReviewLink` type, `id` and `token` are both present and for Firestore records created after Phase 11, `id === token`.
**Why it happens:** The `reviewLinks` collection uses token as doc ID; the `id` field is added by the `{ id: d.id, ...d.data() }` spread.
**How to avoid:** For the internal fetch in `ReviewLinkFolderBrowser`, use `link.token` (or `link.id` — same value) in the URL path. Always use `link.token` for the public URL.

### Pitfall 3: Password-Protected Links
**What goes wrong:** Some review links have a `password` field set. The `GET /api/review-links/[token]` endpoint returns 401 when a password is required but not provided.
**Why it happens:** Password check in `[token]/route.ts` lines 32-35.
**How to avoid:** For the internal (authenticated project member) view, the fetcher should detect a 401 and either show a password prompt or show a "Password protected — open public link to view" message. The simplest approach: if 401, show the public link URL so the user can open it directly.

### Pitfall 4: Review Link with folderId=null Shows All Project Assets
**What goes wrong:** When `link.folderId` is null, the API returns all `ready` assets for the entire project (route.ts line 43-47). This could be hundreds of assets for large projects.
**Why it happens:** The query `where('projectId', '==', link.projectId).where('status', '==', 'ready')` has no folder filter when `folderId` is null.
**How to avoid:** This is the intended behavior. Just document it clearly in the UI — e.g., "Showing all project assets" vs "Showing folder: FolderName".

### Pitfall 5: ReviewLinksTab Already Shows in Project Root
**What goes wrong:** The project root `page.tsx` currently renders `ReviewLinksTab` in a "Review Links" tab. If Phase 14 also adds a sidebar "Review Links" link to a new route, users have two different "Review Links" entry points with different capabilities.
**Why it happens:** Phase 9 added the management tab; Phase 14 adds a browsable view.
**How to avoid:** Keep them as separate concerns in this phase. The sidebar link goes to the browsable view; the tab bar in project root shows the management tab. Document this in code comments so a future phase can consolidate if needed.

---

## Code Examples

### Fetching review links (authenticated — list page)

```typescript
// Source: existing ReviewLinksTab.tsx fetchLinks pattern
const fetchLinks = async () => {
  const idToken = await getIdToken();
  const res = await fetch(`/api/review-links?projectId=${projectId}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await res.json();
  return data.links as ReviewLink[];
};
```

### Fetching assets for one review link (list page → asset page)

```typescript
// Source: existing /api/review-links/[token]/route.ts GET handler
// Returns: { reviewLink, assets, folders, projectName }
// No auth token needed — public endpoint (safe: no edit capabilities exposed)
const res = await fetch(`/api/review-links/${token}`);
const data = await res.json();
// data.assets: Asset[] — ready to pass to AssetGrid or AssetListView
```

### Timestamp safe conversion (for creation date display)

```typescript
// Source: AssetListView.tsx lines 63-67 (same pattern)
const date =
  typeof link.createdAt?.toDate === 'function'
    ? link.createdAt.toDate()
    : new Date((link.createdAt as any)?._seconds * 1000 || Date.now());
const label = date.toLocaleDateString();
```

### View mode persistence (localStorage)

```typescript
// Source: FolderBrowser.tsx lines 75-83
const viewModeKey = `view-mode-rl-${token}`;   // 'rl-' prefix avoids collision with folder keys
const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
  if (typeof window === 'undefined') return 'grid';
  return (localStorage.getItem(viewModeKey) as 'grid' | 'list') ?? 'grid';
});
useEffect(() => {
  localStorage.setItem(viewModeKey, viewMode);
}, [viewModeKey, viewMode]);
```

### ProjectTreeNav — Review Links leaf addition

```tsx
// Source: ProjectTreeNav.tsx — append inside expanded block after folders.map(...)
{expanded && foldersLoaded && (
  <Link
    key={`${project.id}-review-links`}
    href={`/projects/${project.id}/review-links`}
    className={cn(
      'flex items-center gap-1.5 pl-6 py-1 px-2 text-sm rounded truncate transition-colors hover:bg-frame-accent/10',
      pathname.startsWith(`/projects/${project.id}/review-links`)
        ? 'text-frame-accent bg-frame-accent/10'
        : 'text-frame-textMuted'
    )}
  >
    <LinkIcon className="w-3 h-3 flex-shrink-0" />
    Review Links
  </Link>
)}
```

Note: `LinkIcon` is already imported in `FolderBrowser.tsx` as `import { Link as LinkIcon }`. In `ProjectTreeNav.tsx` it would need to be added to imports.

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| ReviewLinksTab: inline tab in project root | Phase 14: adds a separate navigable route | Both coexist in this phase |
| Review link browsing only on public `/review/[token]` page | Phase 14: internal browsable view for project members | Internal view uses existing API |

---

## Open Questions

1. **Should clicking a review link "folder" in the internal view open the public review page or the internal asset view?**
   - What we know: The asset page `/projects/[projectId]/assets/[assetId]` is the internal viewer. The public `/review/[token]` page is the external viewer.
   - What's unclear: Which experience is preferred for internal team members browsing via the Review Links section?
   - Recommendation: Build the internal asset view (clicking an asset goes to `/projects/[projectId]/assets/[assetId]`). This gives access to full version history and internal comments. Can always add an "Open public view" button later.

2. **Should the Review Links sidebar entry always show, or only when the project has at least one review link?**
   - What we know: `ProjectTreeNav` currently loads folders lazily on expand. Review link count is not available at sidebar render time without an additional API call.
   - Recommendation: Always show the entry when a project is expanded. An empty state ("No review links yet") on the list page is cleaner than conditionally hiding/showing the entry.

3. **Does the list-view "creation date" requirement apply to the folder-list page or to assets inside a review link?**
   - What we know: The phase goal says "List view shows creation date" for review link folders.
   - Interpretation: The list of review links (folder-list page) shows `link.createdAt` — this is the date the review link was created, shown as a column. The asset view inside a review link already shows asset upload dates via the existing `AssetListView`.
   - Recommendation: Add a date column to the review link folder-list page. No changes needed to `AssetListView`.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 14 is a code-only change. No external tools, CLIs, or services beyond the existing Next.js dev server and Firebase/Firestore setup are required. All dependencies already installed.

---

## Validation Architecture

> `workflow.nyquist_validation` is absent from `.planning/config.json` — treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no `jest.config.*`, `vitest.config.*`, or `tests/` directory found in the project |
| Config file | none |
| Quick run command | manual browser smoke test |
| Full suite command | manual browser smoke test |

No automated test infrastructure exists in this project. All validation is manual smoke testing.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-14A | Project has "Review Links" section in navigation | manual-smoke | n/a | n/a |
| REQ-14B | Clicking shows review links as folders; clicking a folder shows assets | manual-smoke | n/a | n/a |
| REQ-14C | List view shows creation date for review link folders | manual-smoke | n/a | n/a |

### Wave 0 Gaps
None — no test framework exists. All verification is manual. The `/gsd:verify-work` phase gate should be manual browser smoke testing.

---

## Sources

### Primary (HIGH confidence)
- `src/components/files/FolderBrowser.tsx` — navigation patterns, view mode persistence, breadcrumb, AssetGrid/AssetListView wiring
- `src/components/layout/ProjectTreeNav.tsx` — sidebar structure, active state, folder rendering
- `src/app/(app)/projects/[projectId]/page.tsx` — project root page, tab pattern
- `src/app/api/review-links/route.ts` — GET endpoint for review link list
- `src/app/api/review-links/[token]/route.ts` — GET endpoint returning assets + folders for one link
- `src/types/index.ts` — ReviewLink, Asset, Folder type definitions
- `src/components/review/ReviewLinksTab.tsx` — existing review link list UI
- `src/components/files/AssetCard.tsx` — `hideActions` prop already exists
- `src/components/files/AssetListView.tsx` — Timestamp handling pattern, no mutation callbacks needed
- `src/hooks/useProjectTree.ts` — ProjectTreeNode structure, sidebar state

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` — Phase 14 goal and success criteria confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all existing components examined directly
- Architecture: HIGH — routing pattern is established by existing folder/asset routes; re-use strategy confirmed by examining component APIs
- Pitfalls: HIGH — each pitfall is directly traceable to specific lines in the codebase

**Research date:** 2026-04-07
**Valid until:** Stable — this project's codebase changes slowly; valid until any of the examined source files change significantly
