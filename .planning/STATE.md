---
gsd_state_version: 1.0
milestone: v2.4
milestone_name: Meta XMP Stamping on Delivery
status: shipped
stopped_at: All 4 phases shipped (code complete); pending human runtime verification on Vercel + live stamp round-trip
last_updated: "2026-04-23T15:30:00.000Z"
last_activity: 2026-04-23
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 6
  completed_plans: 6
  percent: 100
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-23)

**Core value:** Fast, accurate video review
**Current focus:** v2.4 shipped; awaiting next milestone. Human runtime verification pending.

## Current Position

Phase: All v2.4 phases shipped (79, 80, 81, 82)
Status: Milestone complete (code) — 4/4 phases, 6/6 plans, 13/13 REQs. Archived.
Last activity: 2026-04-23 — v2.4 archived; ready for next milestone

Progress: [██████████] 100% (4/4 phases)

## Accumulated Context

### Key decisions (carried forward to next milestone)

- `ContextMenuProvider` + singleton menu state (v2.2) + `RenameController` scope narrowing (v2.3 Phase 77) — pattern for any future react context with high-cardinality consumers
- `Skeleton` and `ModalSkeleton` primitives live in `src/components/ui/` — reuse across future loading states
- Dynamic-import pattern: `dynamic(() => import('...').then(m => m.Named), { ssr: false, loading: () => <ModalSkeleton /> })` for heavy, user-triggered modals
- Optimistic state pattern in `useComments` (tempId + reconciliation + 3-path rollback) — template for future optimistic mutations
- Cursor-based pagination contract: `?limit=N&cursor=id` → `{ items, nextCursor }` — apply to future admin/list endpoints
- Generalized Job model + `src/lib/jobs.ts` (v2.0 Phase 60) — extend `JobType` union when adding new pipeline types
- Signed URL cache at `src/lib/signed-url-cache.ts` (v2.0 Phase 62) — `getOrCreateSignedUrl` handles any gcsPath identically
- Per-request external binary instance + `end()` in finally — never module-scope singleton for serverless workloads (exiftool-vendored pattern from v2.4 Phase 80)
- Streaming GCS upload via `uploadStream()` (v2.4 Phase 80) — use for any server-side pipeline that writes to /tmp and uploads to GCS; avoids `uploadBuffer` OOM on large files
- `coerceToDate()` at every timestamp comparison (existing helper in `src/lib/format-date.ts`) — direct Firestore Timestamp vs ISO string comparison silently breaks
- `stampedAt < updatedAt` invalidation pattern (v2.4) — applicable to any future cache-on-doc scheme

### Recently shipped

- v2.4 Meta XMP Stamping on Delivery (4 phases, 2026-04-23)
- v2.3 App-Wide Performance Polish (5 phases, 2026-04-22)
- v2.2 Dashboard & Annotation UX Fixes (4 phases, 2026-04-21)
- v2.1 Dashboard Performance (3 phases, 2026-04-21)

### Operational state

- **Pending human verification (v2.4):**
  - Vercel Pro Lambda runtime confirmation that `/api/spike/exiftool-version` returns 200 with `et.version()` — confirm via Vercel dashboard that commit `10ac41f4` deployed cleanly
  - Live stamp round-trip: real review link with real asset; guest download contains 4 Attrib XMP fields; rename flow; new-version flow; concurrent-creator flow
  - Fallback plan if perl is absent on Vercel: move stamp job to Cloud Run per `.planning/phases/79-platform-spike/79-VERIFICATION-SPIKE.md`
- **Vercel auto-deploy observation:** push to `vercel` remote didn't trigger a new deploy within 10+ min. Buildid unchanged. May require manual deploy trigger or Vercel project reconnection.
- **Cleanup item:** remove `/api/spike/exiftool-version` route after v2.4 production stamp pipeline is confirmed healthy
- Firestore composite indexes deployed (v1.9 + v2.0 + v2.1 batches + v2.3 comments(assetId, reviewLinkId))
- Review-link passwords auto-migrate plaintext → bcrypt on first verify (v2.0)
- collaboratorIds backfilled on 18 existing projects (v2.1)

### Pending Todos

None — v2.4 shipped end-to-end. Awaiting next feature/fix input from user.

### Blockers/Concerns

- **Vercel auto-deploy not firing** (HIGH priority — blocks v2.4 production validation). Confirmed via extended polling 45+ min after push: commit `10ac41f4` / `fe2dc965` not served by any Vercel URL checked (`readyset-review-vercel.vercel.app`, `readyset-review.vercel.app`, `readyset.co`, `app.readyset.co`, git-branch previews). BuildId unchanged at `eiG4wr6_JCNtJyKDko-p2` (pre-v2.4 deploy from 2026-04-22). Push lands on the remote git ref — verified via `git ls-remote`. Check Vercel dashboard GitHub integration for `readyset-review-vercel` repo. Same behavior observed throughout this session's commits, so this is not specific to v2.4.

## Session Continuity

Last session: 2026-04-23
Stopped at: v2.4 shipped & archived; ready for /gsd:new-milestone when user picks next scope
Resume file: None
