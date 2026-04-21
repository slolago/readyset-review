---
phase: 68
plan: "01"
status: human_needed
requirements: [PERF-05, PERF-06]
---

# Phase 68 Plan 01: Human Verification Required

A live browser session is required to verify sessionStorage timing behavior and network-tab dedupe — neither can be asserted from headless tests.

## PERF-05: AuthContext short-circuit

**Steps:**

1. Open the app in a fresh tab, log in.
2. Open DevTools → Application → Session Storage → your origin. Confirm `frame_cached_user` key exists with shape `{uid, cachedAt, user}`.
3. Open Network tab, then refresh the page (Ctrl+R, NOT hard reload).
4. Expected:
   - The `(app)` layout spinner does NOT block for ~700ms-1s — the shell paints ~instantly.
   - `/api/auth/session` still fires in the background (visible in Network).
   - User identity (name, avatar in header) is correct from first paint.
5. Manually `sessionStorage.clear()` in the console, refresh. Expected: spinner gate behaves as before the change (awaits session POST before paint).
6. In Firestore, set your user doc's `disabled: true`. Refresh. Expected: app paints briefly, then toast "Account suspended..." appears and you are signed out.
7. Click Sign Out. Expected: sessionStorage `frame_cached_user` is removed.

**Pass criteria:**
- Returning-user refresh feels instant (no blank spinner gate).
- Cache invalidates correctly on all four paths (manual clear, 403, error, signOut).

## PERF-06: Shared project fetch

**Steps:**

1. Clear sessionStorage + hard-refresh to get a cold client.
2. Navigate to `/dashboard`. Network tab: confirm exactly one `GET /api/projects` call.
3. Open the sidebar project tree (already rendered). Confirm: NO second `/api/projects` call. `/api/folders?projectId=...` calls ARE expected when a project is expanded.
4. Navigate to `/projects`. Confirm: NO new `/api/projects` call (context already populated).
5. Create a new project via UI. Confirm: one additional `/api/projects` fetch (the `refetch`), and BOTH dashboard grid AND sidebar tree reflect the new project.

**Pass criteria:**
- Exactly ONE `/api/projects` call per navigation into `(app)/`.
- Both consumers (dashboard + sidebar) show consistent state.
- `refetch()` after mutations still keeps both UIs in sync.

## Lighthouse sanity check (optional)

- Before this phase: TTI on returning-user refresh included ~700ms-1s blocked on `/api/auth/session`.
- After: TTI should be bounded by client bundle + Firebase SDK init, not by server round-trip.
- Acceptable if Performance score on `/dashboard` refresh improves by ≥10 points, or if "Time to Interactive" drops by ≥500ms for a warm Firebase-auth'd tab.
