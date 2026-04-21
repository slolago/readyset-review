# Phase 69: ssr-and-micro-optimizations - Context

**Gathered:** 2026-04-21
**Status:** Ready (skip_discuss)

<domain>
Final dashboard perf polish: SSR pre-fetch of stats to eliminate the client-side waterfall, per-request user doc cache in getAuthenticatedUser, local logo asset.
</domain>

<decisions>
### Claude's Discretion

**PERF-07 Server Component dashboard split:**
- Current dashboard page is `'use client'` + fetches `/api/stats` client-side via `useEffect`. Creates a 3-step waterfall: JS download → hydrate → fetch → render numbers.
- Split: `src/app/(app)/dashboard/page.tsx` becomes a Server Component that reads the Firebase session cookie (if present), verifies it via `getAuthenticatedUser`-equivalent server-side, computes stats inline by calling a shared helper (`fetchDashboardStats(user, isPlatformAdmin)` extracted from `/api/stats` route), and passes the result as props to a new `<DashboardClient initialStats={...} />` client component.
- The `/api/stats` route stays for the client refetch path (Phase 68 ProjectsContext invalidation, manual refresh, etc) — delegates to the same helper.
- Auth on Server Component: Firebase doesn't have a native session cookie, so read the ID token from a custom header/cookie OR fall back to client-side fetch on hydration if cookie is absent. Pragmatic path: if the ID token isn't available server-side (cookie-less flow), ship the Server Component shell with `initialStats={null}` and the client fetches — no regression vs today. If we can get the token server-side via middleware in a follow-up, SSR fills it.
- **Pragma**: for THIS phase, ship the Server Component split architecturally (wrapper file, client shell extracted, stats-fetch helper exported), even if the SSR prefetch falls back to client in prod. The test is: `/api/stats` helper is shared between route and server component, no logic duplication. Future middleware work can turn on SSR prefetch cleanly.

**PERF-08 user doc cache in auth-helpers:**
- Module-level `const userCache = new Map<string, {user: User; exp: number}>();`
- TTL: 30s (short enough that disabled-user suspend takes effect quickly, long enough to dedupe a single request's concurrent API calls)
- In `getAuthenticatedUser`: after `verifyIdToken` gives us uid, check cache. If hit and not expired, return immediately (no Firestore read). Else do the read + populate cache.
- Invalidation: on logout (session endpoint), clear entry for that uid. On admin suspend, we can't invalidate remotely — 30s staleness is acceptable.

**PERF-09 local logo:**
- Move from `readyset.co` external URL to `/public/logo.svg` or similar.
- Remove `unoptimized` prop. Let Next.js Image optimize.
- Check Sidebar.tsx for the usage + any other place the CDN URL appears.
</decisions>

<code_context>
- src/app/(app)/dashboard/page.tsx ('use client', uses useEffect + fetch)
- src/app/api/stats/route.ts (logic we want to extract)
- src/lib/auth-helpers.ts (getAuthenticatedUser)
- src/components/layout/Sidebar.tsx (logo)
</code_context>

<specifics>3 REQs: PERF-07..09</specifics>
<deferred>
- Middleware-based session cookie for true SSR auth — v3 future
- Redis/edge cache layer for /api/stats — SWR headers are enough
</deferred>
