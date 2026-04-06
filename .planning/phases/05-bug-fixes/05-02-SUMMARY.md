---
phase: 05-bug-fixes
plan: 02
subsystem: ui
tags: [react, upload, xhr, hooks, video, typescript]

# Dependency graph
requires: []
provides:
  - clearCompleted only removes terminal (complete/error) uploads, preserving in-progress entries
  - captureThumbnail timeout reduced from 15s to 5s, eliminating long stall on second video
  - XHR error log messages include filename for easier production diagnosis
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "clearCompleted filters by status rather than wiping all uploads"

key-files:
  created: []
  modified:
    - src/hooks/useAssets.ts
    - src/components/files/FolderBrowser.tsx

key-decisions:
  - "clearCompleted filters to uploading/pending status instead of setUploads([])"
  - "captureThumbnail timeout reduced to 5s — done() cleanup path already correct via settled guard"
  - "Dismiss button renamed to 'Clear completed' to accurately reflect new behavior"

patterns-established:
  - "Upload state mutations filter by terminal states to avoid wiping in-flight entries"

requirements-completed: [REQ-B02]

# Metrics
duration: 5min
completed: 2026-04-06
---

# Phase 5 Plan 2: Fix upload stuck at "Uploading..." for subsequent uploads

**Upload state fixes: clearCompleted preserves in-progress uploads, 5s thumbnail timeout eliminates visible stall on second video**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-06T06:32:23Z
- **Completed:** 2026-04-06T06:37:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- `clearCompleted` now filters by status so only terminal (complete/error) entries are removed; in-progress uploads survive a "Clear completed" click
- `captureThumbnail` timeout reduced from 15 seconds to 5 seconds, eliminating the user-visible stall where the second video upload appeared stuck
- XHR error log messages enriched with `file.name` and `[upload]` prefix for production diagnostics

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix clearCompleted + rename button** - `65ab0a0` (fix)
2. **Task 2: Reduce captureThumbnail timeout to 5s** - `2ace8ec` (fix)
3. **Task 3: Add filename to XHR error logs** - `3182d18` (fix)

## Files Created/Modified
- `src/hooks/useAssets.ts` - clearCompleted filter, captureThumbnail timeout reduction, XHR error log improvements
- `src/components/files/FolderBrowser.tsx` - button label "Dismiss" -> "Clear completed"

## Decisions Made
- `clearCompleted` filters `uploading | pending` status rather than wiping `uploads` entirely — matches user expectation that dismissing completed uploads does not cancel in-flight ones
- `captureThumbnail` timeout set to 5s (from 15s) — done() already calls `video.src = ''` and `URL.revokeObjectURL` via idempotent `settled` guard, so no additional cleanup was needed
- "Dismiss" renamed to "Clear completed" to communicate the new selective behavior to users

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Upload UX is cleaner: in-progress uploads are never accidentally wiped by the dismiss action
- Second video uploads will no longer appear stuck for up to 15 seconds during thumbnail capture
- Production logs will now include filenames in upload error messages for faster diagnosis

---
*Phase: 05-bug-fixes*
*Completed: 2026-04-06*
