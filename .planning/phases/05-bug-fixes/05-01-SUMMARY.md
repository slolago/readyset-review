---
phase: 5
plan: 1
subsystem: api
tags: [bug-fix, firestore, review-links]
requires: []
provides: [review-link-direct-lookup]
affects: [review-links-api, review-page]
tech-stack:
  added: []
  patterns: [firestore-doc-id-as-token]
key-files:
  created: []
  modified:
    - src/app/api/review-links/route.ts
    - src/app/api/review-links/[token]/route.ts
decisions:
  - Use token as Firestore document ID so GET/DELETE can use strongly-consistent direct doc lookup
metrics:
  duration: 1 min
  completed: 2026-04-06T15:50:43Z
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 5 Plan 1: Fix Review Link "Not Found" on Fresh Links Summary

## One-liner

Switched review link storage to use the token as the Firestore document ID, replacing the fragile where-query lookup with a strongly-consistent direct doc fetch.

## What Was Built

- **POST /api/review-links**: changed from `collection.add(data)` (auto-generated ID) to `collection.doc(token).set(data)` so the 32-char random token becomes the document ID
- **GET /api/review-links/[token]**: replaced `where('token', '==', ...).limit(1).get()` collection query with `collection.doc(token).get()` direct lookup
- **DELETE /api/review-links/[token]**: same direct doc lookup replacement

## Root Cause Fixed

Firestore collection queries on non-primary-key fields have eventual-consistency delay for newly written documents. A freshly created review link could return `snap.empty === true` when queried immediately, causing a 404. Direct document lookups (`doc(id).get()`) are strongly consistent and never have this delay.

## Tasks Completed

| Task | Description | Commit |
| ---- | ----------- | ------ |
| 1 | Update POST to use token as document ID | c25ddcf |
| 2 | Update GET and DELETE to use doc(token) directly | c25ddcf |

Note: Tasks 1 and 2 were committed together as they are two sides of the same atomic change (write with doc ID / read by doc ID must match).

## Decisions Made

- **Token as doc ID**: The token is already a randomly generated 32-char string, making it a safe and unique document ID. Keeping `token` as a field too ensures backward compatibility with any queries or display code that reads `link.token`.
- **No backward-compat fallback for old docs**: Old documents with auto-generated IDs will 404 under the new lookup. Per the plan, this is acceptable — old links were already broken due to the index issue.

## Deviations from Plan

None - plan executed exactly as written. Tasks 1 and 2 were committed atomically since they form a single coherent change.

## Known Stubs

None - all data paths are fully wired.

## Self-Check: PASSED

- Modified files exist: src/app/api/review-links/route.ts, src/app/api/review-links/[token]/route.ts
- Commit c25ddcf present in git log
