---
phase: 48
plan: 01
subsystem: viewer+navigation
tags: [viewer, video-player, loop, selection, ui-polish]
requirements: [PLAY-01, UX-01]
autonomous: false
key-files:
  created:
    - src/lib/selectionStyle.ts
  modified:
    - src/components/viewer/VideoPlayer.tsx
    - src/components/viewer/CommentSidebar.tsx
    - src/app/(app)/projects/[projectId]/assets/[assetId]/page.tsx
    - src/app/review/[token]/page.tsx
    - src/components/files/AssetCard.tsx
    - src/components/files/FolderBrowser.tsx
    - src/components/projects/ProjectCard.tsx
    - src/components/layout/ProjectTreeNav.tsx
decisions:
  - Lifted in/out range state from CommentSidebar to both viewer parents (internal + review link). CommentSidebar supports both controlled (parent-owned) and uncontrolled (local) modes via prop detection, preserving back-compat.
  - Loop state owned by VideoPlayer (per-session, resets via useEffect on asset.id). asset.id includes version because the viewer page keys VideoPlayer on displayAsset.id, so version switches remount and reset loop implicitly.
  - Loop enforcement uses two paths: rAF tick clamps mid-playback crossings of loopOut → loopIn; onEnded handles the case when no range is set or playback reached the natural end.
  - One-cycle grace for user-initiated seeks outside the range implemented via insideRangeRef (rAF tracks wasInside/isInside). If user seeks outside → inside → across loopOut, the clamp fires; if they seek outside → outside, onEnded handles the wrap instead.
  - selectionStyle returns a base 'border' class always present so idle ↔ selected transitions don't shift layout.
  - AssetCard and FolderCard preserve isDropTarget as a ring-2 override that stacks on top of the selectionStyle classes, keeping the established visual priority (drop target > selection).
  - ProjectTreeNav: project row uses `parent-of-selected` (dashed accent) when pathname is under the project but not the project page itself; solid `selected` when on the project page exactly.
metrics:
  duration: ~25 min
  completed: 2026-04-20
---

# Phase 48 Plan 01: Playback Loop and Selection Hierarchy — Summary

**One-liner:** Per-session video loop toggle (whole-video or in/out range) with one-cycle seek grace, and a `selectionStyle` helper that consistently renders selected / hovered / focused / parent-of-selected states across project → folder → asset grid cards and the sidebar project tree.

## What Changed

### Loop feature (PLAY-01)
- **Lifted** in/out range state from `CommentSidebar` into both viewer parents:
  - `src/app/(app)/projects/[projectId]/assets/[assetId]/page.tsx`
  - `src/app/review/[token]/page.tsx`
  - CommentSidebar accepts optional `inPoint`, `outPoint`, `onInPointChange`, `onOutPointChange`. When both callbacks are provided it operates controlled; otherwise it falls back to local state (back-compat).
- **VideoPlayer** gains `loopIn?`, `loopOut?` props, a `loop` boolean state (per-session, resets on `asset.id` change), and a `Repeat` icon toggle in the controls row (between the background-color picker and the speed selector).
- Enforcement:
  - `onEnded` → if `loop` is on, seek to `loopIn` (if defined) else 0, then resume playback.
  - rAF tick → when loop is on and both bounds are defined, snap `currentTime` back to `loopIn` when playback crosses `loopOut` while staying inside the range. Tracks `insideRangeRef` so seeks that originate outside the range don't immediately snap — giving the required one-cycle grace.

### Selection hierarchy (UX-01)
- **New** `src/lib/selectionStyle.ts` exporting `selectionStyle(level, state)` plus `SelectionLevel` and `SelectionState` types. Pure Tailwind-class helper, no React deps.
- Applied to:
  - `AssetCard` — replaces the old isUploading/isDropTarget/isSelected ternary. Drop-target `ring-2` preserved as a stacked override so it still dominates plain selection.
  - `FolderCard` (inside `FolderBrowser.tsx`) — same pattern.
  - `ProjectCard` — idle state only (projects have no checkbox selection today).
  - `ProjectTreeNav` — project row reads `parent-of-selected` (dashed accent) when a child folder/asset is open, `selected` when on the project root, `idle` otherwise. Folder rows use `selected` when active.

## Deviations from Plan

**None.** Plan executed exactly as written. One minor clarification captured in decisions: CommentSidebar keeps local state as a fallback when parent doesn't pass both onInPointChange + onOutPointChange — this keeps the component reusable in case a future viewer doesn't need loop integration, without adding extra required props.

## Known Stubs

None. Loop + selection hierarchy are fully wired with no placeholder data.

## Commits

- `dd3afbed` feat(48-01): task 1 — lift in/out range + loop state plumbing
- `0d681cac` feat(48-01): task 2 — loop toggle button + whole-video enforcement
- `5e936540` feat(48-01): task 3 — range-aware loop clamp with one-cycle grace
- `0a998b7b` feat(48-01): task 4 — selectionStyle helper
- `d267d03c` feat(48-01): task 5 — apply selectionStyle to grid cards
- `07bfd2e1` feat(48-01): task 6 — sidebar tree parent-of-selected indicator

## Verification

- `npx tsc --noEmit` clean after every task.
- Manual 15-point checklist is in `48-VERIFICATION.md` — **human_needed** (Task 7 checkpoint).

## Self-Check: PASSED

- `src/lib/selectionStyle.ts` exists (new file)
- All commits present in `git log`
- Loop button renders in VideoPlayer controls row
- CommentSidebar accepts controlled in/out props in both viewer parents
