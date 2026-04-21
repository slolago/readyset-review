# Phase 65 Plan 01 — Verification

## Requirements covered

| ID     | Verified by |
|--------|-------------|
| SEC-20 | tests/review-links.test.ts (7 tests) + tests/permissions.test.ts new cases |
| SEC-21 | code review: extractReviewPassword + client header wiring |
| SEC-22 | existing upload/complete guard (Phase 60 OBS-04) — unchanged |
| SEC-23 | tests/file-types.test.ts (6 tests) + upload/complete guard |

## Automated checks

- `npx tsc --noEmit` → clean
- `npx vitest run` → 7 test files, 171 tests, all passing

## Manual spot checks

- `serializeReviewLink` still strips `password` → `hasPassword:boolean` (no
  change to the API contract; hashed value just stays server-side now)
- Fire-and-forget rehash is wrapped in `.catch(...)` everywhere so a
  failing update can't tank the main request path
- Query-string fallback keeps a deprecation warning but still succeeds, so
  existing bookmarks / stale tabs keep working

## Files changed

Created
- src/lib/review-password.ts
- tests/review-links.test.ts
- tests/file-types.test.ts

Modified
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
- package.json, package-lock.json
