/**
 * Phase 69 (PERF-07) — Dashboard Server Component wrapper.
 *
 * Architecturally splits the dashboard into a Server Component shell + a
 * client component (DashboardClient.tsx) that renders the actual UI and
 * handles post-hydration refetches.
 *
 * SSR pre-fetch of stats requires a server-readable session cookie, which
 * Firebase doesn't set by default. Today this component ships with
 * `initialStats={null}` and the client fetches on mount — no regression vs
 * the pre-Phase-69 behavior. When a session-cookie middleware lands (v3),
 * this file can resolve the user server-side via `getAdminAuth().verifyIdToken`
 * on the cookie and call `fetchDashboardStats(user)` here — the client seeds
 * its state from the prop and skips the initial fetch.
 *
 * The structural payoff is live now: `/api/stats` and this Server Component
 * share the same `fetchDashboardStats` helper (src/lib/dashboard-stats.ts),
 * so there's no query-logic drift to worry about when SSR is switched on.
 */

import DashboardClient from './DashboardClient';
import type { DashboardStats } from '@/lib/dashboard-stats';

export default async function DashboardPage() {
  // Today: no server-readable session cookie → client fetches.
  // Future: resolve user from cookie + `await fetchDashboardStats(user)`.
  const initialStats: DashboardStats | null = null;

  return <DashboardClient initialStats={initialStats} />;
}
