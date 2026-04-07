---
phase: 13-review-polish-and-fixes
plan: "01"
subsystem: downloads
tags: [gcs, signed-urls, downloads, review-links]
dependency_graph:
  requires: []
  provides: [force-download-signed-urls]
  affects: [review-page, asset-card, asset-list-view]
tech_stack:
  added: []
  patterns: [responseDisposition-attachment, dual-signed-url-strategy]
key_files:
  created: []
  modified:
    - src/lib/gcs.ts
    - src/app/api/review-links/[token]/route.ts
    - src/app/review/[token]/page.tsx
    - src/components/files/AssetCard.tsx
    - src/components/files/AssetListView.tsx
decisions:
  - Dual signed URL strategy — signedUrl (no disposition, for inline playback) and downloadUrl (attachment disposition, for forced download) generated separately per asset
  - generateDownloadSignedUrl sanitises filename by escaping double-quotes before embedding in Content-Disposition header
  - downloadUrl only generated when link.allowDownloads is true to avoid unnecessary GCS API calls
metrics:
  duration_minutes: 10
  completed_date: "2026-04-07T12:04:22Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
requirements:
  - REQ-13A
---

# Phase 13 Plan 01: Force File Downloads via responseDisposition on GCS Signed URLs — Summary

**One-liner:** GCS signed URLs with `responseDisposition: 'attachment; filename="..."'` force browser downloads regardless of cross-origin restrictions.

## What Was Built

Added `generateDownloadSignedUrl(gcsPath, filename)` to `src/lib/gcs.ts`. This helper mirrors `generateReadSignedUrl` but adds `responseDisposition: \`attachment; filename="${safeName}"\`` to the GCS `getSignedUrl` config. Because GCS serves the `Content-Disposition: attachment` header server-side, browsers save the file to disk rather than opening it inline — circumventing the browser's cross-origin restriction on the `<a download>` attribute.

The review-link API route now generates a separate `downloadUrl` (with attachment disposition) alongside the existing `signedUrl` (no disposition, used for inline video/image playback) for each asset when `link.allowDownloads` is true.

All three download consumers — the review page download button, `AssetCard.handleDownload`, and `AssetListView.AssetListRow.handleDownload` — were updated to prefer `downloadUrl` with `?? signedUrl` fallback for backward compatibility with contexts where `downloadUrl` is not present.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add generateDownloadSignedUrl + update review-link API | 220c3cc9 | src/lib/gcs.ts, src/app/api/review-links/[token]/route.ts |
| 2 | Update download consumers to prefer downloadUrl | 2333ea60 | src/app/review/[token]/page.tsx, src/components/files/AssetCard.tsx, src/components/files/AssetListView.tsx |

## Decisions Made

1. **Dual signed URL strategy**: Rather than changing `signedUrl` to use attachment disposition (which would break inline video playback), a separate `downloadUrl` is generated. The `VideoPlayer` and `ImageViewer` continue using `signedUrl` unchanged.

2. **Filename escaping**: `safeName = filename.replace(/"/g, '\\"')` prevents header injection via filenames containing double-quote characters.

3. **Conditional generation**: `downloadUrl` is only generated when `link.allowDownloads` is true, keeping review-link API response times consistent for non-download links.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All download paths are wired to live data.

## Self-Check: PASSED

- src/lib/gcs.ts — generateDownloadSignedUrl present and exported
- src/app/api/review-links/[token]/route.ts — downloadUrl generated when allowDownloads true
- src/app/review/[token]/page.tsx — download button uses downloadUrl ?? signedUrl
- src/components/files/AssetCard.tsx — handleDownload uses downloadUrl ?? signedUrl
- src/components/files/AssetListView.tsx — handleDownload uses downloadUrl ?? signedUrl ?? thumbnailSignedUrl
- Commits 220c3cc9 and 2333ea60 present in git log
- TypeScript compiles with no errors (npx tsc --noEmit clean)
