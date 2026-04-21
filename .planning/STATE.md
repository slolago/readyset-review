---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Dashboard Performance
status: shipped
stopped_at: All 3 phases shipped; live Lighthouse verification pending
last_updated: "2026-04-21T20:00:00.000Z"
last_activity: 2026-04-21
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 3
  completed_plans: 3
  percent: 100
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-21)

**Core value:** Fast, accurate video review
**Current focus:** v2.1 shipped; awaiting next milestone

## Current Position

Phase: All v2.1 phases shipped
Status: Milestone complete (3/3 phases, 9 REQs)
Last activity: 2026-04-21 — Phase 69 executed; commits 194d8f66..09ce4cd2 pushed

Progress: [██████████] 100% (3/3 phases)

## Accumulated Context

### Key decisions

- Denormalized `Project.collaboratorIds` (maintained atomically everywhere `collaborators` is written — 5 writers total)
- `src/lib/projects-access.ts::fetchAccessibleProjects` and `src/lib/dashboard-stats.ts::fetchDashboardStats` are the single entry points for those queries (route + SSR both consume)
- `AuthContext` uses `sessionStorage` (tab-scoped) for returning-user cache, 24h TTL
- `ProjectsContext` wraps authenticated pages so dashboard + sidebar share one fetch
- `getAuthenticatedUser` caches user doc reads module-level, 30s TTL; `invalidateUserCache(uid)` exposed and called by session endpoint after name/avatar mutations
- Server Component dashboard ships structurally; `initialStats=null` fallback until session-cookie middleware lands in v3

### Recently shipped

- v2.1 Dashboard Performance (3 phases, shipped 2026-04-21)

### Operational state

- Firestore composite indexes deployed (v1.9 + v2.0 + v2.1 batches all live)
- collaboratorIds backfilled on 18 existing projects
- deletedAt backfilled on 140 assets + 84 folders (v2.0 rollout)
- commentCount backfilled on 131 assets (v2.0 rollout)
- Sprite-v2 generated on 64/74 videos; 7 are orphaned (deleted projectId) + 3 are timeouts on Hobby plan
- Review-link passwords auto-migrate plaintext → bcrypt on first verify (transparent)

### Pending Todos

None — v2.1 shipped end-to-end. Awaiting next feature/fix input from user.

### Blockers/Concerns

- Server Component SSR prefetch doesn't activate until middleware-based session cookie infra exists. Today the Server Component falls back to client-side fetch — same perf as before, but the structural split is done so v3 can turn on SSR cleanly.
- Hobby-plan 60s function limit is now the bottleneck for sprite generation on very large videos (3 of 74 timing out). Upgrading to Pro (300s) or a different processing path are separate decisions.

## Session Continuity

Last session: 2026-04-21
Stopped at: v2.1 shipped — 5 milestones total shipped this sprint (v1.7, v1.8, v1.9, v2.0, v2.1)
Resume file: None
