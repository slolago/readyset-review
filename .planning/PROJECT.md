# readyset-review

Frame.io V4 clone — internal media review platform.

## What This Is

A fully-featured media review platform for internal teams: upload video/image assets, organize into projects and folders, annotate with time-stamped comments, share via review links, and compare versions side-by-side.

## Core Value

Fast, accurate video review — frame-level precision, rich metadata, and fluid version management without leaving the browser.

## Current Milestone: v1.5 Polish & Production Accuracy

**Goal:** Close the gap between "mostly working" and production-ready — accurate FPS + VU measurements, full UI legibility (grid timestamps, list filenames), no naming friction on copy, all review link features working as spec'd, and the compare view completing with audio switching and comment panels.

**Target features:**
- Grid card upload date/time — distinguish versions after unstacking (all show V1, date is the differentiator)
- List view full filename on hover — no more truncation without tooltip
- FPS accuracy — snap rVFC measurement to nearest standard frame rate (CTV spec compliance)
- VU meter pre-gain — measure source signal, not post-volume output
- Copy naming — remove "copy of" prefix so CFFs don't need manual renaming
- Review link show-all-versions fix — toggle was broken, viewer showed only one version
- Viewer download CTA — always-visible download button in player (not hover-only)
- Compare view audio switching + comments — click to choose audio side; see that version's comments

## Current State (v1.4 — shipped 2026-04-14)

- **Asset management** — upload, drag-to-move, version stacks (drag-and-drop merge), context menus (rename/copy/duplicate), bulk download, list + grid views
- **Video player** — SMPTE timecode (frame-accurate), safe zones overlay (14 platforms, adjustable opacity), VU meter, version switcher, download button
- **Asset viewer sidebar** — Comments tab + Info tab (filename, type, size, duration, resolution, aspect ratio, FPS, uploader name, date, version)
- **Asset comparison** — select 2 assets → full-screen side-by-side modal with shared play/pause, scrubber, and per-side audio toggle
- **Grid view** — comment count badges, version count badges, thumbnail previews
- **Review links** — short tokens, guest name prompt, allow downloads/approvals toggles, folder sharing, virtual folder browser, auth-skip for logged-in users
- **Collaboration** — name-based autocomplete invite search, collaborator roles, guest read-only enforcement
- **Navigation** — collapsible sidebar with project tree, breadcrumb nav, folder size badges, dashboard real stats
- **Admin** — user management, all-projects view with owner info, role-based access

## Stack

- Next.js 14 App Router + TypeScript
- Firebase Auth (Google OAuth) + Firebase Admin
- Firestore (database)
- Google Cloud Storage (file storage + signed URLs, dual URL strategy for inline/download)
- Tailwind CSS dark theme (#0d0d0d bg, #6c5ce7 accent purple)
- Video.js for video playback
- Fabric.js for canvas annotations

## Repositories

- origin: slolago/readyset-review
- vercel: slolago/readyset-review-vercel

## Requirements

### Validated

- ✓ SMPTE timecode frame-step accuracy — v1.3 (bypass rAF threshold for discrete seeks)
- ✓ Safe zones opacity control — v1.3
- ✓ Comment count badge in grid view — v1.3
- ✓ File info tab (resolution, duration, FPS, uploader, etc.) — v1.3
- ✓ Synchronized asset comparison modal — v1.3
- ✓ Drag-and-drop version stacking — v1.3 (atomic Firestore batch merge)
- ✓ Breadcrumb navigation — v1.2
- ✓ Drag-to-move assets/folders — v1.2
- ✓ Asset context menus (rename, copy, duplicate) — v1.2
- ✓ Review link management (create, edit, delete, folder-scoped) — v1.2
- ✓ Bulk download — v1.2
- ✓ List view with date column — v1.2
- ✓ Admin panel (all projects + user management) — v1.2
- ✓ Safe zones overlay (14 platforms) — v1.2
- ✓ VU meter — v1.2
- ✓ Auth-skip for review links — v1.2
- ✓ Collaborator invite autocomplete — v1.2
- ✓ Asset download button in viewer — v1.2

### Active (v1.5)

- [ ] GRID-01: Upload date/time on grid cards (version disambiguation post-unstack)
- [ ] LIST-01: Full filename visible on hover in list view
- [ ] FPS-01: FPS snapped to nearest standard rate (CTV accuracy)
- [ ] VU-01: VU meter measures pre-gain source signal
- [ ] COPY-01: Copy preserves original asset name (no "copy of" prefix)
- [ ] RVLINK-01: Show-all-versions toggle on review links works correctly
- [ ] RVLINK-02: Persistent download button in video player view
- [ ] COMPARE-01: Compare view audio switch by clicking version label
- [ ] COMPARE-02: Compare view shows active version's comments

### Out of Scope

- Mobile app — web-first approach
- ffprobe server-side codec/FPS extraction — browser `requestVideoFrameCallback` is sufficient for upload-time FPS; codec display deferred
- Offline mode — real-time collaboration is core value

## Key Decisions

| Decision | Outcome | Phase |
|----------|---------|-------|
| Bypass rAF TIME_THRESHOLD for frame-step with direct `setCurrentTime` | ✓ Good — frame digit updates instantly, playback unaffected | 23 |
| Opacity slider resets to 100% on every zone change (not just deselect) | ✓ Good — predictable, no hidden carry-over state | 24 |
| Comment badge hidden (not zero-displayed) when count is 0 | ✓ Good — cleaner grid, matches design intent | 25 |
| FPS stored as `frameRate?: number` on Asset type, measured via `requestVideoFrameCallback` | ✓ Good — typed, no `any` cast; graceful fallback if API unavailable | 26 |
| Comparison modal reuses signed URLs from grid state — no extra API call | ✓ Good — instant open, no round-trip cost | 27 |
| Dual MIME type on drag start (`x-frame-move` + `x-frame-version-stack`) | ✓ Good — handlers can distinguish intent without ambiguity | 28 |
| `e.stopPropagation()` in handleAssetDrop prevents OS upload handler | ✓ Good — critical for correct drop routing | 28 |
| Atomic Firestore batch for version group merge | ✓ Good — no version number collisions even under concurrency | 28 |
| `isDropTarget` placed before `isSelected` in className ternary | ✓ Good — drop highlight has higher visual priority than selection | 28 |
| Token as Firestore doc ID for review links | ✓ Good — consistent lookup vs query | v1.2 |

## Context

~6,000 LOC TypeScript added in v1.3 across 56 files. All features use existing browser APIs and repo code — no new npm packages added.

---

*Last updated: 2026-04-08 — v1.4 milestone started*
