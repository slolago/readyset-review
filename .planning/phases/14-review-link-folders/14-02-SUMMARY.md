---
phase: 14-review-link-folders
plan: 02
subsystem: sidebar-navigation
tags: [sidebar, navigation, review-links, lucide-react]
dependency_graph:
  requires: [14-01]
  provides: [sidebar-review-links-entry]
  affects: [ProjectTreeNav]
tech_stack:
  added: []
  patterns: [lucide-react icon alias, pathname.startsWith active state]
key_files:
  created: []
  modified:
    - src/components/layout/ProjectTreeNav.tsx
decisions:
  - Gate Review Links entry on foldersLoaded to avoid layout jump during project expand
  - Alias lucide Link as LinkIcon to avoid collision with Next.js Link component
metrics:
  duration: ~5m
  completed: 2026-04-07T12:48:30Z
  tasks_completed: 1
  files_modified: 1
---

# Phase 14 Plan 02: Review Links Sidebar Entry Summary

**One-liner:** Added a "Review Links" leaf to each expanded project in the sidebar using a LinkIcon with pathname.startsWith active state.

## What Was Done

Single file edit to `src/components/layout/ProjectTreeNav.tsx`:

1. Added `Link as LinkIcon` to the existing lucide-react import (aliased to avoid collision with Next.js `Link`).
2. Appended a Review Links `<Link>` element inside the expanded project block, after the folders-list ternary, gated on `foldersLoaded` so it appears only once the project is fully loaded (no layout jump during spinner phase).

The entry uses:
- `href={/projects/${project.id}/review-links}` for navigation
- `pathname.startsWith(...)` for active state highlighting
- Same indentation (pl-6), padding, font size, and hover/active Tailwind classes as folder rows for visual consistency

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npx next lint --quiet` — passed with no warnings or errors
- All done criteria met: LinkIcon imported, href points to review-links, active state uses pathname.startsWith

## Self-Check

- [x] `src/components/layout/ProjectTreeNav.tsx` modified with both changes
- [x] Commit `56ddfa67` exists: "feat(14-02): add Review Links entry to project sidebar navigation"
- [x] Lint passes clean
