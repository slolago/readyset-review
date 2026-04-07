# Technology Stack — v1.3 Video Review Polish

**Project:** readyset-review
**Researched:** 2026-04-07
**Scope:** Stack additions for 6 v1.3 features only. Existing stack (Next.js 14, Firebase, GCS, Video.js, Fabric.js, Tailwind, Radix UI, Zustand, Lucide) is NOT re-evaluated.

---

## Summary: No New npm Dependencies Required

All 6 features can be implemented entirely with browser APIs and code already in the repo. Zero new packages need to be installed.

---

## Feature-by-Feature Stack Analysis

### Feature 1: Version Stacking via Drag & Drop

**What's needed:** Detect when one asset card is dropped onto another asset card, then call the existing Firestore versionGroupId merge logic.

**Stack decision: Native HTML5 drag-and-drop only — no new library.**

The project already uses `application/x-frame-move` MIME type with `dataTransfer` for asset-to-folder drag. The same pattern extends to asset-to-asset drop:
- `AssetCard` already receives `onDragStart` and renders `draggable`.
- `AssetGrid` already passes `onAssetDragStart` through from `FolderBrowser`.
- `FolderBrowser` already manages `dragOverFolderId` state and a `handleFolderDrop` handler.

What does NOT exist yet:
- `dragOverAssetId` state in `FolderBrowser` (parallel to `dragOverFolderId`).
- A `handleAssetDrop` callback that calls a new `/api/assets/merge-version` (or extends `/api/assets/[assetId]` PUT) to reassign `versionGroupId`.
- Visual drop-target highlight on `AssetCard` when another asset is dragged over it.

**No library needed.** `onDragOver`, `onDragEnter`, `onDragLeave`, `onDrop` on the card `<div>` are sufficient.

**API needed:** One new API route or extension — `PUT /api/assets/[assetId]` with body `{ versionGroupId: string }` — to merge two assets into the same version group. The Firestore versionGroupId pattern is already established.

---

### Feature 2: Asset Comparison — Side-by-Side Player

**What's needed:** Select 2 arbitrary assets (not just consecutive versions of the same stack) and open a side-by-side comparison view.

**Stack decision: Extend existing `VersionComparison` component — no new library.**

`VersionComparison` already implements:
- Clip-path wipe divider with drag handle.
- Synchronized dual `<video>` playback with play/pause, seek, mute controls.
- Image fallback side-by-side.

What does NOT exist yet:
- An entry point for comparing 2 arbitrary selected assets (currently the component only receives `assetA` / `assetB` from the version stack on the single-asset viewer page).
- A selection mechanic in `FolderBrowser` / `AssetGrid` that enables "Compare selected" when exactly 2 assets are checked.
- A comparison route or modal that renders `VersionComparison` with the two selected assets.

**No library needed.** The comparison renderer already exists. Only a new page/modal + selection-aware toolbar button are needed.

**Note on signed URLs:** The comparison view needs signed URLs for both assets. These are already present on asset objects fetched via `GET /api/assets` (the `signedUrl` field). The viewer page fetches its asset via `GET /api/assets/[assetId]`, which also returns `signedUrl`. A dedicated comparison page can reuse either endpoint.

---

### Feature 3: File Information Tab (fps, resolution, filesize, codec, duration)

**What's needed:** A new "Info" tab next to the comments sidebar in the asset viewer, displaying technical metadata.

**Stack decision: HTMLVideoElement / HTMLImageElement browser APIs for client-side extraction; store fps/codec in Firestore at upload time via an API route that reads GCS metadata — no new library.**

**Data sources, per field:**

| Field | Where It Comes From | Method |
|-------|---------------------|--------|
| Resolution (width × height) | Already in `Asset` Firestore doc (`width`, `height` fields populated at upload) | Read from Firestore, display directly |
| File size | Already in `Asset.size` (bytes) | Read from Firestore, `formatBytes()` already exists in `@/lib/utils` |
| Duration | Already in `Asset.duration` (seconds) | Read from Firestore, `formatDuration()` already exists in `@/lib/utils` |
| FPS (frame rate) | **Not stored anywhere yet** | Extract client-side from `videoRef.current` after load (see below) |
| Codec | **Not stored anywhere yet** | Extract client-side via `MediaSource.isTypeSupported()` probe or `video.getVideoPlaybackQuality()` — limited; best option is to store at upload time |

