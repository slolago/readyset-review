# Phase 1: breadcrumb-nav - Research

**Researched:** 2026-04-04
**Domain:** Next.js App Router navigation, React component extraction, Firestore folder hierarchy
**Confidence:** HIGH

---

## Summary

The breadcrumb feature is **already partially implemented** — the rendering logic lives inline inside `FolderBrowser.tsx` (lines 492–535). It uses a `breadcrumbs` state array built from `ancestorFolders` + `currentFolder` + `project.name`. The phase work is primarily a **component extraction and verification task**, not a net-new build.

The key infrastructure (Firestore `parentId`-chain walking in the API, `ancestorFolders` state, `breadcrumbs` state, `BreadcrumbItem` type in `src/types/index.ts`) is already present and working. The breadcrumb links correctly navigate to ancestor folders. The only potential gap: breadcrumb `href` values on line 498 do NOT include the `?path=` query parameter, but this is acceptable because the `/api/folders/[folderId]` route already walks `parentId` directly from Firestore (the `?path=` fallback is only needed for legacy data missing `parentId`).

**Primary recommendation:** Extract the inline breadcrumb `<nav>` block from `FolderBrowser.tsx` into a standalone `Breadcrumb` component at `src/components/ui/Breadcrumb.tsx`, wire it with the existing data, and verify it renders correctly on both root and nested folder views.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-01 | A breadcrumb bar is visible above the file browser showing the current folder path | Inline nav already exists in FolderBrowser lines 492–535; extraction to component confirms visibility |
| REQ-02 | Each crumb is a clickable link that navigates to that folder | `<Link href={href}>` pattern already in place; root uses `router.push`, non-last crumbs use Next.js `<Link>` |
| REQ-03 | The root (project) level shows the project name as the first crumb; matches dark theme | `project?.name` is already first crumb; theme colors `frame-textSecondary`, `frame-accent`, `frame-border` already applied |
</phase_requirements>

---

## Current Implementation Audit

### Where breadcrumb state lives: `FolderBrowser.tsx`

| State | Type | Source |
|-------|------|--------|
| `breadcrumbs` | `Array<{ id: string \| null; name: string }>` | Built in `useEffect` from `project`, `ancestorFolders`, `currentFolder` |
| `ancestorFolders` | `FolderType[]` | Fetched from `/api/folders/${folderId}` response `.ancestors` |
| `currentFolder` | `FolderType \| null` | Fetched from `/api/folders/${folderId}` response `.folder` |

### Breadcrumb construction (lines 141–152)

```typescript
// Source: src/components/files/FolderBrowser.tsx lines 141-152
const crumbs: Array<{ id: string | null; name: string }> = [
  { id: null, name: project?.name || 'Project' },
];
for (const ancestor of ancestorFolders) {
  crumbs.push({ id: ancestor.id, name: ancestor.name });
}
if (currentFolder) {
  crumbs.push({ id: currentFolder.id, name: currentFolder.name });
}
setBreadcrumbs(crumbs);
```

### Breadcrumb render (lines 492–535)

Already renders:
- Root crumb: project name with a colored Home icon, links to `/projects/${projectId}`
- Ancestor crumbs: folder name, links to `/projects/${projectId}/folders/${crumb.id}`
- Current folder: plain `<span>` (not a link), shown as active

### URL / Routing structure

| URL pattern | Component | Props |
|-------------|-----------|-------|
| `/projects/[projectId]` | `ProjectRootPage` | `<FolderBrowser projectId={projectId} folderId={null}>` |
| `/projects/[projectId]/folders/[folderId]?path=...` | `FolderPage` | `<FolderBrowser projectId folderId ancestorPath>` |

The `?path=` query param is a comma-separated list of ancestor folder IDs, used as a fallback when Firestore `parentId` is missing. The API primary path is `parentId`-chain walking.

### Firestore `Folder` data model (from `src/types/index.ts`)

```typescript
interface Folder {
  id: string;
  projectId: string;
  parentId: string | null;   // parent folder, or null for root-level
  name: string;
  path: string[];            // array of ancestor IDs (may be incomplete in legacy data)
  createdAt: Timestamp;
}
```

The API (`/api/folders/[folderId]`) walks `parentId` in a loop (max 20 levels) and returns `{ folder, ancestors }`.

---

## Standard Stack

