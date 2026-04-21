---
phase: 65
plan: "01"
subsystem: security
tags: [bcrypt, review-links, upload, mime, sec-20, sec-21, sec-22, sec-23]
requirements: [SEC-20, SEC-21, SEC-22, SEC-23]
dependency-graph:
  requires: [OBS-04]
  provides: [hashed-review-link-passwords, header-only-password-path, gcs-mime-enforcement]
  affects: [review-links, comments-api, upload-complete]
tech-stack:
  added: [bcryptjs, "@types/bcryptjs"]
  patterns: [fire-and-forget-migration, header-preferred-deprecated-query]
key-files:
  created:
    - src/lib/review-password.ts
    - tests/review-links.test.ts
    - tests/file-types.test.ts
  modified:
    - src/lib/review-links.ts
    - src/lib/permissions.ts
    - src/lib/gcs.ts
    - src/lib/file-types.ts
    - src/app/api/review-links/route.ts
    - src/app/api/review-links/[token]/route.ts
    - src/app/api/comments/route.ts
    - src/app/api/upload/complete/route.ts
    - src/app/review/[token]/page.tsx
    - tests/permissions.test.ts
decisions:
  - bcryptjs (pure JS) over native bcrypt so Vercel builds stay portable
  - verifyPassword returns {ok, needsUpgrade} so legacy plaintext can be
    detected + rewritten without duplicating the prefix check in callers
  - assertReviewLinkActive returns {needsPasswordUpgrade} rather than going
    async; keeps permissions.ts pure (no Firestore) and lets API routes
    fire-and-forget the rehash
  - SEC-21 done by header-preferred/query-deprecated rather than breaking
    the URL shape; back-compat for one release with a console warning
  - isAcceptedMime lives in file-types.ts alongside ACCEPTED_MIME so the
    allow-list + matcher stay in one file
metrics:
  duration: ~20min
  completed: 2026-04-20
---

# Phase 65 Plan 01: review-link password hashing + upload validation — Summary

Bcrypt review-link passwords with transparent plaintext migration, move password submission off the query string, and server-side MIME allow-list on upload/complete.

## What shipped

**SEC-20 bcrypt hashing**
- `hashPassword()` + `verifyPassword()` added to `src/lib/review-links.ts`
  (bcryptjs, cost=10). `isBcryptHash()` exported for symmetry.
- `POST /api/review-links` + `PATCH /api/review-links/[token]` hash at write.
- `assertReviewLinkActive` in `permissions.ts` now delegates to
  `verifyPassword` and returns `{ needsPasswordUpgrade }` so callers can
  fire-and-forget a plaintext→bcrypt rewrite on the first successful verify
  against a legacy record.
- Fire-and-forget upgrade wired at 3 call sites:
  `GET /api/review-links/[token]`, `GET /api/comments`, `POST /api/comments`.

**SEC-21 password out of the URL**
- New helper `src/lib/review-password.ts` reads `x-review-password` header
  first; falls back to `?password=` with a one-line deprecation warning.
- Wired into `GET /api/review-links/[token]` and `GET /api/comments`.
- `POST /api/comments` keeps body-provided password but also accepts the
  header as a fallback.
- Client (`src/app/review/[token]/page.tsx`) — `fetchReview`,
  `fetchComments`, and `handleAddComment` now send the header.

**SEC-22 GCS verify (Phase 60 carry-over)**
- Confirmed `upload/complete` already calls `verifyGcsObject` and rejects
  missing + zero-byte. No change needed.

**SEC-23 MIME allow-list**
- `verifyGcsObject` now returns `contentType` from GCS metadata.
- New `isAcceptedMime()` in `src/lib/file-types.ts` matches both exact
  entries and `prefix/*` wildcards, case-insensitive, strips charset.
- `upload/complete` rejects 400 when the GCS content-type is not on the
  allow-list. When GCS reports nothing or `application/octet-stream`
  (some browsers omit the header on signed PUTs), falls back to the
  `mimeType` that was recorded on signed-url creation — if that isn't on
  the list either, the upload is rejected.

## Tests

- 7 new in `tests/review-links.test.ts` — hash/verify/migration paths
- 6 new in `tests/file-types.test.ts` — MIME matcher (wildcards,
  case-insensitive, charset, rejections)
- extended `tests/permissions.test.ts` for the new `needsPasswordUpgrade`
  return shape + bcrypt-hash match path
- **171/171 passing**; `npx tsc --noEmit` clean

## Commits

- `cf506f15` feat(65-01): bcrypt password hashing + transparent legacy migration
- `34a69541` feat(65-01): SEC-21 client sends review password via x-review-password header
- `089f52f1` feat(65-01): SEC-23 MIME validation on upload/complete

## Deviations from Plan

None. Anti-scope respected — no rate limiting, no CAPTCHA, no password
complexity rules, no session changes.

## Known Stubs

None.

## Self-Check: PASSED

- src/lib/review-password.ts — FOUND
- tests/review-links.test.ts — FOUND (7 tests)
- tests/file-types.test.ts — FOUND (6 tests)
- Commits cf506f15, 34a69541, 089f52f1 — all present on master
