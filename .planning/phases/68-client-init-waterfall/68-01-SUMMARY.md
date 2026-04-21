---
phase: 68
plan: "01"
subsystem: client-init
tags: [perf, auth, projects, context]
requirements: [PERF-05, PERF-06]
commits:
  - b62e5ecf
  - ffbe0fa5
completed: 2026-04-21
---

# Phase 68 Plan 01: client-init-waterfall Summary

Short-circuit the `/api/auth/session` gate via sessionStorage cache (PERF-05) and unify `/api/projects` fetching between dashboard and sidebar under a shared `ProjectsContext` (PERF-06).

## Files Changed

**Created:**
- `src/contexts/ProjectsContext.tsx` — single-fetch project list provider

**Modified:**
- `src/contexts/AuthContext.tsx` — sessionStorage cache (read/write/clear), short-circuit path, background refresh
- `src/hooks/useProject.ts` — `useProjects` is now a thin wrapper around `useProjectsContext()` (external API identical)
- `src/app/(app)/layout.tsx` — wraps AppShell children in `<ProjectsProvider>`

## Commits

- `b62e5ecf` feat(68-01): AuthContext session short-circuit via sessionStorage cache (PERF-05)
- `ffbe0fa5` feat(68-01): ProjectsContext unifies dashboard + sidebar project fetch (PERF-06)

## Design Notes

**PERF-05 cache shape:** `{ uid, cachedAt, user }` in `sessionStorage['frame_cached_user']`. Tab-scoped by design — closing the tab forces a fresh session validation. 24h TTL inside the tab.

**PERF-05 invalidation:** cleared on (a) explicit `signOut`, (b) server 403 on background refresh, (c) error path during initial sync, (d) `fbUser === null` in auth state callback.

**PERF-05 background refresh:** fires `/api/auth/session` without blocking render. On success, re-caches. On 403 (suspended), clears cache + signs out + shows toast. On network error, leaves cached user alone (non-fatal for tab session).

**PERF-06 scoping:** `ProjectsProvider` sits inside `AuthProvider` at `(app)/layout.tsx`, so all authenticated pages share one fetch. All current `useProjects` consumers (`dashboard/page.tsx`, `projects/page.tsx`, `useProjectTree.ts`) are under `(app)/` — provider coverage is complete.

## Verification

### PERF-05 (returning-user paint)
1. Log in. Navigate around — confirm normal behavior.
2. DevTools → Application → Session Storage — confirm `frame_cached_user` key is present with shape `{uid, cachedAt, user}`.
3. Refresh the page. Observe:
   - Network tab: `/api/auth/session` POST still fires (background refresh).
   - But: the spinner gate in `(app)/layout.tsx` clears IMMEDIATELY (no ~700ms-1s blank wait).
   - App shell paints before the session POST resolves.
4. Clear sessionStorage manually → refresh. Observe: spinner gate behaves as before (awaits session POST).
5. Suspend the user in Firestore (`disabled: true`) → refresh. Observe: app paints briefly from cache, then background refresh returns 403, toast appears, user is signed out.

### PERF-06 (single project fetch)
1. Open the dashboard page with a cold cache. Network tab: confirm exactly **one** `GET /api/projects` request.
2. Navigate to `/projects` — confirm no additional `/api/projects` fetch (context already populated).
3. Expand a project in the sidebar — `/api/folders?projectId=...` fires (expected), but no new `/api/projects` call.
4. Create a new project via UI — confirm `refetch()` on the context updates both dashboard grid AND sidebar tree from a single follow-up fetch.

## Anti-Scope Respected

- No server-side route changes (`/api/auth/session`, `/api/projects` untouched).
- No Firestore schema or index changes.
- No admin UI changes.
- No real-time `onSnapshot` conversion (deferred per CONTEXT).
- No server-side HTTP-only cookie session (deferred per CONTEXT).

## Tests

- Typecheck: clean (no errors).
- Vitest: 171/171 passing (no test changes needed — no testable non-UI logic added).

## Known Stubs

None.

## Self-Check: PASSED

- `src/contexts/ProjectsContext.tsx` — FOUND
- `src/contexts/AuthContext.tsx` — modified, FOUND
- `src/hooks/useProject.ts` — modified, FOUND
- `src/app/(app)/layout.tsx` — modified, FOUND
- Commit `b62e5ecf` — FOUND
- Commit `ffbe0fa5` — FOUND