### Core (already in project)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Next.js 14 | 14.x | App Router, `<Link>`, `useRouter`, `useParams`, `useSearchParams` | All navigation primitives available |
| React | 18.x | Component state, `useEffect`, `useCallback` | Standard patterns |
| Tailwind CSS | 3.x | Styling with `frame-*` custom colors | Config at `tailwind.config.ts` |
| lucide-react | latest | `ChevronRight`, `Home` icons | Already imported in FolderBrowser |

### Theme colors to use

| Token | Value | Use |
|-------|-------|-----|
| `frame-textSecondary` | `#9090b0` | Non-active crumb text |
| `frame-textMuted` | `#55556a` | Separator chevron |
| `text-white` | `#ffffff` | Active (last) crumb |
| `frame-accent` | `#7a00df` | Home icon color |
| `frame-sidebar` | `#0e0e18` | Header background (already applied) |

Note: PROJECT.md documents theme as `#0d0d0d bg, #6c5ce7 accent` but the actual Tailwind config uses `frame-bg: '#08080f'` and `frame-accent: '#7a00df'`. The rendered app uses the Tailwind values — trust `tailwind.config.ts`.

---

## Architecture Patterns

### Recommended: Extract to `src/components/ui/Breadcrumb.tsx`

The `BreadcrumbItem` type already exists in `src/types/index.ts`:

```typescript
// Source: src/types/index.ts lines 123-127
export interface BreadcrumbItem {
  id: string;
  name: string;
  href: string;
}
```

The component should accept a `items` prop and a `projectId` for the home icon color.

### Pattern: Controlled breadcrumb component

```typescript
// Source: pattern derived from existing inline code in FolderBrowser.tsx lines 492-535
interface BreadcrumbProps {
  items: Array<{ id: string | null; name: string }>;
  projectId: string;
  projectColor?: string;
}

export function Breadcrumb({ items, projectId, projectColor = '#7a00df' }: BreadcrumbProps) {
  // map items → href, render with ChevronRight separators
  // last item is non-clickable span
  // first item gets Home icon
}
```

### Where to place the component

`src/components/ui/Breadcrumb.tsx` — consistent with `Button`, `Spinner`, `Dropdown` in `src/components/ui/`.

### How to wire it in FolderBrowser

Replace the inline `<nav>` block (lines 492–535 of `FolderBrowser.tsx`) with:

```tsx
<Breadcrumb items={breadcrumbs} projectId={projectId} projectColor={color} />
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Folder path resolution | Custom recursive Firestore query | The `/api/folders/[folderId]` route already does `parentId`-chain walking and returns `ancestors[]` |
| Navigation | `window.location.href` or custom router | Next.js `<Link>` (already used) |
| Breadcrumb href with ancestor context | Custom URL encoding | The API's `parentId`-chain walking eliminates need for `?path=` in breadcrumb links |

---

## Common Pitfalls

### Pitfall 1: Breadcrumb href missing `?path=` for ancestor links

**What goes wrong:** The current breadcrumb link `href` (line 498) does NOT include `?path=` query param. For most folders this is fine (API walks `parentId` chain). For legacy folders where `parentId` is `null` but `path[]` is populated, navigating to an ancestor crumb would reload without the ancestor context — the API would then return empty `ancestors`.

**Why it happens:** The `?path=` system was added as a fallback after a migration; the breadcrumb links weren't updated to include it.

**How to avoid:** When building the `Breadcrumb` component, compute each crumb's `href` with the `?path=` of all crumbs that precede it. Or accept that the API's `parentId`-walk is reliable for all post-migration data.

**Recommendation:** For the extracted component, keep existing behavior (no `?path=` on breadcrumb hrefs). The API `parentId`-walk is the authoritative path resolution. The `?path=` fallback is for the `FolderCard` click-through only.

### Pitfall 2: Root crumb shows "Project" during loading

**What goes wrong:** `project?.name || 'Project'` falls back to the string "Project" while the project is loading. The breadcrumb would flash "Project" then update.

**Why it happens:** `useProject` async load; breadcrumb `useEffect` fires before project resolves.

**How to avoid:** The existing code already handles this gracefully — the `projectLoading` guard shows a spinner before the main render, so the breadcrumb never renders during load.

### Pitfall 3: Changing `breadcrumbs` type when extracting

**What goes wrong:** The inline code uses `Array<{ id: string | null; name: string }>` but `BreadcrumbItem` in `types/index.ts` has `id: string` (not nullable) and adds `href: string`. These are different shapes.

**Why it happens:** The `BreadcrumbItem` type was added speculatively and doesn't match what `FolderBrowser` actually computes.

**How to avoid:** Keep the component's internal prop type as `Array<{ id: string | null; name: string }>` (matching what `FolderBrowser` produces) rather than trying to use `BreadcrumbItem`. The `href` computation belongs inside the `Breadcrumb` component.

---

## Code Examples

### Existing breadcrumb render pattern (source of truth)

```tsx
// Source: src/components/files/FolderBrowser.tsx lines 492-535
<nav className="flex items-center gap-1 text-sm overflow-x-auto">
  {breadcrumbs.map((crumb, i) => {
    const isLast = i === breadcrumbs.length - 1;
    const isRoot = i === 0;
    const href = crumb.id
      ? `/projects/${projectId}/folders/${crumb.id}`
      : `/projects/${projectId}`;

    return (
      <span key={crumb.id ?? 'root'} className="flex items-center gap-1 flex-shrink-0">
        {i > 0 && <ChevronRight className="w-4 h-4 text-frame-textMuted" />}
        {isLast ? (
          <span className="flex items-center gap-1.5 text-white font-medium">
            {isRoot && (
              <div className="w-5 h-5 rounded flex items-center justify-center"
                style={{ backgroundColor: color + '20', color }}>
                <Home className="w-3 h-3" />
              </div>
            )}
            {crumb.name}
          </span>
        ) : (
          <Link href={href}
            className="flex items-center gap-1.5 text-frame-textSecondary hover:text-white transition-colors">
            {isRoot && (
              <div className="w-5 h-5 rounded flex items-center justify-center"
                style={{ backgroundColor: color + '20', color }}>
                <Home className="w-3 h-3" />
              </div>
            )}
            {crumb.name}
          </Link>
        )}
      </span>
    );
  })}
