# Phase 64: format-edge-cases - Context

**Gathered:** 2026-04-20

<domain>
Export handles non-h264 codecs cleanly; stale export sweeper; image-metadata fallback for HEIC/AVIF; adaptive sprite frame spacing.
</domain>

<decisions>
- FMT-01: export copy path container check currently rejects any `containerFormat` containing "mov" — widen to also accept mov+h264+aac. Reencode uses libx264 regardless of input codec (ffmpeg handles HEVC/AV1/VP9/ProRes decoding automatically as long as binary supports it).
- FMT-02: jobs.ts already has started/completed timestamps (Phase 60). Add a sweeper endpoint + logic: any job with status=running + startedAt > 2min old → mark failed "function likely SIGKILLed". Call this on list-endpoint GET /api/assets/[id]/jobs to lazy-sweep.
- FMT-03: image-metadata.ts after the two existing paths fail, fall back to ffprobe via the resolved binary (re-use from ffmpeg-resolve). ffprobe reads HEIC/AVIF reliably.
- FMT-04: sprite timestamps currently use 2%-98% span over `duration`. For very short (<3s): limit span to 0.1s-duration-0.1s. For very long (>1h): cap at 120min equivalent window so frames aren't too sparse.
</decisions>

<code_context>
- src/app/api/exports/route.ts (container check line 175)
- src/lib/jobs.ts (Phase 60 — add sweeper)
- src/lib/image-metadata.ts
- src/lib/ffmpeg-resolve.ts
- src/app/api/assets/[assetId]/generate-sprite/route.ts (timestamps line 201)
</code_context>

<specifics>FMT-01..04</specifics>
<deferred>Server-side cron for stale sweep — on-read lazy sweep is enough for now.</deferred>
