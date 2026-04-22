# Phase 75: page-loading-and-server-components - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Every route shows a meaningful skeleton on load instead of blank space; 10 pure presentational components flip from Client to Server; admin fetches all tab data eagerly.

Requirements in scope: PERF-15, PERF-16, PERF-17.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Audit surfaced concrete targets with file paths.

</decisions>

<code_context>
## Existing Code Insights

**PERF-15 — loading.tsx skeletons**

Routes that need `loading.tsx` (or need its fallback replaced):
- `src/app/(app)/projects/loading.tsx` — NEW — skeleton grid of ~6 `ProjectCard` placeholders (`animate-pulse`, `bg-neutral-800/50`)
- `src/app/(app)/projects/[projectId]/loading.tsx` — NEW — breadcrumb skeleton + asset grid skeleton
- `src/app/(app)/projects/[projectId]/folders/[folderId]/loading.tsx` — either a dedicated file, OR replace the existing `<Suspense fallback={null}>` inside the page with `<FolderBrowserSkeleton />`. Audit said `fallback={null}` exists in that page — scout to confirm.
- `src/app/(app)/projects/[projectId]/trash/loading.tsx` — NEW — list skeleton matching trash layout
- `src/app/(app)/admin/loading.tsx` — NEW — stats card skeleton + table skeleton

Recommended shared skeleton primitive: `src/components/ui/Skeleton.tsx` (if doesn't exist, create a minimal one with `animate-pulse bg-neutral-800/50 rounded-md`).

**PERF-16 — Server Component conversions**

Pure presentational components that have `"use client"` but don't use state / effects / browser APIs. Audit listed ~10 candidates:
1. `src/components/ui/Avatar.tsx`
2. `src/components/ui/Badge.tsx`
3. `src/components/ui/Spinner.tsx`
4. `src/components/ui/Breadcrumb.tsx`
5. `src/components/viewer/FileTypeCard.tsx`
6. `src/components/review/ReviewHeader.tsx`
7. `src/components/comments/CommentTimestamp.tsx`
8. `src/components/ui/ReviewStatusBadge.tsx`
9. `src/components/ui/Button.tsx` — only if it doesn't depend on forwardRef + onClick semantics; scout carefully before flipping
10. `src/components/projects/ProjectCard.tsx` — the audit notes it uses hover state; a true Server Component flip may need to extract interactivity into a child `<ProjectCardHover>` client wrapper. Lower priority — if the scout says it needs more refactor than a 1-line flip, **skip it for this phase**.

Strategy: scout each file. If it's just props → JSX, strip the `"use client"` directive. If it uses `useState` / `useEffect` / `useRouter` / `onClick` / any hook, LEAVE IT as client. Do NOT force a Server Component conversion that requires a refactor — only land the trivial flips.

**PERF-17 — Admin eager fetch**

- `src/app/(app)/admin/page.tsx:34–49` fires `fetchUsers()` on mount.
- `src/app/(app)/admin/page.tsx:69–77` fires `fetchProjects()` only when the user clicks the Projects tab — ~500ms blank state.
- Fix: fire both on mount (`useEffect(() => { fetchUsers(); fetchProjects(); }, [])`). If either fails, the respective table shows its existing error state. Tabs become instant.

## Codebase hints

- `animate-pulse` + `bg-neutral-800/50` is the existing skeleton style across v1.8/v1.9 loading states
- `ProjectCard` has a skeleton variant or pattern to mirror — scout it
- App Router's `loading.tsx` auto-wraps the route in `<Suspense>` — no manual Suspense needed at the page level

</code_context>

<specifics>
## Specific Ideas

- Keep loading skeletons simple — 3-6 rows, `animate-pulse`, match the target layout's structure. No fancy shimmer, no inline SVG.
- Server Component conversions: ONLY flip files where the change is literally removing `"use client"`. If a component has `onClick` as a prop (common for Button), DO NOT flip it — onClick handlers crossing Server→Client boundary throws.
- Do NOT try to refactor `ProjectCard` to extract a hover-client-wrapper. It's a lot of code for low value. If it's non-trivial, skip and note in SUMMARY.

</specifics>

<deferred>
## Deferred Ideas

- Full `/review/[token]` page restructure — Phase 76
- Full `FolderBrowser` decomposition — Phase 77

</deferred>
