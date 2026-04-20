---
phase: 47-video-export-pipeline
plan: 01
subsystem: video-export
tags: [ffmpeg, gcs, export, mp4, gif, video-player]
requires:
  - firebase-admin
  - "@ffmpeg-installer/ffmpeg"
  - ffmpeg-static
  - "@google-cloud/storage"
provides:
  - ExportJob type
  - createExportJob / getExportJob / updateExportJob / listUserExports helpers
  - resolveFfmpeg binary resolver
  - POST|GET /api/exports (inline ffmpeg spawn + GCS upload)
  - GET /api/exports/[jobId] (status + fresh signed URL)
  - ExportModal UI in internal video viewer
affects:
  - src/components/viewer/VideoPlayer.tsx (new Export button, onRequestExport prop)
  - src/app/(app)/projects/[projectId]/assets/[assetId]/page.tsx (modal wired)
  - next.config.mjs (outputFileTracingIncludes /api/exports)
tech-stack:
  added: []
  patterns:
    - "Inline ffmpeg spawn in Next.js route (maxDuration=60) — mirrors probe route"
    - "MP4 stream-copy-first with automatic re-encode fallback on ffmpeg failure"
    - "GIF two-pass palettegen/paletteuse for size+quality"
    - "Fresh GCS signed download URLs per GET (never persisted)"
key-files:
  created:
    - src/lib/ffmpeg-resolve.ts
    - src/lib/exports.ts
    - src/app/api/exports/route.ts
    - src/app/api/exports/[jobId]/route.ts
    - src/components/viewer/ExportModal.tsx
  modified:
    - src/types/index.ts
    - src/components/viewer/VideoPlayer.tsx
    - "src/app/(app)/projects/[projectId]/assets/[assetId]/page.tsx"
    - next.config.mjs
decisions:
  - "Inline ffmpeg per POST instead of queue: simplest path, maxDuration=60 covers ≤2-min clips (clamped server-side)"
  - "Combined Tasks 2 and 3 into one commit (47-01 task 2-3) because both modify only src/app/api/exports/route.ts and the GIF branch is additive to the same POST handler — two commits would have left the repo in a state where GIF returned 501 between them; single atomic commit is cleaner"
  - "Client does not poll individual jobs: the POST is synchronous-from-client's-perspective and already resolves with the signed URL. GET /api/exports/[jobId] exists for future polling UIs (e.g., reloading a previous session's in-progress job) but is not used by the modal"
  - "Review-link pages stay secure by omission: they instantiate VideoPlayer without onRequestExport, so the Export button never renders for guests"
metrics:
  duration: "~45 min"
  completed: 2026-04-20
---

# Phase 47 Plan 01: video-export-pipeline Summary

End-to-end server-side video export: user opens an Export modal in the internal player, picks MP4 or GIF, marks in/out on a trim bar, names the file, and submits. The /api/exports route runs ffmpeg inline on a signed source URL, uploads the result to GCS, and returns a fresh signed download URL. The UI flips through encoding → ready and offers a Download button.

## What shipped

- `ExportJob` type, `exports` Firestore collection, and thin CRUD helpers
- Shared `resolveFfmpeg()` resolver that mirrors the existing ffprobe pattern
- `POST /api/exports`:
  - Validates (format, non-negative in/out, clipDur ≤ 120s, sanitized filename)
  - Auth-gates via `canProbeAsset` (same perm as media read)
  - MP4: stream-copy when source is h264+aac+mp4-ish, otherwise H.264+AAC re-encode, `+faststart` in both paths, automatic re-encode retry if copy fails (keyframe alignment)
  - GIF: two-pass palette (`palettegen stats_mode=diff` → `paletteuse dither=bayer:bayer_scale=5`), 720p @ 15 fps, `-loop 0`
  - Uploads to `exports/{userId}/{jobId}.{ext}`, writes `status: ready`, returns a fresh signed download URL
  - Temp files unlinked in every path (success, MP4-copy-failure, GIF-pass-failure)
- `GET /api/exports`: lists the current user's 20 most recent jobs, hydrates ready ones with fresh signed URLs
- `GET /api/exports/[jobId]`: single-job status + fresh signed URL (404/403 gates)
- `ExportModal.tsx`: dark-theme modal, muted preview reseeking on IN change, drag-or-click trim bar with pointer capture, format pills, filename input with `.{format}` suffix hint, submit/encoding/ready/download states, toast feedback
- VideoPlayer gains an `onRequestExport?: () => void` prop and a scissors-icon Export button rendered only when that callback is passed
- `AssetViewerPage` wires the callback and renders `<ExportModal />` only for video assets; review-link pages never pass the callback, so the control stays hidden for guests
- `next.config.mjs`: added `/api/exports` and `/api/exports/*` to `outputFileTracingIncludes` so Vercel bundles the ffmpeg binary with both routes