</nav>
```

### FolderCard navigation with `?path=` (for reference — do not change)

```tsx
// Source: src/components/files/FolderBrowser.tsx line 764
const url = `/projects/${projectId}/folders/${folder.id}${ancestorPath ? `?path=${ancestorPath}` : ''}`;
router.push(url);
```

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this is a pure UI component extraction).

---

## Validation Architecture

Config has no `workflow.nyquist_validation` key — treated as enabled.

### Test Framework

No test framework detected in the project. No `jest.config.*`, `vitest.config.*`, `pytest.ini`, or `test/` directory found.

| Property | Value |
|----------|-------|
| Framework | None detected |
| Config file | None |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-01 | Breadcrumb bar visible above file browser | visual/smoke | Playwright MCP visual check | No test infra |
| REQ-02 | Each crumb is a clickable link navigating to that folder | smoke | Playwright MCP: click crumb, assert URL change | No test infra |
| REQ-03 | Root crumb shows project name; matches dark theme | visual | Playwright MCP visual check | No test infra |

### Sampling Rate

Per STATE.md: "Using Playwright MCP for visual verification before pushing."

- Per task: Playwright MCP visual check of breadcrumb at root + nested folder level
- Phase gate: Visual verification passes before pushing

### Wave 0 Gaps

- [ ] No test framework — all validation via Playwright MCP visual review (matches project convention in STATE.md)

---

## Sources

### Primary (HIGH confidence)

- Direct code read: `src/components/files/FolderBrowser.tsx` — breadcrumb state management, render, and data fetching
- Direct code read: `src/app/api/folders/[folderId]/route.ts` — `parentId`-chain walking, `ancestors` response
- Direct code read: `src/types/index.ts` — `Folder`, `BreadcrumbItem`, `Project` types
- Direct code read: `tailwind.config.ts` — actual theme color values
- Direct code read: `src/app/(app)/projects/[projectId]/page.tsx` — root project page, passes `folderId={null}`
- Direct code read: `src/app/(app)/projects/[projectId]/folders/[folderId]/page.tsx` — folder page, reads `?path=` from searchParams

### Secondary (MEDIUM confidence)

- Next.js 14 App Router documentation (known from training, consistent with code patterns observed)

---

## Metadata

**Confidence breakdown:**
- Existing implementation: HIGH — read directly from source
- Architecture recommendation: HIGH — derived from existing patterns in codebase
- Type mismatch pitfall: HIGH — directly observed in types/index.ts vs FolderBrowser usage
- Ancestor-path pitfall: MEDIUM — behavior under legacy data not tested live

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable codebase, no fast-moving deps)
