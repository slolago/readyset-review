---
phase: 47-video-export-pipeline
plan: 01
type: human-verify
status: pending
---

# Phase 47 Plan 01 — Verification

End-to-end export pipeline: ExportModal in internal player → POST /api/exports runs ffmpeg → result in GCS → signed download URL.

## Verify

1. `npm run dev`. Log in as an internal user. Open a video asset ≥10s long.
2. Confirm an **Export** button appears in the player controls row, left of the Download button, with a scissors icon.
3. Click Export. Modal opens with:
   - muted video preview (aspect-video)
   - horizontal trim bar with two purple handles (IN at 0s, OUT at duration)
   - MP4/GIF pill toggle (MP4 selected)
   - filename input pre-filled `{asset-name}-trim`
   - Export button
4. Drag IN to ~2s, OUT to ~5s. Confirm:
   - times update in the header row (`mm:ss.mmm`)
   - fill between handles moves
   - the preview video reseeks to the IN point on change
5. Click **Export**. Expect:
   - Button flips to disabled `Encoding…` with spinner
   - Within ~10–30s, a green **Download** button appears
   - Click Download → file named `{filename}.mp4` downloads
   - Open the file: exactly a 3-second clip, plays cleanly, audio present
6. Reopen modal → switch format to **GIF**. Hint text changes ("720p, 15 fps, looping. Max 2 minutes."). Click Export.
   - Longer encode (~20–45s) because of the two-pass palette
   - Download is a `.gif`, ~720p, looping in an image viewer
7. Firestore → `exports` collection. Two docs should exist:
   - `status: 'ready'`
   - correct `userId`, `assetId`, `format`, `inPoint`, `outPoint`, `filename`, `gcsPath`, `completedAt`
   - **not** storing `signedUrl` (transient only)
8. Open a review-link page (external) for any folder. Export button MUST NOT appear in the player there (review-link pages don't pass `onRequestExport`).
9. Edge checks:
   - Drag IN past OUT → `Export` disabled, `Length` shows 0:00.000 (never negative)
   - Use IN=0, OUT=130 (if asset is long enough) → server rejects with `Clip too long (max 120s)`
   - Type `../hack` in filename → the input strips `/` and `.` at the front so you cannot produce a path traversal; server re-sanitizes anyway

## Outcome

Type **approved** or describe issues for diagnosis.