## Requirements covered

- **EXPORT-01** — modal with format, in/out trim, filename, submit → server-side export
- **EXPORT-02** — MP4 preserves codec when possible (copy), re-encodes to H.264/AAC otherwise; GIF is looping, palette-optimized, 720p/15fps
- **EXPORT-03** — progress observable (idle → encoding → ready/failed); signed URL download

## Deviations from Plan

### Auto-fixed / adjusted

**1. [Rule 3 – Blocking] Tasks 2 and 3 combined into one commit**
- **Found during:** Task 2
- **Issue:** Tasks 2 and 3 both modify only `src/app/api/exports/route.ts`; Task 3 extends Task 2's POST handler by replacing a 501 stub with the real GIF branch. Splitting into two commits would land a commit whose `format: 'gif'` branch returns 501, then immediately rewrite it.
- **Fix:** Single commit labelled `feat(47-01): task 2-3 — …` so the repo never passes through a stub-returning state.
- **Files modified:** src/app/api/exports/route.ts
- **Commit:** 4d83682c

**2. [Rule 2 – Missing critical functionality] Filename input sanitizes on input, not only on submit**
- **Found during:** Task 6
- **Issue:** Plan only required server-side sanitization; client-side allowed arbitrary characters that would then be silently mangled. Confusing UX.
- **Fix:** `sanitizeFilenameInput()` strips disallowed chars as the user types (`[^a-zA-Z0-9._ -]`). Server still re-sanitizes defensively.
- **Files modified:** src/components/viewer/ExportModal.tsx

**3. [Rule 2 – Missing critical functionality] Temp-file cleanup on every failure branch**
- **Found during:** Task 3
- **Issue:** Early failure-return paths (palettegen/paletteuse/copy fallback) could leave palette PNG and output files in `/tmp` on a platform where tmpdir survives across invocations.
- **Fix:** `tempsToClean` array accumulates every temp path; `Promise.all(tempsToClean.map(safeUnlink))` runs on every failure branch in addition to success.
- **Files modified:** src/app/api/exports/route.ts

### Anti-scope honored
- No bulk export / folder export
- No watermarking
- No custom resolution / bitrate UI (720p for GIF is fixed; MP4 preserves source dimensions)
- No job queue — inline spawn only

## Notes for future phases

- **MP4 copy fallback observed:** If the asset was uploaded by most modern phones/cameras the copy path works. ProRes / AV1 sources always fall through to re-encode; that's correct and expected. No action needed.
- **ffmpeg stderr quirk:** `palettegen` is chatty on stderr even on success — we only read stderr on non-zero exit, so this is fine, but if we ever surface stderr live to the UI (queue-based UX in v2) we'll want to filter info-level lines.
- **60s maxDuration is a hard cap.** Clips at 120s max work in practice for short clips re-encoded at `-preset fast` but long GIFs will push it. If we ever raise the clip cap, move to a real queue (Cloud Tasks / BullMQ).
- **Signed URL expiry = 60 min.** Download buttons that sit unused in a browser tab longer than that will 403; the modal re-submits only when the user clicks Export again. Fine for now; if we add a persistent "My exports" tab, hydrate signed URLs on tab mount (GET /api/exports already does this).

## Self-Check

Files exist:
- FOUND: src/lib/ffmpeg-resolve.ts
- FOUND: src/lib/exports.ts
- FOUND: src/app/api/exports/route.ts
- FOUND: src/app/api/exports/[jobId]/route.ts
- FOUND: src/components/viewer/ExportModal.tsx
- FOUND: .planning/phases/47-video-export-pipeline/47-VERIFICATION.md

Commits present on master:
- FOUND: 0e28c4bc (task 1)
- FOUND: 4d83682c (task 2-3)
- FOUND: 987b1871 (task 4)
- FOUND: f3f434e3 (task 5)
- FOUND: 08de52dc (task 6)
- FOUND: 96072f27 (task 7)

Typecheck: `npx tsc --noEmit` passes.

## Self-Check: PASSED
