# Feature Landscape: v1.3 Video Review Polish

**Domain:** Video review platform (Frame.io-style)
**Researched:** 2026-04-07
**Confidence:** HIGH — based entirely on codebase analysis + known video review tool conventions

---

## Codebase Context Summary

Before speccing each feature, key facts about the existing system:

- Drag-to-move uses `dataTransfer.setData('application/x-frame-move', JSON.stringify({ ids }))` — a custom MIME type
- Version stacks use `versionGroupId` on the `Asset` document (Firestore); the root asset's `id` is the canonical `versionGroupId`
- Version stack management already exists via `VersionStackModal` in `AssetCard`
- `VersionComparison` is a wipe/slider component for comparing two *versions of the same stack* — triggered by `compareMode` in the viewer
- `Asset` type already stores `width`, `height`, `duration`, `size`, `mimeType` — but NOT `fps`, `codec`, or `bitrate`
- `SafeZonesOverlay` renders a PNG at 100% width/height with no `opacity` prop
- `AssetCard` shows a version badge (`V{n}`, Layers icon) and version count in footer — but NO comment count badge
- `AssetListView` already has a `_commentCount` column (from `asset._commentCount`)
- `Asset` type has `_commentCount?: number` already defined
- Timecode: `formatSMPTE` uses `Math.floor(t * DEFAULT_FPS) % DEFAULT_FPS` for frame number; `DEFAULT_FPS = 30` hardcoded; `currentTime` state is updated via a rAF loop with 0.25s threshold (which means frame-step does not always trigger a state update)

---

## Feature 1: Version Stacking via Drag & Drop

### What it is
User drags asset A (the "dragged" card) and drops it onto asset B (the "target" card) in grid or list view. The result is that A gets added to B's version stack — B becomes the canonical root, A becomes a new version number.

### Expected UX Behavior (Table Stakes)

**Drag initiation**
- Dragging an AssetCard already fires `onDragStart` which sets `application/x-frame-move` in dataTransfer
- A new MIME type should be added alongside: `application/x-frame-version-stack` carrying the dragged asset's ID
- OR: the existing payload type is reused but the drop target (an AssetCard, not a Folder) detects the drop

**Visual feedback while dragging over an asset card (drop target)**
- The target AssetCard changes its border to the accent color (`border-frame-accent`) — same treatment as folder drop targets use `isDropTarget` today
- A tooltip or label appears on the card: "Stack as new version" or "Add to version stack"
- The cursor changes to `copy` or a stack icon (not `move` — this is version-stacking, not moving)
- Cards that are NOT valid drop targets (same asset, uploading asset, or asset already in a different version group with incompatible type) should show a `not-allowed` cursor on hover

**Drop confirmation**
- On drop, show a confirmation toast: "Added [asset A name] to [asset B name]'s version stack"
- The dragged card (A) disappears from the grid because it is now a version within B's stack — B's version count badge increments
- No confirmation dialog required — this mirrors how Frame.io handles it (immediate, undoable via version stack management)

