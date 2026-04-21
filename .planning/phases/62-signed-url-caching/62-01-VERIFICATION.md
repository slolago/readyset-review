# Phase 62 Plan 01 — Verification

## Static checks

- `npx tsc --noEmit` — passes (clean exit, no output) after each task commit.
- No new test files; no vitest suites exist in this repo (test script present
  but `find src -name '*.test.ts'` returns empty).

## Contract preservation (client-facing)

Client consumers read these fields from the asset response:

| Field                  | Where read                                                 | Still produced? |
|------------------------|------------------------------------------------------------|-----------------|
| `signedUrl`            | AssetCard, VideoPlayer, VersionComparison, ImageViewer     | Yes             |
| `thumbnailSignedUrl`   | AssetCard, AssetListView, FolderBrowser                    | Yes             |
| `spriteSignedUrl`      | VideoPlayer trickplay                                      | Yes             |
| `downloadUrl`          | AssetCard download button                                  | Yes (uncached)  |

No field renames; no shape changes. Anti-scope respected.

## Behavior

### Cold (first request after deploy / TTL lapsed)
1. `getOrCreateSignedUrl` sees no `cached` OR remaining TTL ≤ 30 min.
2. Calls `generateReadSignedUrl(gcsPath, ttlMinutes)`.
3. Returns `{ url, fresh: true, expiresAt }`.
4. Route appends to `pendingWrites` / `pendingUrlWrites`.
5. Batch commit persists `{ signedUrl, signedUrlExpiresAt, ... }` back to
   the asset doc before response.

### Warm (cached URL with >30 min TTL)
1. `getOrCreateSignedUrl` returns `{ url: cached, fresh: false, ... }`.
2. Nothing is pushed to the pending-writes buffer.
3. Response returns with cached URL.
4. No GCS signing call, no Firestore write.

### Soft-expiry (remaining TTL ≤ 30 min, ≥ 0)
Treated identically to cold — regenerate + write back. The 30-min buffer
guarantees a cached URL served to a client remains valid for the full
client-side session.

## TTL configuration (CACHE-03)

| Kind               | Route                                | TTL     |
|--------------------|--------------------------------------|---------|
| Main asset read    | `/api/assets`                        | 120 min |
| Thumbnail          | `/api/assets`                        | 720 min |
| Sprite strip       | `/api/assets`                        | 720 min |
| Main asset read    | `/api/review-links/[token]`          | 120 min |
| Thumbnail          | `/api/review-links/[token]`          | 720 min |
| Download           | both                                 | per-req |

Longer TTLs for thumbnail/sprite reflect their lower sensitivity and higher
hit rate.

## Self-check

- `git log --oneline -5` shows the three 62-01 commits on HEAD.
- `ls src/lib/signed-url-cache.ts` present.
- Grep for `generateReadSignedUrl` in the two modified routes returns zero
  direct call sites (imports removed — only the helper is used).
