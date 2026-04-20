# Phase 47: video-export-pipeline - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Server-side video export modal — user selects format (MP4 or GIF), marks in-point and out-point on a trim bar, names the file, and triggers a ffmpeg-powered trim/convert job. Progress is observable and the result downloadable via signed URL.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- ffmpeg runs server-side via existing ffmpeg-static + @ffprobe-installer deps (already installed in v1.6/ffprobe phase)
- For MP4 short clips: use stream copy when possible (`-c copy`) for no re-encode speed; fallback to H.264/AAC for GIF source or when -ss/-t require re-encode
- For GIF: two-pass palette (palettegen + paletteuse) for quality, reasonable size cap (720p, 15fps)
- Job lifecycle: POST starts job with jobId (firestore doc), ffmpeg runs inline in the API handler (maxDuration=60 ok for clips), progress polled via GET /api/exports/[jobId], output uploaded to GCS with "exports/{userId}/{jobId}.{ext}" path
- Modal: reuse viewer's in/out marker state — pass current in/out through when opening

</decisions>

<code_context>
## Existing Code Insights

Relevant files:
- src/app/api/assets/[assetId]/probe/route.ts — reference for ffprobe invocation via spawn + installer resolution
- src/lib/gcs.ts — GCS signed URL + upload helpers
- src/types/index.ts — Asset
- src/components/viewer/VideoPlayer.tsx — current in/out markers from Phase 46
- next.config.mjs — serverComponentsExternalPackages for ffmpeg; needs update to include export route in outputFileTracingIncludes

</code_context>

<specifics>
## Specific Ideas

Success criteria (from ROADMAP):
1. Export modal with format (GIF/MP4), in/out on trim bar, filename, trigger server-side export
2. MP4 preserves source codec when possible, or re-encodes H.264+AAC; GIF is looping, reasonable FPS, palette-optimized
3. Export progress observable (queued → encoding → ready); result downloadable via signed URL

</specifics>

<deferred>
## Deferred Ideas

- Bulk export of whole folder (v2 future)
- Per-asset watermarking (v2 future)
- Custom resolution/bitrate settings beyond defaults

</deferred>
