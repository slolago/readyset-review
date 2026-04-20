---
gsd_state_version: 1.0
milestone: v1.8
milestone_name: Asset Pipeline & Visual Polish
status: active
stopped_at: Roadmap created — Phase 49 (metadata-accuracy) ready for /gsd:plan-phase 49
last_updated: "2026-04-20T00:00:00.000Z"
last_activity: 2026-04-20
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-20)

**Core value:** Fast, accurate video review — frame-level precision, rich metadata, and fluid version management
**Current focus:** v1.8 Asset Pipeline & Visual Polish — Phase 49 (metadata-accuracy) up next

## Current Position

Phase: Phase 49 (metadata-accuracy) — Not started
Plan: —
Status: Roadmap created, awaiting /gsd:plan-phase 49
Last activity: 2026-04-20 — v1.8 roadmap written (5 phases, 49–53; 18 requirements)

Progress: [░░░░░░░░░░] 0% (0/5 phases)

## Performance Metrics

**Velocity:**

- v1.3: 9 plans across 6 phases
- v1.4: 7 plans across 5 phases
- v1.5: 9 plans across 8 phases
- v1.6: archived, never executed
- v1.7: 6 plans across 6 phases (shipped 2026-04-20)
- Trend: Stable

## Accumulated Context

### Decisions

- Push to both origin (readyset-review) and vercel (readyset-review-vercel) after each phase
- reviewStatus (not status) is the QC field — status is the upload lifecycle field (uploading | ready)
- Atomic Firestore batch for version group merge (established v1.3)
- Dual MIME type on drag start for version stacking (established v1.3)
- FPS stored as frameRate on Asset, measured via requestVideoFrameCallback — v1.5 snaps to standard rates
- VU meter AnalyserNode must tap BEFORE GainNode to measure source signal
- Video.js does not reset audio track on src() change — use player.muted() for per-side audio toggle
- Platform admin (user.role === 'admin') is the single gate for safe-zones CRUD; project roles do not apply to global resources
- requireAdmin is strict equality, not role-rank — managers can't admin (confirmed 2026-04-20)
- Session endpoint rejects uninvited Google signins; first-admin bootstrap preserved via _system/first-admin guard doc
- v1.7: Permissions module (src/lib/permissions.ts) is the single source of truth for role matrices across platform + project + review-link
- v1.7: version-groups helper (src/lib/version-groups.ts) handles legacy-root resolution for all stack mutations
- v1.7: ffmpeg export pipeline — MP4 (copy + re-encode fallback), GIF (two-pass palette, 480p/12fps default); ffmpegPath resolver in src/lib/ffmpeg-resolve.ts
- v1.7: Confirm dialogs go through ConfirmProvider/useConfirm (no more window.confirm)
- v1.7: Player bg color + VU-meter toggle persist in localStorage (keys: player-bg, player-vumeter)

### Recently Shipped (ad-hoc, post-v1.7)

- 2026-04-20: In-app ConfirmDialog replaces browser confirm across all delete flows
- 2026-04-20: ProjectTreeNav sidebar redesigned — tree-view convention, no per-row borders
- 2026-04-20: Export GIF single-frame bug fix (palette input duration binding)
- 2026-04-20: Export client resilient to non-JSON Vercel edge responses
- 2026-04-20: Range comment composer UX — banner + grouped IN/OUT with scissors icon
- 2026-04-20: I / O keyboard shortcuts for range in/out
- 2026-04-20: Export timeout mitigations — maxDuration 300s, ultrafast preset, vercel.json, lighter GIF defaults
- 2026-04-20: ConfirmDialog long-filename wrap + gradient accent removed on destructive dialogs

### Pending Todos

None — ready for /gsd:plan-phase 49.

### Blockers/Concerns

- Vercel plan detection — maxDuration=300 only applies on Pro; Hobby clamps to 60s. Confirm plan before declaring export timeouts resolved.
- Phase 49 depends on understanding the current upload pipeline's image vs video branching (or lack thereof).

## Session Continuity

Last session: 2026-04-20
Stopped at: v1.8 milestone scaffolded (5 phases, 18 requirements); ready for /gsd:plan-phase 49
Resume file: None
