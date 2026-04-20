---
phase: 51-file-type-expansion
status: human_needed
generated: 2026-04-20
---

# Phase 51 Verification

## Status

**human_needed** — automated typecheck + vitest are clean, but the success criteria require real uploads of PDF, ZIP, HTML, font, and design files through the live GCS pipeline to confirm end-to-end behavior. No automated harness exists for signed-url GCS uploads in this repo.

## Automated Checks (PASSED)

- `npx tsc --noEmit` — zero errors after each of the 5 tasks
- `npx vitest run` — 138/138 tests pass (permissions, permissions-api, format-date)
- All 5 per-task commits land on `master` in order

## Human Verification Checklist

Start the dev server, open a project, and upload one file of each type:

### Upload success (all five must return 200 from `POST /api/upload/signed-url`)

- [ ] Upload a `.pdf` file → asset record has `type='document'`, `subtype='pdf'`
- [ ] Upload a `.zip` file → `type='archive'`, `subtype='zip'`
- [ ] Upload a `.ttf` or `.woff2` font → `type='font'`, `subtype='ttf'` / `'woff2'`
- [ ] Upload an `.html` file → `type='document'`, `subtype='html'`
- [ ] Upload a `.psd` (browser sends `application/octet-stream`) → `type='design'`, `subtype='psd'`
- [ ] Upload a `.exe` or other unsupported file → 400 "Unsupported file type"

### Grid + list view

- [ ] Each of the five new assets shows a centered file-type icon (not a broken thumbnail)
- [ ] Each shows a `.PDF` / `.ZIP` / `.TTF` / `.HTML` / `.PSD` extension pill
- [ ] Top-left type badge shows the right label ("document" / "archive" / "font" / "design")
- [ ] Existing video/image cards look identical to before (sprite hover scrub, play overlay, duration badge unchanged)
- [ ] List view thumbnail column renders the right icon at list-row size

### Viewer page (click each asset)

- [ ] PDF opens in an inline viewer (browser's built-in PDF rendering) — not a download, not a blank page
- [ ] HTML opens in a sandboxed iframe (view-source to confirm `sandbox="allow-scripts allow-same-origin"`)
- [ ] ZIP / TTF / PSD open `FileTypeCard` with: icon, filename, `.SUBTYPE` pill, size, uploader name, upload date, working Download button
- [ ] Download button on FileTypeCard produces a local file (forceDownload path)
- [ ] CommentSidebar mounts for PDF/HTML/ZIP/TTF/PSD assets — can post a text comment
- [ ] Header download, share, version switcher still function
- [ ] Video and image assets still open VideoPlayer / ImageViewer with no visual diff
- [ ] Compare mode and ExportModal remain video-only

### Edge cases

- [ ] Upload a second version of a PDF via "Upload new version" — version stack works (existing versioning logic untouched)
- [ ] Rename a non-video/image asset — works
- [ ] Upload a .psd into UploadZone via drag-and-drop — file is accepted (not greyed out)

## Sign-off

Once all checkboxes are ticked, flip `status: human_needed` to `status: verified` and note the verifier + date.
