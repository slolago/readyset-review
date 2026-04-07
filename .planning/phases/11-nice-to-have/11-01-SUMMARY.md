---
phase: 11-nice-to-have
plan: "01"
subsystem: review-links
tags: [nanoid, review-links, localStorage, guest-ux]
dependency_graph:
  requires: []
  provides: [short-review-tokens, guest-name-persistence]
  affects: [src/app/api/review-links/route.ts, src/app/review/[token]/page.tsx]
tech_stack:
  added: [nanoid customAlphabet]
  patterns: [lazy-useState-initializer, localStorage-ssr-guard]
key_files:
  created: []
  modified:
    - src/app/api/review-links/route.ts
    - src/app/review/[token]/page.tsx
decisions:
  - Use nanoid customAlphabet with 62-char alphanumeric set and 8-char length for short review tokens
  - Lazy useState initializer with typeof window guard for SSR-safe localStorage read on review page
  - handleGuestSubmit wrapper persists only guest name to localStorage; email stays session-only
metrics:
  duration: "5 min"
  completed_date: "2026-04-06"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 11 Plan 01: Short Review Tokens and Guest Name Persistence Summary

Short review link tokens via nanoid customAlphabet (8-char alphanumeric) and localStorage-backed guest name bypass so repeat reviewers skip the name prompt.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Replace generateToken with nanoid short token | 2e26a763 | src/app/api/review-links/route.ts |
| 2 | Add localStorage guest name bypass to review page | e33c631c | src/app/review/[token]/page.tsx |

## What Was Built

**Task 1 — nanoid short tokens:**
- Replaced `import { generateToken } from '@/lib/utils'` with `import { customAlphabet } from 'nanoid'`
- Added module-level `generateShortToken` constant: `customAlphabet('ABC...xyz0-9', 8)` — strictly alphanumeric, no hyphens or underscores
- POST handler now calls `generateShortToken()` to produce the Firestore doc ID and review link token
- Existing UUID-based review links continue to resolve — the GET/DELETE routes use direct doc lookup by token string, so any string ID works

**Task 2 — localStorage guest name bypass:**
- `guestInfo` useState uses a lazy initializer that reads `localStorage.getItem('frame_guest_name')` on first render (guarded by `typeof window === 'undefined'` for SSR safety)
- New `handleGuestSubmit` wrapper calls `localStorage.setItem('frame_guest_name', info.name)` before forwarding to `setGuestInfo`
- `ReviewGuestForm` wired to `handleGuestSubmit` instead of `setGuestInfo` directly
- Returning guests (same browser) skip the name prompt automatically; first-time guests still see the form

## Decisions Made

- `nanoid/customAlphabet` chosen over UUID for URL-friendly short tokens (8 chars vs 36 chars)
- Only the guest name is persisted; email is intentionally session-only to avoid storing PII beyond what's needed
- `typeof window === 'undefined'` guard in lazy initializer prevents Next.js SSR crash (this file is already `'use client'` but lazy initializers run server-side during SSR hydration)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `2e26a763` exists in git log
- `e33c631c` exists in git log
- `src/app/api/review-links/route.ts` contains `customAlphabet` and `generateShortToken`
- `src/app/review/[token]/page.tsx` contains `frame_guest_name` and `handleGuestSubmit`
