---
phase: 33-selection-review-links
plan: 01
subsystem: api
tags: [review-links, firestore, nextjs, typescript]

# Dependency graph
requires: []
provides:
  - assetIds field on ReviewLink Firestore schema and TypeScript interface
  - POST /api/review-links stores assetIds, nulls folderId, enforces 50-asset cap
  - GET /api/review-links/[token] branches on assetIds using Promise.all(getDoc), returns _deleted placeholders
  - CreateReviewLinkModal accepts assetIds prop and forwards it in POST body with asset count UI
affects: [33-02, review-link-consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Promise.all(getDoc) per-ID fetch instead of Firestore in query (avoids 30-item cap)
    - folderId nulled on server when assetIds present (prevents incorrect query branch)
    - _deleted placeholder for missing assets in selection links

key-files:
  created: []
  modified:
    - src/types/index.ts
    - src/app/api/review-links/route.ts
    - src/app/api/review-links/[token]/route.ts
    - src/components/review/CreateReviewLinkModal.tsx

key-decisions:
  - "Promise.all(getDoc) used instead of Firestore in query — in is capped at 30 items"
  - "folderId explicitly nulled by server when assetIds present — prevents GET handler falling into folder-scoped query branch"
  - "Selection links skip version-grouping entirely — return exactly the assets user selected"
  - "Deleted/missing assets return _deleted:true placeholder instead of crashing"

patterns-established:
  - "Selection-scoped links: assetIds present + folderId null — GET handler branches on this invariant"
  - "Version-grouping is a folder/project-scoped concern only — selection links bypass it"

requirements-completed: [REVIEW-03]

# Metrics
duration: 12min
completed: 2026-04-08
---

# Phase 33 Plan 01: Selection Review Links — Data Model & API Summary

**assetIds field added to ReviewLink schema with POST storage, 50-asset cap, GET per-ID fetch via Promise.all(getDoc), _deleted placeholders, and CreateReviewLinkModal assetIds prop forwarding**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-08T00:00:00Z
- **Completed:** 2026-04-08T00:12:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- ReviewLink TypeScript interface extended with `assetIds?: string[]` field after folderId
- POST handler now accepts, validates (<=50 cap), and stores assetIds; nulls folderId when assetIds present
- GET handler branches: selection-scoped links use `Promise.all(getDoc)` per-ID fetch, return `_deleted: true` for missing assets, skip version-grouping, return empty folders array
- CreateReviewLinkModal accepts optional `assetIds` prop, includes it in POST body, shows "N selected assets" info text

## Task Commits

Each task was committed atomically:

1. **Task 1: Add assetIds to ReviewLink type + extend POST handler** - `a05278f0` (feat)
2. **Task 2: Branch GET handler for assetIds + extend CreateReviewLinkModal** - `534b34ee` (feat)

**Plan metadata:** (docs commit — pending)

## Files Created/Modified

- `src/types/index.ts` - Added `assetIds?: string[]` to ReviewLink interface
- `src/app/api/review-links/route.ts` - Destructures assetIds, 50-asset cap guard, stores with null folderId override
- `src/app/api/review-links/[token]/route.ts` - Branched GET handler with Promise.all(getDoc) path for selection links
- `src/components/review/CreateReviewLinkModal.tsx` - Added assetIds prop, fetch body forwarding, asset count info text

## Decisions Made

- Promise.all(getDoc) instead of Firestore `in` query: Firestore `in` is capped at 30 items; per-ID fetch has no limit and aligns with STATE.md mandate
- folderId nulled by server when assetIds present: ensures GET handler cannot accidentally fall into folder-scoped query branch even if client sends both
- Version-grouping skipped for selection links: selection links represent a curated user choice — applying version-grouping would silently drop user-selected versions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Data model and API plumbing complete for selection-scoped review links
- Plan 33-02 can wire the UI caller (asset selection + CreateReviewLinkModal invocation with assetIds)
- No blockers

---
*Phase: 33-selection-review-links*
*Completed: 2026-04-08*
