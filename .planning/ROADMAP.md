# Roadmap: readyset-review

## Overview

Add 4 UX features to the readyset-review (Frame.io clone) app: breadcrumb navigation, video thumbnail generation, rubber-band multi-select, and folder drag-and-drop import.

## Phases

- [x] **Phase 1: breadcrumb-nav** - Add breadcrumb navigation bar showing folder path with clickable crumbs
- [ ] **Phase 2: video-thumbnails-fix** - Fix thumbnail frame selection + make thumbnails work in production
- [ ] **Phase 3: drag-to-move** - Implement true drag-and-drop of items into folders (multi-select already works)
- [x] **Phase 4: folder-drop-import** - Drag and drop an entire folder from the OS into the app, preserving the folder hierarchy (already works)

## Phase Details

### Phase 1: breadcrumb-nav
**Goal**: Extract the existing inline breadcrumb from FolderBrowser.tsx into a reusable Breadcrumb component, ensuring it remains visible, clickable, and styled to the dark theme.
**Depends on**: Nothing (first phase)
**Requirements**: REQ-01, REQ-02, REQ-03
**Plans:** 1 plan

Plans:
- [x] 01-01-PLAN.md — Extract Breadcrumb component and wire into FolderBrowser

**Success Criteria** (what must be TRUE):
  1. A breadcrumb bar is visible above the file browser showing the current folder path ✓
  2. Each crumb is a clickable link that navigates to that folder ✓
  3. The root (project) level shows the project name as the first crumb ✓
  4. Matches the existing dark theme ✓

### Phase 2: video-thumbnails-fix
**Goal**: Fix two thumbnail issues: (1) the captured frame is too early and non-representative; (2) thumbnail upload fails in production due to GCS CORS.
**Depends on**: Phase 1
**Requirements**: REQ-04, REQ-05
**Plans:** 2 plans

Plans:
- [ ] 02-01-PLAN.md — Fix thumbnail frame selection (seek to 25% / max 5s)
- [ ] 02-02-PLAN.md — Route thumbnail upload through backend API to avoid CORS

**Success Criteria** (what must be TRUE):
  1. Thumbnail is captured at 25% of video duration (max 5s) — more representative frame
  2. Thumbnails work in production (Vercel) — route thumbnail upload through backend API to avoid CORS
  3. Existing thumbnails in localhost continue to work

### Phase 3: drag-to-move
**Goal**: Implement true drag-and-drop of selected assets/folders into a target folder. Rubber-band multi-select already works; what's missing is the drag source and folder drop zone.
**Depends on**: Phase 2
**Requirements**: REQ-06, REQ-07
**Success Criteria** (what must be TRUE):
  1. Items (assets and folders) have a draggable handle — dragging one starts a drag operation
  2. When dragging over a folder card, it highlights as a valid drop target
  3. Dropping on a folder calls the move API (PATCH /api/assets/:id and /api/folders/:id)
  4. Multi-selected items: dragging any selected item moves all selected items
  5. Dragging a single unselected item moves only that item
**Plans**: TBD

### Phase 4: folder-drop-import
**Goal**: Drag and drop an entire folder from the OS into the app, preserving the folder hierarchy (subfolders and files).
**Depends on**: Phase 3
**Requirements**: REQ-08, REQ-09, REQ-10
**Plans:** Already working — confirmed by user testing.

**Success Criteria** (what must be TRUE):
  1. User can drag a local OS folder onto the app drop zone ✓
  2. The full subfolder tree is created in Firestore mirroring the local structure ✓
  3. All files are uploaded to GCS at their correct paths within the hierarchy ✓
  4. Upload progress is shown per-file ✓
