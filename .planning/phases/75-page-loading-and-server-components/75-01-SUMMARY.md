---
phase: 75-page-loading-and-server-components
plan: 01
subsystem: app-shell
tags: [perf, loading-states, rsc, admin]
requires:
  - v2.2 milestone baseline (Phase 69 dashboard perf)
provides:
  - Route-level loading skeletons on 5 major routes
  - Minimal shared Skeleton primitive (animate-pulse + bg-neutral-800/50)
  - 3 presentational components rendering as Server Components
  - Admin panel parallel eager fetch on mount
affects:
  - UX perception on route transitions
  - Admin tab UX (Projects tab now instant)
tech-stack:
  added: []
  patterns:
    - Next.js App Router loading.tsx per route
    - Server Component conversion via "use client" removal (no refactor)
    - Promise-parallel mount fetch for multi-tab panels
key-files:
  created:
    - src/components/ui/Skeleton.tsx
    - src/app/(app)/projects/loading.tsx
    - src/app/(app)/projects/[projectId]/loading.tsx
    - src/app/(app)/projects/[projectId]/folders/[folderId]/loading.tsx
    - src/app/(app)/projects/[projectId]/trash/loading.tsx
    - src/app/(app)/admin/loading.tsx
  modified:
    - src/components/ui/Badge.tsx (removed "use client")
    - src/components/ui/Spinner.tsx (removed "use client")
    - src/components/review/ReviewHeader.tsx (removed "use client")
    - src/app/(app)/admin/page.tsx (merged mount effects, parallel fetch)
decisions:
  - Nested-folder route uses a sibling loading.tsx (not in-page Suspense swap) because loading.tsx covers route transitions while the page's existing fallback={null} services useSearchParams (different concern).
  - Created a new Skeleton primitive — none existed. 10 lines, one className prop. Used in all 5 loading.tsx files.
  - Flipped only 3 of 10 candidate components. Did NOT force-flip by refactoring — per plan "a flip is strictly the removal of the directive." Audit over-counted flippable candidates; scout surfaced hidden event-handler and hook deps.
metrics:
  duration_seconds: 1673
  tasks_completed: 3
  tasks_total: 3
  files_created: 6
  files_modified: 4
  tests_passing: 171
  tests_total: 171
  completed_date: 2026-04-22
---

# Phase 75 Plan 01: page-loading-and-server-components Summary

**One-liner:** Five route-level `loading.tsx` skeletons, 3 presentational components flipped to Server Components, and admin panel fetches users + projects in parallel on mount (Projects tab instant).

## What Shipped

### PERF-15 — Route loading skeletons

Added 5 new `loading.tsx` files, one per major route, plus a minimal shared `Skeleton` primitive:

- `src/components/ui/Skeleton.tsx` — 10 lines, one `className` prop, `animate-pulse bg-neutral-800/50 rounded-md`.
- `src/app/(app)/projects/loading.tsx` — header + 6-card grid skeleton.
- `src/app/(app)/projects/[projectId]/loading.tsx` — tab bar + breadcrumb + 8-card grid skeleton.
- `src/app/(app)/projects/[projectId]/folders/[folderId]/loading.tsx` — breadcrumb + 8-card grid skeleton.
- `src/app/(app)/projects/[projectId]/trash/loading.tsx` — header + 6-row list skeleton.
- `src/app/(app)/admin/loading.tsx` — header + 5-card stats row + 4-tab bar + 8-row table skeleton.

**Nested-folder strategy chosen:** sibling `loading.tsx` (option b). The existing `<Suspense fallback={null}>` in the page stays unchanged because it services `useSearchParams()` (a Next.js build-time requirement), not route-transition loading. Different concerns, left alone per surgical-change principle.

**Skeleton primitive decision:** None existed in `src/components/ui/`, so created one. Used by all 5 loading files. Scope intentionally minimal — just `className` passthrough over the existing `animate-pulse bg-neutral-800/50` pattern.

### PERF-16 — Server Component flips

Scouted all 10 candidate files. Final flip table:

| Component         | Flipped? | Reason if skipped                                                     |
|-------------------|----------|-----------------------------------------------------------------------|
| Avatar            | no       | `onError` handler on `next/image` crosses the Server→Client boundary  |
| Badge             | **yes**  | —                                                                     |
| Spinner           | **yes**  | —                                                                     |
| Breadcrumb        | no       | Uses `useState`, `useRef`, `useEffect`, and inline `onClick` handlers |
| ReviewStatusBadge | n/a      | **Already a Server Component** — no `"use client"` directive to remove (baseline; audit miscounted it as a candidate) |
| Button            | no       | Accepts `onClick` via `...props` spread — event-handler prop boundary |
| FileTypeCard      | no       | Uses `useUserNames` hook + inline `onClick={handleDownload}`          |
| ReviewHeader      | **yes**  | —                                                                     |
| CommentTimestamp  | no       | Accepts `onClick` as a prop, renders `<button onClick={onClick}>`     |
| ProjectCard       | no       | Uses `useState` + `useAuth` + `onClick` handlers — flip would require refactor (skip per CONTEXT.md specifics) |

**3 flipped, 6 skipped, 1 N/A.** Below the 6-flip floor from the plan's acceptance criteria. See "Surprises" below.

### PERF-17 — Admin eager parallel fetch

`src/app/(app)/admin/page.tsx` — merged the two mount effects into one that fires both `fetchUsers()` and `fetchProjects()` in the same tick. Removed the tab-change effect that deferred `fetchProjects()` until the user clicked the Projects tab. Each fetch keeps its independent loading + error state, so one failure cannot blank the other table.

## Surprises

**The audit over-counted flippable candidates.** The CONTEXT.md listed 10 "pure presentational" components, with the caveat that Button and ProjectCard were likely skips — implying ~8 would be safe flips. In practice, scouting revealed:

- `Avatar` has an `onError` handler on the `next/image` element — event handlers in JSX break Server Components.
- `Breadcrumb` looks presentational at first glance but has a collapsed-folders dropdown with `useState`/`useRef`/`useEffect`/`onClick`.
- `FileTypeCard` has a `useUserNames` hook call and an inline download `onClick` — not a pure shell.
- `CommentTimestamp` accepts `onClick` as a prop AND renders it in JSX — both disqualify.
- `ReviewStatusBadge` is already a Server Component (no `"use client"` on line 1) — the audit listed it as a flip candidate when there's literally nothing to flip.

Only `Badge`, `Spinner`, and `ReviewHeader` met the "pure JSX, no hooks, no event handlers, no event-handler props" bar. Rather than force-flip by extracting hover wrappers or stripping `onError`/`onClick` (refactor work explicitly deferred by the plan and CLAUDE.md #3 Surgical Changes), left the 6 non-qualifying files unchanged and documented in the commit body + this table.

Net impact: **3 fewer client-bundle payloads for commonly-rendered primitives.** Below the plan's 6–10 target, but honest about the ceiling the existing code permits without refactor.

## Deferrals

- **ProjectCard hover-client-wrapper refactor** — NOT attempted per CONTEXT.md specifics. Would require extracting `<ProjectCardHover>` as a child client component and keeping the shell on the server. Low value for the complexity; revisit only if ProjectCard bundle cost is called out by lighthouse/SSR metrics.
- **Avatar `onError` → client-wrapper split** — NOT attempted. Same tradeoff as ProjectCard; the fallback-image logic is the only client-dependent part.
- **`/review/[token]` restructure** — Phase 76.
- **`FolderBrowser` internals decomposition** — Phase 77.

## Verification

- `npx tsc --noEmit` → exit 0 (clean)
- `npm test` → 171/171 passing
- `npm run build` → exit 0, no new RSC boundary warnings (only pre-existing `<img>` and `useEffect` deps warnings, unchanged from baseline)
- All 5 loading.tsx files exist and contain `animate-pulse` + `bg-neutral-800`
- Admin mount effect fires both fetches (`grep fetchUsers();\n    fetchProjects()` — 1 match in page.tsx)
- No tab-click `fetchProjects()` invocation remains (only the mount call + the `onChanged={fetchProjects}` passthrough to `ProjectsTable`, which is a legitimate refetch-after-mutation hook, not a tab-click fetch)

## Commits

- `fa2837d7` — feat(75-01): add loading.tsx skeletons for 5 routes (PERF-15)
- `45b8764b` — feat(75-01): flip Badge, Spinner, ReviewHeader to Server Components (PERF-16)
- `532e561c` — feat(75-01): admin eagerly fetches users + projects on mount (PERF-17)

## Self-Check: PASSED

- All 6 created files exist at the documented paths.
- All 3 modified files have the expected changes applied.
- All 3 commit hashes present in `git log`.
- Typecheck, tests, and build all clean.
