# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.3 — Video Review Polish

**Shipped:** 2026-04-08
**Phases:** 6 (23–28) | **Plans:** 8 | **Files changed:** 56 (+6,074 / -64 LOC)

### What Was Built

- SMPTE timecode frame-accuracy fix — bypassing the rAF threshold for discrete seeks
- Safe zones opacity slider — conditional, resets predictably on zone change
- Comment count badge in grid view — zero extra API calls, 99+ cap
- File info tab in asset viewer sidebar — 10 metadata fields, uploader name resolved via `useUserNames`
- Synchronized comparison modal — shared play/pause, scrubber, per-side audio toggle; reuses existing signed URLs
- Drag-and-drop version stacking — dual MIME type, accent border highlight, atomic Firestore batch merge

### What Worked

- **Existing hook reuse** — `useUserNames` was already in the codebase for list view; importing it directly solved uploader name display in FileInfoPanel with zero new code
- **Parallel Promise.all** — running `captureThumbnail` and `extractVideoMetadata` together in the upload flow kept the UX fast
- **Dual MIME type pattern** — setting both `application/x-frame-move` and `application/x-frame-version-stack` on drag start was clean; handlers can distinguish intent without any ambiguity or changes to existing folder-move logic
- **No new packages** — all 6 features shipped using existing browser APIs (requestVideoFrameCallback, HTML5 DnD, HTMLVideoElement) and existing repo code

### What Was Inefficient

- **FPS gap closure** — Phase 26's executor used `(asset as any).fps` instead of adding `frameRate` to the Asset interface; required a gap closure plan (26-02) to fix the type cast. Simpler to have the right type from the start.
- **Video metadata empty on existing assets** — `duration`/`resolution`/`aspect ratio` fields were missing for existing uploaded assets because the upload flow didn't capture them. The fix was added post-phase rather than caught during planning.

### Patterns Established

- **Discrete seeks need explicit state sync** — frame-step, keyboard shortcuts, and any operation that jumps `currentTime` by less than the rAF threshold must call `setCurrentTime` + `onTimeUpdate` directly after. Do not rely on the rAF loop for sub-threshold jumps.
- **Belt-and-suspenders upload guard for drop targets** — both the UI component (`isUploading` prop → `undefined` handler) and the parent handler (`status !== 'ready'` check) must block drops independently
- **`e.stopPropagation()` in drop handlers** — required whenever the drop container is inside a component that also handles OS file-upload drops; without it the OS handler fires too

### Key Lessons

1. When a feature reads a new field from an asset, add it to the Asset interface *before* writing the component — not after
2. Run `extractVideoMetadata` at upload time, not lazily; once the file is gone the metadata is gone
3. Version group operations must be atomic Firestore batches — individual PUTs risk version number collisions under concurrent merges

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v1.2 | 22 | Established worktree-based parallel execution, dual-remote push pattern |
| v1.3 | 6 | Smaller scope, tighter feature set; post-phase fixes still needed for type coverage |

### Top Lessons (Verified Across Milestones)

1. Type the data model first — `(as any)` casts in components always come back as gap closure plans
2. Reuse existing hooks before building new ones — the codebase already has patterns for most common data needs
3. Atomic writes for anything that touches multiple Firestore docs — batches prevent partial-state bugs that are hard to reproduce