**FPS extraction options:**

- **Browser API (client-side):** `HTMLVideoElement` does not expose `fps` directly in any browser. `video.getVideoPlaybackQuality()` gives `totalVideoFrames` and `totalVideoFramesDropped` but not the native frame rate. The `VideoDecoder` API (Chromium 94+) can read it from encoded chunks but it is complex and not cross-browser. **Practical approach:** calculate an approximate fps from `video.requestVideoFrameCallback()` during playback — accurate but only available while playing, and only in Chromium.

- **Server-side at upload time (recommended):** Store fps in the Firestore asset document during the upload-complete callback. The `@google-cloud/storage` SDK can fetch GCS object metadata, but GCS does not store video fps. A proper solution requires running `ffprobe` on the server — which requires either a Cloud Function with `fluent-ffmpeg` / `ffprobe-static`, or calling a video intelligence API.

**Recommended approach for v1.3 (no new server dependency):**
1. Display fields already stored in Firestore (resolution, filesize, duration) immediately.
2. For fps: derive an approximate display value from `asset.duration` and a frame count sniffed via `requestVideoFrameCallback` when the video plays. Show "~30 fps" if the video is at default fps or use the stored duration and `DEFAULT_FPS = 30` constant already in `VideoPlayer.tsx`.
3. For codec: read `asset.mimeType` (already in Firestore) and display the container format (e.g., "MP4", "WebM") from the MIME type string — not the codec, but sufficient for v1.3.
4. Defer true fps/codec detection (requiring ffprobe) to a future milestone if needed.

**No new npm packages needed for v1.3.** `requestVideoFrameCallback` is a browser API available in Chrome/Edge; check MDN availability before using.

**Component needed:** A new `FileInfoTab` component rendered in the `CommentSidebar` (or as a sibling panel) that reads from `asset` props already available on the page.

---

### Feature 4: Safe Zones Opacity Slider

**What's needed:** A slider that controls the CSS `opacity` of the `SafeZonesOverlay` `<img>` element. Currently opacity is fixed at 100%.

**Stack decision: Native HTML `<input type="range">` — no new library.**

Rationale:
- The volume slider in `VideoPlayer` is already a native `<input type="range">` with custom CSS gradient styling. The exact same pattern works for opacity.
- `@radix-ui/react-slider` is NOT installed, and installing it for a single slider is not justified when the existing volume control proves the native approach works in this codebase.

**Implementation surface:**
- `SafeZonesOverlay.tsx`: add `opacity?: number` prop (0–1), apply as inline `style={{ opacity }}` to the `<img>`.
- `VideoPlayer.tsx`: add `safeZoneOpacity` state (default `1`), add a range slider next to or below `SafeZoneSelector` in the controls bar, pass opacity to `SafeZonesOverlay`.
- No API changes. No Firestore changes. Pure UI state.

---

### Feature 5: Comment Count Badge in Grid View

**What's needed:** Show the comment count badge on `AssetCard` (grid view) the same way `AssetListView` already shows `_commentCount`.

**Stack decision: No library, no API change — data already present.**

**Current state:**
- `GET /api/assets` already populates `asset._commentCount` for every asset in the response (see `route.ts` lines 44-56).
- `AssetListView` already renders `(asset as any)._commentCount ?? 0` in the Comments column.
- `AssetCard` already has `_versionCount` displayed as a badge. The comment count is available on the same `asset` object but `AssetCard` does not read or display `_commentCount`.

**Implementation surface:** Add a comment count badge to the info section of `AssetCard.tsx`. Lucide's `MessageCircle` or `MessageSquare` icon can be used (both already installed via `lucide-react`). No data fetching, no API changes, no new types needed.

---

### Feature 6: Timecode Frame Display Bug Fix

**What's needed:** When stepping frame-by-frame (Shift+ArrowLeft/Right or the `<ChevronLeft>/<ChevronRight>` buttons), the SMPTE timecode display does not update correctly.

**Root cause (identified from code):**
The rAF time tracking loop in `VideoPlayer.tsx` (lines 115-133) applies a `TIME_THRESHOLD = 0.25` second gate — it only calls `setCurrentTime` when the video time changes by more than 0.25 seconds OR when `scrubbing` is true. A single frame at 30fps is 0.0333 seconds, which is far below this threshold. So after a `stepFrame()` call, the displayed timecode does not update until 0.25s of change accumulates.

