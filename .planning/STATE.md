# State

## Current Phase
5

## Current Plan
Plan 02 complete — Phase 5 plan 02 done

## Status
in_progress

## Last Session
Stopped at: Completed 05-02-PLAN.md (2026-04-06)

## Decisions
- Using Playwright MCP for visual verification before pushing
- Push to both origin (readyset-review) and vercel (readyset-review-vercel) after each phase
- Keep Home icon import in FolderBrowser.tsx because it is also used for Project root button in move dialog
- Named export (not default) for Breadcrumb to match Button.tsx / Spinner.tsx convention
- Upload thumbnail via server-side route to avoid GCS CORS issues
- Thumbnail route updates Firestore directly; complete endpoint no longer needs thumbnailGcsPath
- Use application/x-frame-move MIME type (not text/plain) so container drag handlers can distinguish internal item drags from OS file/folder drops
- Drag payload logic lives in FolderBrowser where selectedIds is in scope; card components just forward the event
- Used application/x-frame-move MIME type for drag-to-move dataTransfer payload (disambiguates from OS file drops)
- Self-drop prevention checks if targetFolderId is in dragged IDs before calling move API
- clearCompleted filters uploading/pending status instead of wiping all uploads (prevents in-progress entries from being lost)
- captureThumbnail timeout reduced to 5s — done() cleanup path already correct via settled guard
- Dismiss button renamed to 'Clear completed' to accurately reflect new behavior

## Blockers
(none)

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
| ----- | ---- | -------- | ----- | ----- |
| 01-breadcrumb-nav | 01 | 5 min | 2/2 | 2 |
| 02-video-thumbnails-fix | 02 | 8 min | 3/3 | 4 |
| 03-drag-to-move | 01 | 8 min | 2/2 | 3 |
| 03-drag-to-move | 02 | 8 min | 2/2 | 1 |
| 05-bug-fixes | 02 | 5 min | 3/3 | 2 |
