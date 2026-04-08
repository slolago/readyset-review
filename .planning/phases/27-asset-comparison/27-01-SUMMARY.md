---
phase: 27-asset-comparison
plan: "01"
name: asset-comparison
subsystem: files
tags: [comparison, modal, video, sync]
dependency_graph:
  requires: [26-file-info-tab]
  provides: [asset-comparison-modal]
  affects: [FolderBrowser, AssetCompareModal]
tech_stack:
  added: []
  patterns: [synchronized-video-refs, iife-in-jsx]
key_files:
  created:
    - src/components/files/AssetCompareModal.tsx
  modified:
    - src/components/files/FolderBrowser.tsx
    - src/hooks/useAssets.ts
decisions:
  - IIFE pattern used in JSX to derive selectedAssets/canCompare inline — avoids redundant component-level variable that only matters inside the action bar
  - audioSide state initialized to 'A' — left panel has audio by default; toggle switches to right
  - selectedIds not cleared on modal close so user can re-open comparison without re-selecting
metrics:
  duration: "3 min"
  completed_date: "2026-04-08"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 27 Plan 01: Asset Comparison Modal Summary

**One-liner:** Full-screen side-by-side asset comparison modal with synchronized play/pause, shared scrubber, and per-side audio toggle — triggered from multi-select toolbar when exactly 2 assets are selected.

## What Was Built

### AssetCompareModal (`src/components/files/AssetCompareModal.tsx`)

New component accepting `assetA`, `assetB`, and `onClose`. Renders a fixed full-screen overlay (`z-50`) with:
- Two flex panels side-by-side, each showing asset name + `<video>` or `<img>`
- `videoARef` / `videoBRef` — direct refs for synchronization without React state round-trips
- `isPlaying` state driving `play()`/`pause()` calls on both elements simultaneously
- Shared scrubber (`<input type="range">`) writing `currentTime` directly to both video elements
- `audioSide: 'A' | 'B'` state controlling `muted` on each video; toggle button switches sides
- Keyboard handler: Space toggles play/pause, Escape closes modal
- `timeupdate` on videoA updates scrubber; `loadedmetadata` sets duration

### FolderBrowser (`src/components/files/FolderBrowser.tsx`)

- Imported `AssetCompareModal` and `GitCompare` from lucide-react
- Added `showCompareModal` state
- In the multi-select action bar: Compare button (accent color when enabled, grayed when disabled) with `disabled` prop and tooltip matching requirements P27-01 and P27-02
- Modal rendered via IIFE in JSX that re-derives `selectedAssets` and `canCompare` to avoid stale closure

## Requirements Coverage

| Requirement | Status |
|-------------|--------|
| P27-01 Compare button when exactly 2 assets selected | Done |
| P27-02 Compare button disabled with tooltip otherwise | Done |
| P27-03 Full-screen modal side-by-side | Done |
| P27-04 Asset name above each panel | Done |
| P27-05 Shared Play/Pause button | Done |
| P27-06 Shared scrubber/timeline | Done |
| P27-07 Audio toggle between sides | Done |
| P27-08 Exit (X) button closes modal | Done |
| P27-09 Reuses existing signedUrl — no extra API calls | Done |
| P27-10 Space bar toggles play/pause | Done |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed videoMeta type missing frameRate field in useAssets.ts**
- **Found during:** Task 2 (TypeScript build check)
- **Issue:** `videoMeta` variable typed as `{ width, height, duration }` but `extractVideoMetadata` returns `{ ..., frameRate?: number }`. TypeScript error TS2339 on line 298.
- **Fix:** Updated `videoMeta` type annotation to include `frameRate?: number`
- **Files modified:** `src/hooks/useAssets.ts`
- **Commit:** d901575d

## Known Stubs

None — the modal wires directly to `(asset as any).signedUrl` which is the runtime-populated field from the API response, matching the existing pattern used throughout AssetCard and AssetListView.

## Self-Check

Files exist:
- `src/components/files/AssetCompareModal.tsx` — FOUND
- `src/components/files/FolderBrowser.tsx` — FOUND (modified)

Commits exist:
- b6de64b6 — feat(27-01): create AssetCompareModal component
- d901575d — feat(27-01): add Compare button to multi-select toolbar in FolderBrowser

TypeScript: `npx tsc --noEmit` — PASSED (0 errors)
