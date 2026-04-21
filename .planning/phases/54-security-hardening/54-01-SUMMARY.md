---
phase: 54-security-hardening
plan: 01
subsystem: security
tags: [auth, review-links, debug, firestore, hardening]
requires:
  - existing auth-helpers (verifyAuthToken, requireAdmin, getAuthenticatedUser)
  - existing permissions helpers (canEditReviewLink, assertReviewLinkAllows)
provides:
  - serializeReviewLink helper (src/lib/review-links.ts)
  - SanitizedReviewLink type
  - admin-gated /api/debug
  - auth-gated GET /api/safe-zones
  - centralized disabled-user rejection in getAuthenticatedUser
  - full-whitelist PATCH on /api/review-links/[token]
  - compound Firestore query for review-link comment GET
  - approvalStatus persistence on POST /api/comments
affects:
  - all routes using getAuthenticatedUser (disabled check now applies)
  - all review-link API response shapes (password stripped, hasPassword boolean)
tech-stack:
  added: []
  patterns:
    - "Centralized sanitizer (serializeReviewLink) instead of per-route strip"
    - "Compound Firestore query with index-missing fallback via FAILED_PRECONDITION catch"
key-files:
  created:
    - src/lib/review-links.ts
  modified:
    - src/app/api/debug/route.ts
    - src/app/api/safe-zones/route.ts
    - src/lib/auth-helpers.ts
    - src/app/api/auth/session/route.ts
    - src/app/api/review-links/route.ts
    - src/app/api/review-links/all/route.ts
    - src/app/api/review-links/[token]/route.ts
    - src/app/api/review-links/[token]/contents/route.ts
    - src/app/api/comments/route.ts
decisions:
  - "Relaxed serializeReviewLink generic from { password?: unknown } to Record<string, unknown> so spreads infer usably"
  - "contents route now also returns a sanitized reviewLink field for canonical client shape"
metrics:
  duration_seconds: 301
  completed_date: 2026-04-21
  tasks: 7
  commits: 7
---

# Phase 54 Plan 01: Security Hardening Summary

Closed seven audit-surfaced security gaps — unauth read paths, suspended-user bypass, review-link PATCH coverage, password leakage, dropped approvalStatus, and O(N) comment scan — with one atomic commit per REQ.

## Changes by requirement

| REQ    | Files                                                                 | Commit      | Summary                                                               |
| ------ | --------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------- |
| SEC-01 | src/app/api/debug/route.ts (rewritten)                                | `ba0e02e8`  | Admin gate + stripped SA email/private-key prefix + env-var flags     |
| SEC-02 | src/app/api/safe-zones/route.ts (L24-30)                              | `bb308e88`  | GET requires getAuthenticatedUser; 401 otherwise                      |
| SEC-03 | src/lib/auth-helpers.ts (L35-40), session/route.ts (comment added)    | `9bcc5d89`  | getAuthenticatedUser returns null when `disabled === true`            |
| SEC-04 | src/app/api/review-links/[token]/route.ts (PATCH body L240-330)       | `a69a896e`  | Full whitelist (7 fields) + FieldValue.delete() unset + rejection 400 |
| SEC-05 | src/lib/review-links.ts (new), 4 API routes                           | `620299d9`  | serializeReviewLink wired into all response paths                     |
| SEC-06 | src/app/api/comments/route.ts (POST L211-220)                         | `f01de60e`  | approvalStatus persists when guest-gate permits or auth'd user posts  |
| SEC-07 | src/app/api/comments/route.ts (GET L65-95)                            | `d99bf33d`  | Compound (assetId + reviewLinkId) query with index-missing fallback   |

## New exports

`src/lib/review-links.ts`:
- `serializeReviewLink<T extends Record<string, unknown>>(link: T): Omit<T, 'password'> & { hasPassword: boolean }`
- `type SanitizedReviewLink = Omit<ReviewLink, 'password'> & { hasPassword: boolean }`

## Follow-ups / ops tasks

- **Firestore composite index needed:** `comments(assetId ASC, reviewLinkId ASC, createdAt ASC)`. SEC-07 falls back to the legacy in-memory filter with a `console.warn` until the index exists, so the endpoint continues to work — but create the index via Firebase Console (the FAILED_PRECONDITION error message includes an auto-create URL) to restore O(log N) queries.
- **Type sweep:** `approvalStatus` is persisted on comment documents but NOT declared on the `Comment` interface in `src/types/index.ts` — intentional scope split; DC-02 (Phase 58) owns that type update.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Bug] Relaxed serializeReviewLink generic constraint**
- **Found during:** Task 5 (SEC-05) typecheck
- **Issue:** `<T extends { password?: unknown }>` constrained the type parameter so tightly that callers passing `{ id, ...data }` spreads hit TS2353 ("Object literal may only specify known properties, and 'id' does not exist in type '{ password?: unknown; }'"). Downstream callers in `all/route.ts` then lost `createdAt` visibility on the sort step.
- **Fix:** Changed constraint to `Record<string, unknown>` and added a single `as` cast on the return so TypeScript tracks the concrete return shape. In `all/route.ts` the sort target was already working with `any[]`-shaped data, so a terminal `as any[]` preserved the existing behavior.
- **Files modified:** src/lib/review-links.ts, src/app/api/review-links/all/route.ts
- **Commit:** `620299d9`

### Scope-aligned additions

**2. Contents route returns sanitized reviewLink field**
- Plan step called for wiring serializeReviewLink into `/api/review-links/[token]/contents` "for consistency"; implemented as documented — the endpoint now exposes `reviewLink: SanitizedReviewLink` alongside its existing content-editor response. No client change needed (additive field).

## Verification

- `npx tsc --noEmit` — passes (zero errors).
- `npx vitest run` — 138/138 tests pass across 3 test files.
- All 7 grep checks in the plan's `<verification>` block return the expected match/no-match.
- No client-side / front-end files modified (scope hygiene preserved).
- `Comment` interface in `src/types/index.ts` unmodified (DC-02 owns that sweep).

## Self-Check: PASSED

- File `src/lib/review-links.ts`: FOUND
- Commits ba0e02e8, bb308e88, 9bcc5d89, a69a896e, 620299d9, f01de60e, d99bf33d: FOUND
- Vitest: 138 passed
- TypeScript: no errors
