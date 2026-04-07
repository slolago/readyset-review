---
phase: 15-dashboard-and-storage
plan: "02"
subsystem: files/storage
tags: [api, folder-browser, storage, ui]
dependency_graph:
  requires: []
  provides: [GET /api/assets/size, FolderBrowser size badge]
  affects: [src/components/files/FolderBrowser.tsx]
tech_stack:
  added: []
  patterns: [BFS folder traversal, fetch-in-useEffect keyed on folderId]
key_files:
  created:
    - src/app/api/assets/size/route.ts
  modified:
    - src/components/files/FolderBrowser.tsx
decisions:
  - "Assets at the project root (folderId === null) are only included in the total when no folderId param is given — folder-scoped queries use BFS to walk parentId relationships and root assets are correctly excluded."
  - "folderSizeLoading flag prevents stale size flashing during navigation; badge resets to null immediately on folderId change."
metrics:
  duration: "~8 minutes"
  completed: "2026-04-07"
  tasks_completed: 2
  files_modified: 2
---

# Phase 15 Plan 02: Folder Size Badge Summary

Recursive folder storage size API + FolderBrowser header badge using BFS folder traversal and formatBytes.

## What Was Built

**Task 1 — GET /api/assets/size**

New route at `src/app/api/assets/size/route.ts`. Accepts `projectId` (required) and `folderId` (optional). When `folderId` is provided, fetches all folders for the project and walks `parentId` relationships using a BFS fixed-point loop to collect all descendant folder IDs. Then sums the `size` field of all assets whose `folderId` is in the scoped set. When `folderId` is absent, sums all project assets. Returns `{ sizeBytes: number }`.

Auth pattern mirrors `src/app/api/assets/route.ts` — uses `getAuthenticatedUser` and `canAccessProject`.

**Task 2 — FolderBrowser size badge**

Added `folderSize` and `folderSizeLoading` state to `FolderBrowser`. A `useEffect` keyed on `[projectId, folderId, getIdToken]` resets the badge to null (hiding it during navigation), then fetches the size API with a bearer token and sets the result. The header's `<Breadcrumb>` is now wrapped in a flex div that also renders a `<span>` showing `formatBytes(folderSize)` once loading completes and `folderSize > 0`.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check

- [x] `src/app/api/assets/size/route.ts` exists
- [x] `src/components/files/FolderBrowser.tsx` contains `formatBytes(folderSize`
- [x] Commit `17192930` exists
- [x] `npx next lint --quiet` passes with no errors
- [x] `npx tsc --noEmit` passes with no errors
