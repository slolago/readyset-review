---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Architecture Hardening
status: shipped
stopped_at: All 7 phases shipped; operational follow-ups documented in MILESTONES.md
last_updated: "2026-04-21T14:50:00.000Z"
last_activity: 2026-04-21
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 7
  completed_plans: 7
  percent: 100
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-20)

**Core value:** Fast, accurate video review
**Current focus:** v2.0 shipped; awaiting next milestone

## Current Position

Phase: All v2.0 phases shipped
Status: Milestone v2.0 complete (7/7 phases, 31 REQs)
Last activity: 2026-04-21 — Phase 66 executed; commits 2c6e4ad5..0540a76d pushed

Progress: [██████████] 100% (7/7 phases)

## Performance Metrics

- v1.3: 9 plans / 6 phases
- v1.4: 7 plans / 5 phases
- v1.5: 9 plans / 8 phases
- v1.6: archived, never executed
- v1.7: 6 plans / 6 phases (shipped)
- v1.8: 5 plans / 5 phases (shipped)
- v1.9: 6 plans / 6 phases (shipped)
- v2.0: 7 plans / 7 phases (shipped)

## Accumulated Context

### Key decisions

- Permissions: src/lib/permissions.ts single source of truth
- Soft-delete via deletedAt/deletedBy, filtered via composite index (v2.0)
- ffmpeg Hobby caps: 60s / 2048 MB; clip cap 45s
- v2.0: Firestore `jobs` collection tracks probe/sprite/thumbnail/export lifecycle
- v2.0: signed URLs cached on asset doc with 30-min expiry check
- v2.0: all stack mutations run under runTransaction (no more batch races)
- v2.0: review-link passwords stored as bcrypt hash with transparent legacy migration
- v2.0: composite indexes on assets(projectId,folderId,deletedAt), folders(projectId,parentId,deletedAt), comments(assetId,parentId,createdAt)
- v2.0: commentCount denormalized onto asset doc
- v2.0: folder ancestry via Folder.path[] (O(1), no parentId walk)

### Recently shipped

- v2.0 Architecture Hardening (7 phases, shipped 2026-04-21)

### Operational follow-ups

- **Deploy Firestore indexes:** `firebase deploy --only firestore:indexes` — routes gracefully fallback with console.warn until deployed
- **Review-link passwords:** self-migrate plaintext → bcrypt on first verify (transparent)
- **No migration scripts needed** for any other v2.0 change

### Pending Todos

None — v2.0 shipped. Deep audit backlog fully addressed.

### Blockers/Concerns

- IDX-02 commentCount on pre-v2.0 assets will be 0 until a comment mutation increments it. No backfill script shipped (pragma — assets with 0 comments aren't visually broken, badge just hidden on old docs until next mutation).
- First verify of a plaintext review-link password is slightly slower (one extra write to hash it) — transparent to the user.

## Session Continuity

Last session: 2026-04-21
Stopped at: v2.0 shipped end-to-end — 4 milestones shipped in this multi-session sprint (v1.7 → v2.0)
Resume file: None
