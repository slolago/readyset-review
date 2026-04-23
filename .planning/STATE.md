---
gsd_state_version: 1.0
milestone: v2.4
milestone_name: Meta XMP Stamping on Delivery
status: defining_requirements
stopped_at: Milestone v2.4 started; defining requirements
last_updated: "2026-04-23T12:00:00.000Z"
last_activity: 2026-04-23
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-23)

**Core value:** Fast, accurate video review
**Current focus:** v2.4 — stamp Meta XMP attribution on review-link assets

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-23 — Milestone v2.4 started

## Accumulated Context

### Key decisions carried forward

- `ContextMenuProvider` + singleton menu state (v2.2) + `RenameController` scope narrowing (v2.3 Phase 77) — pattern for any future react context with high-cardinality consumers
- `Skeleton` and `ModalSkeleton` primitives live in `src/components/ui/` — reuse across future loading states
- Dynamic-import pattern: `dynamic(() => import('...').then(m => m.Named), { ssr: false, loading: () => <ModalSkeleton /> })` for heavy, user-triggered modals
- Optimistic state pattern in `useComments` (tempId + reconciliation + 3-path rollback) is the template for future optimistic mutations
- Cursor-based pagination contract: `?limit=N&cursor=id` → `{ items, nextCursor }` — apply to future admin/list endpoints
- Generalized `Job` model + `src/lib/jobs.ts` lifecycle helpers (v2.0 Phase 60) — stamping jobs plug into the same collection and status machine
- Signed URL cache at `src/lib/signed-url-cache.ts` (v2.0 Phase 62) — `getOrCreateSignedUrl` handles cache + regenerate logic; stamped URLs use the same helper

### v2.4 reference materials

- `scf-metadata` Electron source (reference implementation): `C:\Users\Lola\AppData\Local\scf-meta\app-0.11.9\resources\app`
  - `src/backend/exiftool.js` — the exact 60-line class replicate 1:1
  - `public/exiftool/.config` — XMP namespace schema (must copy verbatim into our repo)
  - `package.json` — uses `exiftool-vendored@^14.0.0` + `dayjs@^1.10.4`
- XMP atom location in MP4: `uuid` box with UUID `be7acfcb97a942e89c71999491e3afac` (standard Adobe XMP)
- Hardcoded constants per the app: `FbId = 2955517117817270`, `Data = '{"Company":"Ready Set"}'`
- Before/after sample files (user-provided): `C:\Users\Lola\Documents\RS_RPLT_D001_C005_WalkThroughUGC_NEW_V01_VID_9x16.mp4` vs `C:\Users\Lola\Downloads\RS_RPLT_D001_C005_WalkThroughUGC_NEW_V01_VID_9x16.mp4` — 5077 byte diff = XMP payload injection

### Recently shipped

- v2.3 App-Wide Performance Polish (5 phases, shipped 2026-04-22)
- v2.2 Dashboard & Annotation UX Fixes (4 phases, shipped 2026-04-21)
- v2.1 Dashboard Performance (3 phases, shipped 2026-04-21)

### Operational state

- **Pending:** `firebase deploy --only firestore:indexes` — activates new `comments(assetId, reviewLinkId)` composite index from v2.3. Existing in-memory fallback keeps `/api/comments` correct until deployed.
- Firestore composite indexes deployed (v1.9 + v2.0 + v2.1 batches live)
- Review-link passwords auto-migrate plaintext → bcrypt on first verify (v2.0)
- collaboratorIds backfilled on 18 existing projects (v2.1)

### Pending Todos

None — v2.3 shipped end-to-end. v2.4 requirements being defined.

### Blockers/Concerns

- Vercel bundle size verification needed on first v2.4 deploy — `exiftool-vendored` adds ~30MB; should fit within 250MB uncompressed limit but must confirm. Fallback plan: move stamp job to Cloud Run if bundle exceeds.

## Session Continuity

Last session: 2026-04-23
Stopped at: v2.4 milestone scaffolding; requirements next
Resume file: None
