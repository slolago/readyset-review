# Milestones

## v1.3 Video Review Polish (Shipped: 2026-04-08)

**Phases completed:** 6 phases (23–28), 8 plans
**Files changed:** 56 files, +6,074 / -64 lines
**Timeline:** 2026-04-07 → 2026-04-08

**Key accomplishments:**

1. Fixed SMPTE timecode frame digit freezing on frame-step — direct `setCurrentTime` call bypasses the 0.25s rAF threshold in `VideoPlayer.tsx`
2. Added opacity slider to safe zones overlay — slider shows only when a zone is active, resets to 100% on zone change
3. Comment count badge on grid cards — `MessageSquare` icon + "99+" cap, reads `_commentCount` from existing API response (zero API calls)
4. File info tab in asset viewer sidebar — Comments/Info tab bar; `FileInfoPanel` shows 10 metadata fields (filename, type, size, duration, resolution, aspect ratio, FPS, uploader name, date, version)
5. Synchronized asset comparison modal — select 2 assets → full-screen side-by-side with shared play/pause, shared scrubber, and per-side audio toggle
6. Drag-and-drop version stacking — drag asset A onto B merges A's entire version group into B's stack via atomic Firestore batch write; accent border highlight, toast confirmation, grid refresh

**New files:** `FileInfoPanel.tsx`, `AssetCompareModal.tsx`, `POST /api/assets/merge-version`

---

## v1.2 Feature Expansion (Shipped: 2026-04-07)

22 phases shipped. See [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) for full details.

---
