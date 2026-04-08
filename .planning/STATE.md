---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Video Review Polish
status: milestone complete — planning next milestone
stopped_at: v1.3 milestone archived
last_updated: "2026-04-08T14:30:00.000Z"
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 8
  completed_plans: 8
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-08)

**Core value:** Fast, accurate video review — frame-level precision, rich metadata, and fluid version management
**Current focus:** Planning next milestone

## Current Phase

None — v1.3 complete

## Status

v1.3 "Video Review Polish" shipped. 6 phases, 8 plans, 56 files changed.

## Decisions

- Push to both origin (readyset-review) and vercel (readyset-review-vercel) after each phase
- Use application/x-frame-move MIME type (not text/plain) so container drag handlers can distinguish internal item drags from OS file/folder drops
- Dual MIME type on drag start (x-frame-move + x-frame-version-stack) for version stacking
- frameRate stored as optional number on Asset interface — absent for legacy assets; FPS row shows dash when not present
- Belt-and-suspenders upload guard: AssetCard passes undefined for onDragOver when isUploading; FolderBrowser also checks status !== 'ready'
- e.stopPropagation() in handleAssetDrop prevents bubbling to OS file-upload container drop handler
- isDropTarget placed before isSelected in className ternary — drop target highlight has higher visual priority
- Atomic Firestore batch for version group merge — prevents collision under concurrency

## Blockers

(none)