**Fix: No new library needed.**

Two approaches:
1. **Simplest fix:** In `stepFrame()`, also call `setCurrentTime(v.currentTime + dir / DEFAULT_FPS)` directly after setting `v.currentTime`, bypassing the rAF threshold entirely for frame-step operations. `setCurrentTime` is already called in the `seekTo` imperative handle with no threshold guard.
2. **Alternative:** Add a `stepping` state (like `scrubbing`) that disables the threshold during frame-step operations. Similar to how `scrubbing` bypasses the threshold.

**Recommended fix:** Option 1 — explicit `setCurrentTime` call in `stepFrame()`. It is the minimum change, matches the `seekTo` imperative handle pattern already in the file, and requires no new state.

**No library needed.** Pure logic fix in `VideoPlayer.tsx`.

---

## What Needs Installing

**Nothing.** All 6 features are implementable with:
- Browser APIs already used in the project (HTML5 drag-and-drop, `HTMLVideoElement`, `<input type="range">`)
- Data already fetched and present (`_commentCount`, `width`, `height`, `size`, `duration`, `mimeType`)
- Components already built (`VersionComparison`, `SafeZonesOverlay`, `AssetCard`)
- Firestore patterns already established (`versionGroupId`)

---

## Alternatives Considered and Rejected

| Feature | Alternative | Rejection Reason |
|---------|-------------|------------------|
| Safe zones opacity | `@radix-ui/react-slider` | Volume slider already proves native range input works; adding a dep for one slider is wasteful |
| FPS extraction | `ffprobe-static` on server | Requires binary on Node runtime; incompatible with Vercel serverless. Deferred to future milestone |
| FPS extraction | Google Video Intelligence API | Overkill and adds cost for v1.3; mimeType + DEFAULT_FPS display is sufficient |
| Version stack drag | `react-dnd` or `@dnd-kit/core` | Existing drag logic in FolderBrowser uses native HTML5 only; mixing libraries would break existing behavior and add complexity |
| Asset comparison | New library | `VersionComparison` already ships the wipe-divider + sync video logic |

---

## Current Stack (Unchanged)

| Technology | Version | Role |
|------------|---------|------|
| Next.js | 14.2.5 | App Router, API routes |
| React | 18 | UI |
| Firebase | ^10.12.2 | Auth |
| firebase-admin | ^12.2.0 | Server-side Firestore |
| @google-cloud/storage | ^7.11.2 | GCS signed URLs |
| Tailwind CSS | ^3.4.1 | Styling |
| fabric | ^5.3.0 | Annotation canvas |
| lucide-react | ^0.395.0 | Icons |
| @radix-ui/* | various | Dropdown, Dialog, Select, Tooltip, Avatar, Progress |
| zustand | ^4.5.2 | Global state |
| react-hot-toast | ^2.4.1 | Toast notifications |
| date-fns | ^3.6.0 | Date formatting |
| nanoid | ^5.0.7 | ID generation |
| react-dropzone | ^14.2.3 | File upload drop zone |

---

## Sources

- Codebase: `src/components/viewer/VideoPlayer.tsx` — rAF threshold, `stepFrame`, SMPTE formatter, `DEFAULT_FPS`
- Codebase: `src/components/viewer/SafeZonesOverlay.tsx` — current opacity-less implementation
- Codebase: `src/components/viewer/VersionComparison.tsx` — existing comparison renderer
- Codebase: `src/components/files/AssetCard.tsx` — `_versionCount` badge pattern, absence of `_commentCount` display
- Codebase: `src/components/files/AssetListView.tsx` — `_commentCount` already displayed in list view
- Codebase: `src/app/api/assets/route.ts` — `_commentCount` populated server-side for all assets
- Codebase: `src/types/index.ts` — `Asset._commentCount`, `Asset.width`, `Asset.height`, `Asset.duration`, `Asset.mimeType`
- MDN: `HTMLVideoElement.requestVideoFrameCallback()` — Chromium-only, no Firefox/Safari (as of 2026)
- MDN: `HTMLVideoElement.getVideoPlaybackQuality()` — does not expose native fps
