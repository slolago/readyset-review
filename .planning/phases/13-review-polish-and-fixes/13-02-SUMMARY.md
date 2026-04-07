---
phase: 13-review-polish-and-fixes
plan: "02"
subsystem: ui/dropdown
tags: [portal, dropdown, overflow-hidden, fixed-positioning, react-dom]
dependency_graph:
  requires: []
  provides: [portal-based-dropdown]
  affects: [AssetCard, ReviewPage, GridView, ListView]
tech_stack:
  added: [react-dom/createPortal]
  patterns: [portal-pattern, dual-ref-outside-click, getBoundingClientRect-positioning]
key_files:
  created: [.eslintrc.json]
  modified: [src/components/ui/Dropdown.tsx]
decisions:
  - Use createPortal to document.body with position:fixed to escape overflow-hidden ancestors
  - Dual-ref outside-click: check triggerRef AND panelRef before closing
  - Scroll listener uses capture:true to catch scroll events from nested scrollable containers
metrics:
  duration: "~10 minutes"
  completed: "2026-04-07T12:07:48Z"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 2
---

# Phase 13 Plan 02: Portal Dropdown Summary

One-liner: Rewrote Dropdown.tsx to use ReactDOM.createPortal with position:fixed coords from getBoundingClientRect(), escaping overflow-hidden clipping on AssetCard thumbnail wrappers.

## What Was Built

The `Dropdown` component previously rendered its panel as a `position: absolute` child of the trigger wrapper. The `AssetCard` thumbnail container (`<div className="relative aspect-video bg-black overflow-hidden">`) established a clipping context that cut off any absolutely-positioned descendants, making the three-dot menu invisible on review page asset cards.

The fix portals the panel to `document.body` via `createPortal`, computing `position: fixed` coordinates from `triggerRef.current.getBoundingClientRect()` at open time. This completely escapes the overflow-hidden ancestor.

## Key Implementation Details

**Two refs instead of one:**
- `triggerRef` — attached to the trigger wrapper div (replaces the old `ref`)
- `panelRef` — attached to the portaled panel div

**Position computation:**
- `top = rect.bottom + 6` (6px gap below trigger)
- `right = window.innerWidth - rect.right` when `align='right'`
- `left = rect.left` when `align='left'`

**Outside-click guard:** The handler checks `insideTrigger || insidePanel` before closing, preventing the portal panel (which is not a DOM descendant of `triggerRef`) from triggering a spurious close when a menu item is clicked.

**Scroll/resize close:** `window.addEventListener('scroll', ..., { capture: true })` catches scroll from any nested scrollable container. `resize` closes the menu to prevent position drift.

**External interface unchanged:** `DropdownItem`, `DropdownProps`, and the exported `Dropdown` function signature are identical — no callers required changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created missing .eslintrc.json**
- **Found during:** Running `npx next lint --quiet` — triggered interactive ESLint setup prompt instead of linting
- **Issue:** No ESLint config file existed in the project root
- **Fix:** Created `.eslintrc.json` with `{ "extends": "next/core-web-vitals" }` (Next.js recommended strict config)
- **Files modified:** `.eslintrc.json`
- **Commit:** df8c5466

### Pre-existing Out-of-Scope Issue

`src/components/admin/CreateUserModal.tsx` line 55 has a pre-existing `react/no-unescaped-entities` lint error (unescaped apostrophe). This existed before this plan and was last modified in commit `b6035356`. Logged to deferred items — not in scope for this plan.

## Commits

| Hash | Message |
|------|---------|
| df8c5466 | fix(13-02): rewrite Dropdown with createPortal to fix overflow-hidden clipping |

## Known Stubs

None.

## Self-Check: PASSED

- `src/components/ui/Dropdown.tsx` exists and contains `createPortal`, `panelRef`, `triggerRef`, `position: 'fixed'`
- `.eslintrc.json` exists
- Commit `df8c5466` exists in git log
