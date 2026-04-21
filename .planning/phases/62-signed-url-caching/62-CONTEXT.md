# Phase 62: signed-url-caching - Context

**Gathered:** 2026-04-20

<domain>
Cache signed URLs on asset doc with expiry; regenerate only when close to expiry (30 min).
</domain>

<decisions>
- Asset gets: signedUrl?, signedUrlExpiresAt?, thumbnailSignedUrl?, thumbnailSignedUrlExpiresAt?, spriteSignedUrl?, spriteSignedUrlExpiresAt?
- Helper `getOrCreateSignedUrl(asset, field, ttlMinutes)` in src/lib/signed-url-cache.ts
- Write-through: on first read that regenerates, persist back to asset doc via batched update (don't block the response — fire-and-forget update)
- TTLs: main asset 120 min, thumbnail 720 min, sprite 720 min
- Regenerate when expires in <30 min
- Review link uses the same helper — massive win at scale
</decisions>

<code_context>
- src/lib/gcs.ts (generateReadSignedUrl)
- src/app/api/assets/route.ts (regens 3 URLs per asset per request — hot path)
- src/app/api/review-links/[token]/route.ts (decorate function)
- src/types/index.ts (Asset — add cache fields)
</code_context>

<specifics>CACHE-01..03</specifics>
<deferred>None</deferred>