**What happens to the data**
- Asset A's `versionGroupId` is updated to match asset B's `versionGroupId` (or asset B's `id` if B had no stack)
- Asset A's `version` number is set to `max(existing versions in group) + 1`
- If asset A already had its own version stack (A is itself a root with versions A1, A2, A3), the entire A stack merges into B's stack — all A-stack members get their `versionGroupId` rewritten to B's group ID, and their version numbers are renumbered to continue from where B's stack ends

**Collision case: both assets already have different stacks**
- This is the hard case. The expected behavior in Frame.io is: the *dragged* asset's entire version group merges into the *target*'s version group
- The target stack "wins" the group ID
- Version numbers are renumbered: existing B-group versions keep their numbers; A-group versions get renumbered starting from `maxBVersion + 1`
- The merge should happen server-side in a single API call to avoid partial state
- After merge: only one card remains visible in the grid (the target B), showing the combined version count

**What does NOT happen**
- No dialog asking "which stack wins" — the drop target always wins
- No undo in-product (user can use "Manage version stack" to delete versions if they made a mistake)
- Dropping a folder onto an asset card does nothing (only asset-to-asset stacking is supported)
- Dropping multiple selected assets onto a card does nothing (or shows an error toast) — version stacking is one-at-a-time for clarity

**Invalid drop cases**
- Dropping an asset onto itself: no-op, no feedback
- Dropping an asset onto an uploading card: blocked (`isUploading` guard)
- Dropping onto a card that is part of the same version group: no-op (they are already stacked)

### Nice-to-Have
- Shift-key modifier: holding Shift while dragging shows "Stack" indicator, without Shift dragging moves to a folder — disambiguates the two drag behaviors when cursor is over an asset card
- Actually Frame.io uses drag over asset card = stack, drag over folder = move, which is cleaner — worth adopting without a modifier key

### Implementation Notes (for roadmap authors)
- The current `handleItemDragStart` in `FolderBrowser` fires for all items; AssetCard itself also gets `onDragStart` forwarded — the grid-level handler needs to add asset card drop targets with `onDragOver` / `onDrop`
- A new API endpoint or extension of `PUT /api/assets/[assetId]` needs to handle the `versionGroupId` reassignment — including the full-group-merge case
- The `application/x-frame-move` type must remain as-is to avoid breaking existing folder-drop logic; version-stack DnD should use a DIFFERENT type: `application/x-frame-stack`

---

## Feature 2: Asset Comparison View (Cross-Asset)

### What it is
User selects 2 assets from the grid (multi-select checkboxes), right-clicks or uses a toolbar button to choose "Compare assets", and sees a side-by-side or split view of both assets with synchronized playback.

### Distinguishing from Existing VersionComparison
The existing `VersionComparison` component is a wipe/slider between two versions of the *same* stack, accessed from the viewer header. This is a DIFFERENT feature: comparing two *independent* assets (different files, potentially different projects or folders). The UI entry point is the grid/list multi-select context, not the viewer.

### Expected UX Behavior (Table Stakes)

**Entry point**
- User selects exactly 2 assets using the checkbox multi-select already in the grid
- A "Compare" button appears in the bulk-action toolbar that appears when items are selected
- Right-clicking a selected group also shows "Compare assets" in the ContextMenu (only visible when exactly 2 assets are selected)
- Selecting more than 2 shows the button disabled with a tooltip "Select exactly 2 assets to compare"

**Comparison view layout**
- Opens in a full-screen or full-panel view replacing the current grid
- Two video players side by side (50/50 split, not a wipe slider — this is side-by-side, not wipe)
- Each panel has its own asset name label at the top
- A shared scrubber at the bottom controls both players simultaneously
- Play/Pause button controls both videos together
- Both videos seek to the same time when the scrubber is used

**Synchronization behavior**
- Play is synchronized: both videos start at the same instant
- Seek is synchronized: scrubbing one scrubber moves both
- Frame stepping (if controls are provided) steps both by one frame
- If the two videos have different durations, the shorter one stops at its end while the longer continues (or both stop at the shorter duration — the simpler choice)
- Audio: only one side plays audio at a time; a toggle button lets user switch which side has audio

**Exit comparison**
- A prominent "Exit comparison" or "X" button at the top returns to the grid view
- Browser back button also exits

**Comparison for images**
- If both assets are images: side-by-side static images, no playback controls
- A zoom control (scroll or pinch) that is synchronized between both panels would be nice-to-have but not required

### Nice-to-Have
- "Sync lock" toggle to temporarily unsync playback (so user can independently scrub each side)
- Swapping which asset is left vs right
- Wipe/slider mode as alternative to side-by-side (this already exists in `VersionComparison` — could be reused)

### Table Stakes vs Nice-to-Have

| Behavior | Table Stakes | Nice-to-Have |
|----------|-------------|--------------|
| Side-by-side layout | YES | |
| Synchronized play/pause | YES | |
| Synchronized seek scrubber | YES | |
| Asset name labels on each side | YES | |
| Exit button | YES | |
| Audio toggle per side | YES | |
| Sync-lock toggle | | YES |
| Wipe/slider mode | | YES |
| Image zoom sync | | YES |

### Implementation Notes
- The existing `VersionComparison` is a wipe component — it can be referenced for the video sync logic (event listeners on video A drive video B)
- This feature needs a new route or modal since it operates on 2 arbitrary assets, not on the viewer page
- Option A: Navigate to a new `/compare?a=[id]&b=[id]` route
- Option B: Open a full-screen modal overlay from the grid
- Option B avoids URL complexity and is simpler to implement for v1.3
- The `FolderBrowser` selection state already tracks `selectedIds: Set<string>` — the compare action can read from this

---

## Feature 3: File Information Tab

### What it is
A second tab in the comment sidebar panel (alongside the existing "Comments" tab) labeled "Info" or "File info" that displays technical metadata about the asset.

### Expected UX Behavior (Table Stakes)

**Tab placement**
- The sidebar currently has no tab structure — it is always the comment list + comment input
- Add a tab bar at the top of the sidebar with two tabs: "Comments" and "Info"
- "Comments" tab is the default and shows existing content unchanged
- "Info" tab shows the file metadata panel

**Metadata displayed (table stakes)**

| Field | Source | Format |
|-------|--------|--------|
| File name | `asset.name` | Plain text |
| File type | `asset.mimeType` | e.g. "video/mp4" |
| File size | `asset.size` | Human-readable, e.g. "142.3 MB" (already have `formatBytes`) |
| Duration | `asset.duration` | MM:SS format (already have `formatDuration`) |
| Resolution | `asset.width x asset.height` | e.g. "1920 x 1080" |
| Aspect ratio | computed from width/height | e.g. "16:9" |
| Uploaded by | `asset.uploadedBy` | User name string |
| Upload date | `asset.createdAt` | Human-readable date |
| Version | `asset.version` | "V3" |

**Metadata NOT in Firestore (requires extraction)**
The following fields are NOT currently stored on the `Asset` document and require additional work:

| Field | Gap | Solution |
|-------|-----|----------|
| FPS / frame rate | Not stored | Must be extracted at upload time via ffprobe (server-side) or read from `videoRef.current` after load |
| Codec | Not stored | Requires ffprobe server-side; browser cannot read this reliably |
| Bitrate | Not stored | Requires ffprobe server-side |

**Recommendation for v1.3:** Display only what is already in Firestore. Show `width x height`, `duration`, `size`, `mimeType`, `uploadedBy`, `createdAt`, `version`. Add an `fps` field stub (display "—" if not present) so the schema is future-ready. Do NOT block this feature on ffprobe integration — that is a separate infrastructure task.

**Layout**
- Each field is a label + value row
- Labels are muted text (like `text-frame-textMuted`), values are white
- Group fields into sections: "File" (name, type, size) and "Video" (duration, resolution, fps, codec)
- For image assets: hide the "Video" section, show "Image" section instead (resolution only)

### Nice-to-Have
- Copy button next to the file name
- "Open in new tab" link
- Color space / HDR indicator

### Table Stakes vs Nice-to-Have

| Field | Table Stakes | Nice-to-Have |
|-------|-------------|--------------|
| Name, size, type | YES | |
| Duration, resolution | YES | |
| Uploaded by, date | YES | |
| Aspect ratio computed | YES | |
| FPS (if stored) | YES (show "—" if missing) | |
| Codec | | YES (requires ffprobe) |
| Bitrate | | YES (requires ffprobe) |

---

## Feature 4: Safe Zones Opacity Slider

### What it is
A slider control next to the safe zones selector that adjusts the transparency of the safe-zone PNG overlay.

### Expected UX Behavior (Table Stakes)

**Control placement**
- Immediately to the right of the existing `SafeZoneSelector` dropdown in the video player controls bar
- The slider is only visible when a safe zone is active (i.e., `activeSafeZone !== null`)
- When no safe zone is selected the slider is hidden to avoid clutter

**Slider behavior**
- Range: 0% to 100% opacity (value 0.0 to 1.0)
- Default: 100% (fully opaque) — same as current behavior
- Dragging left makes the overlay more transparent
- Dragging right makes it more opaque
- Changes apply immediately (no confirm needed)

**Persistence**
- The opacity value does not need to persist across sessions; reset to 100% when a different safe zone is selected or when page is reloaded
- Nice-to-have: persist in `localStorage` per safe zone or globally

**Implementation**
- `SafeZonesOverlay` currently has NO opacity prop — the `img` element uses no opacity style
- Change: pass an `opacity` prop to `SafeZonesOverlay` and apply it as `style={{ opacity }}`
- In `VideoPlayer`, add `safeZoneOpacity` state (default `1`), reset it when `activeSafeZone` changes
- The slider renders as a small horizontal range input, same styling as the volume slider

### Nice-to-Have
- Preset buttons: 25%, 50%, 75% instead of a slider (simpler UX for mobile)
- Label showing the current percentage ("75%")

### Table Stakes vs Nice-to-Have

| Behavior | Table Stakes | Nice-to-Have |
|----------|-------------|--------------|
| Slider 0–100% | YES | |
| Only visible when safe zone active | YES | |
| Immediate application | YES | |
| Reset when safe zone changes | YES | |
| Persist in localStorage | | YES |
| Percentage label | | YES |

---

## Feature 5: Comment Count Badge on Grid View AssetCard

### What it is
A visible comment count on each card in the grid view — matching what the list view already shows via `asset._commentCount`.

### Expected UX Behavior (Table Stakes)

**Visual treatment**
- A small badge overlaid on the card thumbnail, bottom-left corner
- Uses a speech-bubble icon (or the existing `MessageCircle` from lucide) + count number
- Only shown when `_commentCount > 0` — no badge for zero comments (avoids noise)
- Same visual language as the duration badge (bottom-right): `bg-black/60 backdrop-blur-sm rounded text-xs text-white`

**Position**
- Bottom-left of the thumbnail — avoids collision with the existing duration badge (bottom-right) and type/version badges (top-left)
- Alternative: inline in the card footer below the name, but overlay on thumbnail is more scannable

**Content**
- Shows only the number if small: "4"
- For large numbers: "99+" (cap at 99 to avoid layout issues)

**Data availability**
- `asset._commentCount` already exists as an optional field on the `Asset` type
- The assets API already computes this at fetch time for list view — verify it is also included in the grid view fetch (same endpoint, same response, so it should be)
- No new backend work needed

### Nice-to-Have
- Tooltip on hover: "4 comments"
- Red dot indicator for unresolved comments specifically (requires `_unresolvedCommentCount`)

### Table Stakes vs Nice-to-Have

| Behavior | Table Stakes | Nice-to-Have |
|----------|-------------|--------------|
| Comment count badge, >0 only | YES | |
| Bottom-left of thumbnail | YES | |
| "99+" cap | YES | |
| Tooltip | | YES |
| Unresolved-only indicator | | YES |

---

## Feature 6: Timecode Frame Mode Bug Fix

### What the Bug Is

When `timecodeMode === 'smpte'` (MM:SS:FF format) and the user presses the frame step buttons (ChevronLeft / ChevronRight), the timecode display does NOT update to show the new frame number.

### Root Cause Analysis

The rAF loop in `VideoPlayer` that drives `setCurrentTime` has a threshold guard:

```
if (scrubbing || Math.abs(t - lastReported) >= TIME_THRESHOLD) {
  // TIME_THRESHOLD = 0.25
```

Stepping one frame at 30fps advances time by `1/30 ≈ 0.033s`. This is well below the 0.25s threshold. The rAF loop sees the new `currentTime` but does NOT call `setCurrentTime`, so React state does not update, and the displayed timecode stays frozen.

In `mmss` mode (MM:SS) users do not notice because `formatDuration` only shows whole seconds — a 0.033s change would not change the display anyway. In `smpte` mode the frame number IS supposed to change by 1, but it does not because `currentTime` state is stale.

### Correct Behavior

After each frame step, the timecode display in smpte mode should immediately update to show the new frame number. For example:
- Current: `00:05:14` (5 seconds, frame 14)
- Press next frame
- Should immediately show: `00:05:15`
- Shows instead: `00:05:14` (frozen until 0.25s has accumulated)

### Fix Specification

**Option A (simplest):** After calling `v.currentTime = ...` in `stepFrame`, immediately call `setCurrentTime(v.currentTime)`. Since the `videoRef.current.currentTime` update is synchronous for assignment (the seek may be async in the browser, but the value is set immediately), reading it back and setting state forces an immediate re-render with the correct timecode. This bypasses the rAF throttle for the specific step-frame action.

**Option B:** Lower the `TIME_THRESHOLD` when `timecodeMode === 'smpte'` to `1/DEFAULT_FPS - epsilon`. But this re-renders at 30fps during normal playback in smpte mode — wasteful.

**Option A is the correct fix.** It is a one-line addition in `stepFrame` and in the keyboard handler (`ArrowLeft` / `ArrowRight` with Shift modifier).

**Also affects:** Keyboard frame-step (`Shift+ArrowLeft`, `Shift+ArrowRight`). The same fix must be applied in the keyboard handler that updates `v.currentTime`.

### What Correct Behavior Should Look Like

| Action | mmss display | smpte display |
|--------|-------------|---------------|
| Frame step forward | No change visible (sub-second) | Frame number increments by 1 immediately |
| Frame step backward | No change visible | Frame number decrements by 1 immediately |
| Normal playback | Updates per second | Updates per frame at 30fps (acceptable rAF behavior) |
| Scrubbing | Updates smoothly | Updates smoothly |

### Note on DEFAULT_FPS

The current `DEFAULT_FPS = 30` constant is hardcoded. Real-world clips may be 23.976, 24, 25, 29.97, 50, or 60fps. For v1.3 the fix should use `DEFAULT_FPS` as-is. A proper fps-aware fix (reading `asset.fps` if stored, or detecting from video metadata) is a subsequent improvement tracked under Feature 3 (file info / metadata storage).

---

## Anti-Features (Do NOT Build)

| Anti-Feature | Why Avoid |
|-------------|-----------|
| Version stack DnD with multi-select | Merging 3+ stacks at once is ambiguous and error-prone; one-at-a-time is safer |
| Comparison of more than 2 assets | 3-way comparison is niche and layout is hard; defer indefinitely |
| Codec/bitrate in Info tab without ffprobe | Showing empty fields is misleading; show "—" or omit entirely |
| Opacity slider visible when no safe zone active | Creates unnecessary clutter in the controls bar |
| Comment badge for zero count | Zero-count badges add visual noise; only show when count > 0 |

---

## Feature Dependencies

```
Feature 5 (comment badge) → depends on _commentCount being present in asset response
  → already satisfied: _commentCount is typed on Asset, populated by list view endpoint

Feature 4 (opacity slider) → depends on SafeZonesOverlay accepting opacity prop
  → 3-line change to SafeZonesOverlay.tsx

Feature 6 (timecode bug) → independent, no dependencies

Feature 1 (version DnD) → depends on:
  → new MIME type in drag payload (FolderBrowser.tsx + AssetCard.tsx)
  → new API logic for versionGroupId reassignment + multi-asset group merge
  → AssetCard gaining onDragOver / onDrop handlers (currently has none)
  → AssetGrid passing those handlers down

Feature 2 (comparison view) → depends on:
  → multi-select already working (it is)
  → new comparison page/modal component
  → two video players with shared scrubber (can reference VersionComparison sync logic)

Feature 3 (file info tab) → depends on:
  → CommentSidebar gaining a tab bar
  → existing Asset fields (width, height, duration, size, mimeType, createdAt, uploadedBy, version)
  → fps is NOT in Firestore — show "—"
```

---

## MVP Recommendation

**Build in this order:**

1. **Feature 6 (timecode bug)** — 1–2 line fix, zero risk, ships immediately
2. **Feature 5 (comment count badge)** — minimal frontend change, no backend, high visibility
3. **Feature 4 (opacity slider)** — small prop addition to SafeZonesOverlay + slider in VideoPlayer controls
4. **Feature 3 (file info tab)** — tab bar + metadata display, no backend
5. **Feature 1 (version DnD)** — new drag type + API endpoint for group merge, moderate complexity
6. **Feature 2 (comparison view)** — largest new component, build last

**Defer:** fps/codec display in File Info tab until an ffprobe pipeline is added to the upload flow.

---

## Sources

- Codebase analysis: `src/components/viewer/VideoPlayer.tsx`, `src/components/viewer/VersionComparison.tsx`, `src/components/viewer/SafeZonesOverlay.tsx`, `src/components/files/AssetCard.tsx`, `src/components/files/AssetGrid.tsx`, `src/components/files/FolderBrowser.tsx`, `src/types/index.ts`, `src/app/api/assets/[assetId]/route.ts`
- Frame.io V4 UX conventions (training data, MEDIUM confidence — verified against codebase structure)
- Confidence: HIGH for all behavioral specs based on codebase + known video review tool patterns
