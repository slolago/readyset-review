---
phase: 13
plan: 03
subsystem: review-page
tags: [guest-read-only, asset-card, ux, review-links]
dependency_graph:
  requires: []
  provides: [hideActions-prop-on-AssetCard]
  affects: [review-page-guest-ux]
tech_stack:
  added: []
  patterns: [conditional-prop-guard]
key_files:
  created: []
  modified:
    - src/components/files/AssetCard.tsx
    - src/app/review/[token]/page.tsx
decisions:
  - hideActions prop instead of separate GuestAssetCard component — minimal diff, no duplication
metrics:
  duration: 5m
  completed: "2026-04-07"
  tasks_completed: 1
  files_modified: 2
---

# Phase 13 Plan 03: Guest Read-Only on Review Page Summary

Hid three-dot Dropdown and right-click ContextMenu on AssetCard when `hideActions` is true; review page always passes `hideActions` so guests never see Rename/Delete/Duplicate/Upload actions.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add hideActions prop to AssetCard and pass it from review page | 434d4d26 | AssetCard.tsx, page.tsx |

## Decisions Made

- Used `hideActions?: boolean` prop on the existing `AssetCard` rather than a separate guest-only component — minimises diff and avoids prop duplication.
- `onContextMenu` is set to `undefined` (not just an early-return) so no context-menu event fires at all when `hideActions` is true.
- Download button in the review page's `.map()` wrapper is outside `AssetCard` and is intentionally untouched — it is controlled by `allowDownloads` flag as designed in plan 13-01.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `src/components/files/AssetCard.tsx` — contains `hideActions` at lines 26, 29, 201, 309
- `src/app/review/[token]/page.tsx` — contains `hideActions` at line 342
- Commit `434d4d26` exists in git log
