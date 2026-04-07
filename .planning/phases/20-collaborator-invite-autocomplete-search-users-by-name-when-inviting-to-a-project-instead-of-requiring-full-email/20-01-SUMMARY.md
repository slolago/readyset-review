---
phase: 20-collaborator-invite-autocomplete
plan: 01
subsystem: ui
tags: [firestore, autocomplete, combobox, search, react, next.js]

requires:
  - phase: 01-foundation
    provides: Firebase Admin SDK, auth-helpers, Firestore users collection

provides:
  - GET /api/users/search — Firestore prefix search on name and email with exclude list
  - UserSearchCombobox component — debounced search input with dropdown and stale-response guard
  - CollaboratorsPanel updated to use name-search instead of free-text email entry

affects:
  - Any future collaborator invite flows or user-lookup features

tech-stack:
  added: []
  patterns:
    - "Firestore prefix search: orderBy + where >= q + where < q+uf8ff for server-side name matching"
    - "Stale response guard: versionRef counter incremented before each fetch, response discarded if version changed"
    - "Combobox blur/mousedown ordering: onBlur uses setTimeout 150ms to allow onMouseDown on list items to fire first"

key-files:
  created:
    - src/app/api/users/search/route.ts
    - src/components/ui/UserSearchCombobox.tsx
  modified:
    - src/components/projects/CollaboratorsPanel.tsx

key-decisions:
  - "Kept existing collaborators POST API unchanged — passes selectedUser.email matching existing email-based lookup"
  - "Required 2+ characters before firing Firestore query to limit reads and avoid excessive results"
  - "Name search uses raw query (case-sensitive); email search uses lowercase — documented as v1 known limitation"
  - "No new npm dependencies — custom combobox using existing Input/Avatar primitives"

patterns-established:
  - "UserSearchCombobox pattern: controlled combobox with debounce + version guard reusable for any user lookup"
  - "Exclude list pattern: pass owner + collaborator IDs to search API to hide already-added members"

requirements-completed:
  - P20-01
  - P20-02
  - P20-03
  - P20-04
  - P20-05

duration: 2min
completed: 2026-04-07
---

# Phase 20 Plan 01: Collaborator Invite Autocomplete Summary

**Firestore prefix-search user autocomplete replacing free-text email input in CollaboratorsPanel, with debounced fetch, stale-response guard, and excluded owner/collaborator filtering**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-07T20:09:59Z
- **Completed:** 2026-04-07T20:12:22Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `GET /api/users/search` with parallel Firestore prefix queries on `name` and `email` fields, deduplication, and an exclude list that hides the project owner and existing collaborators
- Created `UserSearchCombobox` component with 250ms debounce, stale-response version guard, loading spinner, avatar+name+email rows, "no results" empty state, and single-character hint text
- Updated `CollaboratorsPanel` to use the combobox instead of a free-text email input; Add Collaborator button is disabled until a user is explicitly selected from the dropdown

## Task Commits

1. **Task 1: Create user search API route and UserSearchCombobox component** - `16f0e268` (feat)
2. **Task 2: Wire UserSearchCombobox into CollaboratorsPanel** - `de4d8d00` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/app/api/users/search/route.ts` — GET endpoint for Firestore prefix search on users collection
- `src/components/ui/UserSearchCombobox.tsx` — Controlled combobox with debounce, dropdown, avatar rows, stale guard
- `src/components/projects/CollaboratorsPanel.tsx` — Replaced email Input with UserSearchCombobox; selectedUser state controls submit

## Decisions Made

- **Existing API unchanged:** The collaborators POST route accepts `email` and does its own user lookup. By passing `selectedUser.email` from the combobox result we avoid any API contract change — the invite flow works identically from the server's perspective.
- **2-character minimum:** Fires search only at 2+ characters to cap Firestore reads per session.
- **Case sensitivity:** The name query uses the raw typed string (Firestore is case-sensitive). Email query lowercased. This is a known v1 limitation — a `nameLower` field could be added to users docs later to enable case-insensitive name search.
- **No new dependencies:** Custom combobox using existing `Input`, `Avatar`, and `lucide-react` primitives, consistent with project style.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 20 complete. UserSearchCombobox is a reusable primitive available for any future user-lookup flows (e.g., assigning reviewers, mentioning users in comments).
- Phase 21 (admin panel polish) can proceed independently.

---
*Phase: 20-collaborator-invite-autocomplete*
*Completed: 2026-04-07*
