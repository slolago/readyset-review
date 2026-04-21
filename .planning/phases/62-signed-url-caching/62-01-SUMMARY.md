---
phase: 62
plan: 01
subsystem: signed-url-caching
tags: [performance, firestore, gcs, caching]
requires: [firebase-admin, @google-cloud/storage]
provides: [getOrCreateSignedUrl, Asset.signedUrlExpiresAt]
affects:
  - src/app/api/assets/route.ts
  - src/app/api/review-links/[token]/route.ts
tech-stack:
  added: []
  patterns:
    - signed-url cache with write-through on regeneration
key-files:
  created:
    - src/lib/signed-url-cache.ts
  modified:
    - src/types/index.ts
    - src/app/api/assets/route.ts
    - src/app/api/review-links/[token]/route.ts
decisions:
  - Sync batched write-back before response (instead of waitUntil) — trivial
    latency cost and avoids Next 14 route-handler streaming complications.
  - Download URL not cached — filename disposition changes when asset is
    renamed, and it's not a hot-path cost driver.
  - Helper is pure-ish: returns { url, fresh, expiresAt } and lets caller own
    write-back timing so batches can span multiple assets.
completed: 2026-04-20
---

# Phase 62 Plan 01: Signed URL Caching Summary

One-liner: Cache GCS signed URLs on asset docs with write-back; list endpoints
reuse them when >30 min TTL remains — drops ~600 sign calls to near-zero on a
warm 200-asset review-link guest load.

## What Changed

### `src/types/index.ts`
Added to `Asset`: `signedUrl?`, `signedUrlExpiresAt?: Timestamp`,
`thumbnailSignedUrl?`, `thumbnailSignedUrlExpiresAt?: Timestamp`,
`spriteSignedUrl?`, `spriteSignedUrlExpiresAt?: Timestamp`. The URL fields
already matched what the client reads (AssetCard/VideoPlayer consume
`signedUrl`, `thumbnailSignedUrl`, `spriteSignedUrl`) — the new work is
persisting those values with an expiry timestamp.

### `src/lib/signed-url-cache.ts` (new)
`getOrCreateSignedUrl({ gcsPath, cached, cachedExpiresAt, ttlMinutes })`
returns `{ url, fresh, expiresAt }`. Returns the cached URL when
`expiresAt - now > 30 min`, else calls `generateReadSignedUrl` for a fresh
one. Caller owns write-back.

### `src/app/api/assets/route.ts`
Replaced the three `generateReadSignedUrl` calls in the `Promise.all` at
line 87-107 with `getOrCreateSignedUrl`. Assets that got fresh URLs have their
new `signedUrl/signedUrlExpiresAt` (etc.) batch-written to Firestore
**before** the response is returned — sync, but cheap: only fires when
something actually regenerated.

TTLs:
- Main asset: 120 min
- Thumbnail: 720 min
- Sprite: 720 min

Download URL stays per-request (filename disposition depends on
`asset.name`, which changes on rename).

### `src/app/api/review-links/[token]/route.ts`
Same treatment applied to `decorate()`. Pending writes are collected in a
closure-scoped buffer and flushed via `flushUrlWrites()` before each terminal
`NextResponse.json()` (3 call sites: folder view, array-based link, legacy
scope). Review-link main-asset TTL is 120 min to match the assets route;
thumbnail 720 min.

## Deviations from Plan

None — plan executed as written. One small observation tracked here for
future work: the owner-only `/api/review-links/[token]/contents` route also
calls `generateReadSignedUrl` but is explicitly out-of-scope (distinct user,
not a guest hot path). Skipped intentionally.

## Known Stubs

None.

## CACHE-03 Verification

Task 4 was inspection-only. Confirmed in final code:
- `/api/assets` — thumbnail `ttlMinutes: 720`, sprite `ttlMinutes: 720`.
- `/api/review-links/[token]` — thumbnail `ttlMinutes: 720`.
Longer TTL for less-sensitive derivatives reduces regeneration frequency.

## Metrics

- Tasks: 4/4
- Files created: 1
- Files modified: 3
- Commits: 3 (task 4 was verification-only — no code change)
- Typecheck: clean after each commit

## Commits

- `71840014` feat(62-01): add signed URL cache types + helper
- `f9bbdb8a` feat(62-01): cache signed URLs in GET /api/assets
- `5257304f` feat(62-01): cache signed URLs in GET /api/review-links/[token]

## Self-Check: PASSED

- FOUND: src/lib/signed-url-cache.ts
- FOUND: src/types/index.ts (modified)
- FOUND: src/app/api/assets/route.ts (modified)
- FOUND: src/app/api/review-links/[token]/route.ts (modified)
- FOUND commit: 71840014
- FOUND commit: f9bbdb8a
- FOUND commit: 5257304f
