---
gsd_state_version: 1.0
milestone: v2.4
milestone_name: Meta XMP Stamping on Delivery
status: ready_to_plan
stopped_at: Roadmap created for v2.4 (Phases 79-82); ready to plan Phase 79
last_updated: "2026-04-23T12:00:00.000Z"
last_activity: 2026-04-23
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-23)

**Core value:** Fast, accurate video review
**Current focus:** v2.4 — Phase 79: platform-spike (verify perl + updatedAt + Data field before writing stamp code)

## Current Position

Phase: 79 of 82 (platform-spike)
Plan: —
Status: Ready to plan
Last activity: 2026-04-23 — Roadmap created, 4 phases (79-82), 13 REQs mapped

Progress: [░░░░░░░░░░] 0%

## Accumulated Context

### Key decisions carried forward

- Always-async stamp jobs (no sync threshold) — PITFALLS explicitly rejected the ARCHITECTURE.md N=3 sync split; Vercel 60s budget cannot safely absorb even 1 large-file stamp inline in a POST
- One stamped GCS copy per asset (`projects/{pid}/assets/{aid}/stamped{ext}`) — shared across all review links; stamp content is deterministic from asset name + hardcoded constants
- `stampedAt < updatedAt` invalidation (no boolean flag) — self-healing; requires `updatedAt` reliably written on rename + upload-complete (must verify in Phase 79)
- `et.end()` awaited in finally — no `-stay_open True` in serverless; per-request ExifTool instance with `maxProcs: 1, maxTasksPerProcess: 1`
- Streaming GCS upload for stamped files — `uploadBuffer()` OOMs on 500MB+ source; new `uploadStream()` helper needed
- `findOrCreateStampJob()` dedup pattern (query before create, idempotent second job) — from ARCHITECTURE.md §2f
- `coerceToDate()` at every timestamp comparison — from `src/lib/format-date.ts`; Firestore Timestamp vs ISO string silently breaks direct < / >
- Generalized Job model + `src/lib/jobs.ts` (v2.0 Phase 60) — stamp jobs plug in as `'metadata-stamp'` JobType with no infra changes
- Signed URL cache at `src/lib/signed-url-cache.ts` (v2.0 Phase 62) — `getOrCreateSignedUrl` handles stamped URLs identically to thumbnail/sprite

### v2.4 reference materials

- `scf-metadata` Electron source: `C:\Users\Lola\AppData\Local\scf-meta\app-0.11.9\resources\app`
  - `src/backend/exiftool.js` — exact Attrib append logic, field constants, -config, ExtId computation
  - `public/exiftool/.config` — XMP namespace schema (13-line Perl file, must copy verbatim)
- Hardcoded constants: `FbId = 2955517117817270`, `Data = '{"Company":"Ready Set"}'` (pipe-wrapping TBD — Phase 79 item c)
- Before/after sample files at `C:\Users\Lola\Documents\RS_RPLT_D001_C005_WalkThroughUGC_NEW_V01_VID_9x16.mp4` vs Downloads copy

### Phase 79 gate items (must all pass before Phase 80 starts)

- (a) Perl resolves on Vercel Pro Lambda — real deploy required
- (b) `updatedAt` written on rename (`PUT /api/assets/[assetId]`) AND upload-complete (`/api/upload/complete`) — code read + fix if absent
- (c) `Data` field exact literal value confirmed against a desktop-stamped file via `exiftool -Attrib:all`

### Pending Todos

None.

### Blockers/Concerns

- Phase 79 must ship before any stamp production code — Perl on Vercel is LOW confidence (no public confirmation)
- Fallback plan if Perl absent: move stamp job to Cloud Run; would require new infra outside this roadmap

## Session Continuity

Last session: 2026-04-23
Stopped at: Roadmap created; Phase 79 ready to plan
Resume file: None
