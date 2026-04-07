# Domain Pitfalls: v1.3 Video Review Polish

**Domain:** Frame.io-style media review platform (Next.js 14, Firestore, Video.js)
**Researched:** 2026-04-07
**Scope:** DnD version stacking, dual-player sync, media metadata extraction, timecode frame mode

---

## Critical Pitfalls

Mistakes that cause rewrites or silent data corruption.

---

### Pitfall 1: DnD Intent Ambiguity — Move vs Version Stack

**What goes wrong:**
The existing system uses `application/x-frame-move` to move assets into folder cards. The new feature drops asset A onto asset card B to merge version stacks. Both operations begin identically — the user picks up an asset card. Without an explicit disambiguation mechanism, both handlers fire on the same drop event, or neither fires because one handler consumed the event first.

**Why it happens:**
`AssetCard` currently emits `onDragStart` upward to `FolderBrowser.handleItemDragStart`, which writes `application/x-frame-move` with `{ ids }`. Asset cards have no `onDragOver` / `onDrop` handlers at all — only folder cards do (via `handleFolderDragOver` / `handleFolderDrop`). If you naively add `onDragOver`/`onDrop` to `AssetCard`, every drag-over-folder event will also trigger the asset card's handlers because DOM bubbling will carry the event up through parent cards during folder drags.

**Consequences:**
- Silent data corruption: an asset moved into a folder could also get merged into a version stack if a card happens to sit below the folder in the DOM.
- Double-action: move completes AND version merge fires in the same drop.
- No feedback to user about which action will execute during hover.

**The real question — how does a card know it is being dropped ON it vs dropped INTO a folder below it?**

HTML5 DnD has no built-in spatial hierarchy. When the user drags over an asset card:

1. `dragenter` fires on the card.
2. If the card contains child elements (thumbnail, badges, text), `dragenter` fires on those children and `dragleave` fires on the card — even though the cursor never left the card visually. This is the classic "flickering drop target" problem.
3. The folder card is a sibling in the DOM, not a parent of the asset card, so there is no natural containment relationship to exploit.

**Prevention:**
Use a **second distinct MIME type** on the drag payload. When `handleItemDragStart` is called for an asset (not a folder), additionally write `application/x-frame-version-stack` into `dataTransfer`. Asset card `onDragOver` handlers check `types.includes('application/x-frame-version-stack')` before activating. Folder `handleFolderDragOver` already checks for `application/x-frame-move` and will not activate on an asset-specific payload if you make them mutually exclusive — OR keep `application/x-frame-move` for both but add the second type only for assets, and have folder handlers explicitly ignore drops that also carry `application/x-frame-version-stack`.

Use a **counter-based enter/leave guard** on the asset card (identical to how `dropDragCounter` works in `FolderBrowser` for OS file drops) to survive child element `dragleave` events without flickering the drop-target highlight.

Require a **minimum hover delay** (200–300 ms) before activating the version-stack drop target. This eliminates accidental triggers when the user is dragging past cards to reach a folder below.

**Detection:** If you see `dragOverFolderId` and a version-stack merge both completing in the same gesture, the event is being handled by both handlers.

---

### Pitfall 2: Version Stack Merge Corrupts the Target Group's Version Numbering

**What goes wrong:**
When asset A (which may itself have a version stack with version numbers 1, 2, 3) is merged into asset B's stack (which has versions 1, 2), the resulting merged stack has conflicting `version` field values. Firestore queries sorting by `version` ascending will produce wrong ordering, and the version switcher in the player will show versions out of sequence.

**Why it happens:**
The `versionGroupId` merge operation is conceptually: "rewrite all assets in group A so their `versionGroupId` equals B's group ID, and renumber them so they come after B's existing versions." The existing code never does this renumbering — the `version` field on each Firestore document is set at upload time and never updated. A batch that only updates `versionGroupId` leaves the `version` fields from group A colliding with those in group B.

**Consequences:**
- Version switcher shows "V1, V1, V2, V2, V3" instead of "V1, V2, V3, V4, V5".
- The asset list API groups by `versionGroupId` and picks the highest `version` as the representative card. With collisions, it will non-deterministically pick the wrong asset as the stack head.
- Deleting "V2" from the manage-versions modal may delete the wrong asset.

**Prevention:**
The merge API endpoint must:
1. Fetch all docs in group B sorted by `version` descending → determine `maxVersion`.
2. Fetch all docs in group A sorted by `version` ascending.
3. In a single Firestore batch, update every doc in group A: set `versionGroupId = B.groupId` and `version = maxVersion + indexInGroupA`.
4. If group A's root asset has no `versionGroupId` field (legacy assets — the existing code handles this pattern in `[assetId]/route.ts` line 42–48), explicitly write `versionGroupId` onto that document in the same batch.

---

### Pitfall 3: Self-Drop and Cross-Stack Drop Allowed by the API

**What goes wrong:**
The UI allows dropping an asset onto itself (no check exists on the asset card side), or dropping a version that already belongs to the target stack (which would create a no-op but could also corrupt the version count display).

**Why it happens:**
`handleFolderDrop` has a self-drop guard (`if (ids.includes(targetFolderId)) return`) only for folder-into-folder drops. There is no equivalent guard on the planned asset-card drop handler.

**Prevention:**
Before firing the merge API call, check:
- `draggedAsset.id !== targetAsset.id` (obvious self-drop)
- `draggedAsset.versionGroupId !== targetAsset.versionGroupId` (already in the same stack — dropping is a no-op at best, corrupting at worst)
Both checks must happen client-side (immediate UX feedback) AND server-side (authoritative guard).

---

## Critical Pitfalls — Video Sync

### Pitfall 4: Dual-Player Sync Drift Due to Event-Based Coupling

**What goes wrong:**
The naive approach sets `playerB.currentTime = playerA.currentTime` inside a `timeupdate` event listener on player A. `timeupdate` fires at 4–250 Hz depending on browser and codec. Each `currentTime` assignment on player B triggers a seek, which pauses the decode pipeline briefly. Within seconds, B is visibly behind A.

**Why it happens:**
`timeupdate` is not a high-frequency clock — it fires when the browser decides to, not at every frame. Writing `currentTime` on a playing video is a seek operation that interrupts normal playback buffering. Repeated seeks accumulate latency.

**Consequences:**
The two players drift apart within 5–10 seconds of synchronized playback. Faster content (24fps+ with complex motion) diverges more quickly because the decode pipeline is interrupted more often.

**Prevention:**
Do not use `timeupdate` for ongoing sync. Instead:
- On play: call `play()` on both simultaneously (single microtask, `Promise.all([a.play(), b.play()])`).
- On pause: call `pause()` on both.
- On seek (scrub, frame-step, click): set `currentTime` on both simultaneously.
- Use `requestAnimationFrame` to display a single shared `currentTime` readout derived from whichever player is the "leader" — do NOT write back to the follower's `currentTime` in this loop.
- Only re-sync follower `currentTime` when the delta exceeds a threshold (e.g., >0.5s) or after the user performs an explicit seek.

**Detection:** If you see one player's timestamp consistently trailing the other by 0.1–2 seconds during playback, this is the cause.

---

### Pitfall 5: CORS Blocks the Second Signed URL When Playing in Parallel

**What goes wrong:**
GCS signed URLs work fine in the primary player. When you load the same GCS URL (or a second URL from the same bucket) in a second `<video>` element, the browser may make a CORS preflight for the second fetch. If the bucket's CORS policy doesn't allow the origin or the signed URL's headers, the second player silently fails to load or plays without audio.

**Why it happens:**
The existing player uses one signed URL per asset. When two players are active simultaneously for different assets, both need CORS clearance. If the second player's `<video>` element sets `crossOrigin="anonymous"` (required for Web Audio, used by the VU meter), the CORS check is strict. If it doesn't set `crossOrigin`, the browser caches the response without CORS headers and subsequent requests with `crossOrigin` fail with an opaque response.

**Prevention:**
- Ensure both `<video>` elements in the comparison view use `crossOrigin="anonymous"` set before `src` (the VU meter already requires this pattern — see the recent commits).
- The VU meter should be disabled or simplified in comparison mode; running two Web Audio API contexts simultaneously is expensive.
- Verify GCS bucket CORS allows the Vercel deployment origin explicitly.

---

### Pitfall 6: Play/Pause State Out of Sync Across Two VideoPlayer Instances

**What goes wrong:**
Each `VideoPlayer` component manages its own `playing` state internally. If the comparison view wires up two independent `VideoPlayer` instances and calls `play()` on both, the internal state of each component can diverge when one video ends, buffers, or is paused by the browser's resource manager.

**Why it happens:**
`VideoPlayer` uses internal `useState` for `playing` and has its own keyboard handler (`keydown` on `wrapperRef`). Two instances both listening for Space bar will both toggle independently, and the second keydown fires twice (once per listener).

**Prevention:**
Extract sync logic into a parent component that owns the play/pause/seek state and passes it down as controlled props. The `VideoPlayer` already exposes an imperative ref handle via `useImperativeHandle` — use that to call `play()` / `pause()` / `seek()` from the parent. Disable the internal keyboard handler in comparison mode and handle keyboard events at the comparison-view level only.

---

## Critical Pitfalls — Media Metadata Extraction

### Pitfall 7: `<video>` Metadata Events Don't Give Codec or Frame Rate

**What goes wrong:**
The browser exposes `videoWidth`, `videoHeight`, and `duration` via `HTMLVideoElement`. It does not expose codec, bitrate, or frame rate through any standard DOM API. Building the "file information tab" using only `<video>` metadata will leave codec and fps fields always empty.

**Why it happens:**
The HTML Media Element spec intentionally omits codec information from the DOM. Frame rate is similarly absent — `requestVideoFrameCallback` gives individual frame timing but not a stable FPS number.

**Consequences:**
The file info tab shows resolution and duration correctly but has no reliable way to show fps or codec without additional work.

**Prevention and options:**
- **ffprobe server-side (HIGH confidence):** Run `ffprobe -v quiet -print_format json -show_streams` via a Node.js child process or Cloud Function during upload. Store `fps`, `codec`, `bitrate`, `resolution` in the Firestore asset document. This is the only fully reliable approach and works for all formats including images (via `exiftool` or `sharp`).
- **`mp4box.js` client-side (MEDIUM confidence):** Parses MP4/MOV containers in the browser and can extract codec and fps from the `stsd` and `mvhd` boxes. Does not work for MKV or WebM natively.
- **`mediainfo.js` client-side (MEDIUM confidence):** WASM port of MediaInfo. Handles more container formats. ~3MB WASM bundle — acceptable for an occasional tab open, but must be lazy-loaded.
- Do not attempt to derive fps by counting `requestVideoFrameCallback` callbacks — the callback rate matches display refresh, not the video's native fps, and is unreliable at the start of playback.

**For images:** `HTMLImageElement` gives `naturalWidth` / `naturalHeight`. Codec (JPEG, PNG, WebP, HEIC) must be inferred from the MIME type stored at upload time — it cannot be read from the DOM.

---

### Pitfall 8: `loadedmetadata` Does Not Fire for Images

**What goes wrong:**
Code that extracts metadata via a `<video>` `loadedmetadata` handler will never fire for `asset.type === 'image'`. If the file information tab uses a single code path for both types, image metadata will never appear.

**Prevention:**
Branch early on `asset.type`. For images, use `new Image()` + `onload` to get dimensions. All other image metadata (file size, MIME type) must come from Firestore fields set at upload time — do not re-derive them in the browser.

---

### Pitfall 9: GCS Signed URL Expiry During Metadata Extraction

**What goes wrong:**
The existing signed URLs expire in 120 minutes. If a user opens the file info tab on an old signed URL and the extraction tool (mp4box.js, mediainfo.js) makes a byte-range request to parse the container header, the URL may have already expired, causing a silent 403.

**Prevention:**
Store extracted metadata in Firestore at upload time (server-side approach above). If client-side extraction is used, request a fresh signed URL before initiating the parse, not the cached one from the grid load.

---

## Moderate Pitfalls

### Pitfall 10: Timecode Frame Calculation Bug (Existing)

**What goes wrong:**
`stepFrame` and `formatSMPTE` both use `DEFAULT_FPS = 30` hardcoded. When stepping frame-by-frame on a 24fps or 25fps video, each step moves `1/30` of a second. At 24fps, the correct step is `1/24` (~41.7ms). Using `1/30` (~33.3ms) means each step overshoots by one actual frame approximately every 4 steps, causing the displayed frame number to skip ahead visibly.

`formatSMPTE` compounds this: it computes `totalFrames = Math.floor(t * DEFAULT_FPS)`. For a 24fps video at t=1.0s, this gives frame 30 displayed, but the actual last frame at 1.0s is frame 24. The frame counter in SMPTE mode shows numbers that don't correspond to actual frames in the file.

**Root cause:** The `DEFAULT_FPS` constant is never populated with the asset's actual frame rate. The `Asset` type has no `fps` field stored in Firestore.

**Fix requirements:**
1. Store `fps` on the asset Firestore document at upload time (server-side ffprobe, or accept it as a parameter from the file info extraction pipeline).
2. Pass `fps` as a prop to `VideoPlayer`.
3. Replace all uses of `DEFAULT_FPS` in `stepFrame`, `formatSMPTE`, and the keyboard handler (lines 178, 185, 245, 301–302) with the prop value, falling back to `DEFAULT_FPS` only when fps is unknown.

**Detection:** Open a 24fps or 25fps video. Switch to SMPTE timecode mode. Step forward 24 times with the frame-step button. The displayed frame counter should read "00:01:00" but will instead read "00:01:06" (30 frames displayed instead of 24).

---

### Pitfall 11: Safe Zone Opacity Slider Conflicts with Existing Toggle State

**What goes wrong:**
The existing safe zones feature uses `activeSafeZone` as a string | null toggle. Adding an opacity slider without coordinating the two controls creates a state split: if opacity is 0 but `activeSafeZone` is set, the overlay is logically "on" but invisible. Clicking the safe zone button again will toggle it off, but the user sees no change (it was already invisible), making the control feel broken.

**Prevention:**
Treat opacity as a separate cosmetic property from active/inactive state. An opacity of 0 should not affect `activeSafeZone`. The overlay renders when `activeSafeZone !== null` AND with an `opacity` CSS value driven by the slider. Alternatively, if opacity reaching 0 should be equivalent to "off," explicitly set `activeSafeZone = null` when the slider reaches 0 and snap the slider back to a minimum (e.g., 10%) when the zone is toggled on.

---

### Pitfall 12: Comment Count Badge Uses Per-Asset Queries That Don't Scale

**What goes wrong:**
The asset list API already fetches a `commentCountMap` in one query (line 44–53 in `assets/route.ts`) and attaches `_commentCount` to each asset. If the grid card reads a different field name or makes its own per-asset query, the badge will always show 0 or will trigger N extra Firestore reads per page load.

**Prevention:**
The badge should read `(asset as any)._commentCount ?? 0` directly from the existing field. No additional query needed. The API already does this work. Confirm the field name matches before wiring up the badge component.

---

## Minor Pitfalls

### Pitfall 13: DnD Ghost Image Shows Wrong Content During Version Stack Drag

**What goes wrong:**
When dragging an asset card to merge it into a version stack, the browser's native drag ghost is the entire `AssetCard` DOM element (thumbnail, badges, actions button). This is visually noisy. If the card has the MoreHorizontal dropdown open when the drag starts, the ghost includes the dropdown overlay.

**Prevention:**
Call `e.dataTransfer.setDragImage(thumbnailEl, 0, 0)` in `handleItemDragStart` using a reference to just the thumbnail div. Alternatively, create an off-screen 80×45 canvas element, draw the thumbnail onto it, and use that as the drag image.

---

### Pitfall 14: `memo` on `AssetCard` Blocks Drop Target Re-renders

**What goes wrong:**
`AssetCard` is wrapped in `React.memo`. When a drag enters the card, a parent state update (e.g., `setDragOverAssetId`) will not cause the card to re-render if its props haven't changed — so the visual "drop target" highlight (border, ring) will not appear.

**Prevention:**
Pass `isDropTarget` as a prop from the parent state into `AssetCard`, the same pattern used for `isDropTarget` on folder cards (line 794 in `FolderBrowser.tsx`). `memo` will then re-render when `isDropTarget` flips.

---

### Pitfall 15: Two Video Players Fight Over Keyboard Focus

**What goes wrong:**
`VideoPlayer` attaches a `keydown` listener to `wrapperRef` and relies on the wrapper having focus. In comparison view with two players side-by-side, clicking into one player gives it focus. Pressing Space or arrow keys fires the event on whichever player has focus — not both. The unfocused player does not respond.

**Prevention:**
In comparison mode, lift keyboard handling to the comparison-view container. Both players should expose only an imperative API (via their existing `useImperativeHandle` ref) and not handle keyboard events internally. A single `keydown` listener at the container level drives both players.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| DnD version stacking | Move intent fires simultaneously with version-stack intent (Pitfall 1) | Use second MIME type `application/x-frame-version-stack` to disambiguate |
| Version merge API | Conflicting version numbers after merge (Pitfall 2) | Renumber all group A docs in same Firestore batch |
| Version merge API | Self-drop and same-stack drop allowed (Pitfall 3) | Guard client-side and server-side |
| Comparison view | Player sync drift during playback (Pitfall 4) | No `timeupdate`-based sync; sync only on play/pause/seek events |
| Comparison view | CORS failure on second GCS URL (Pitfall 5) | Set `crossOrigin` before `src` on both elements |
| Comparison view | Keyboard events split across two players (Pitfalls 6, 15) | Lift keyboard handling to parent; use imperative refs |
| File info tab | No codec/fps from DOM (Pitfall 7) | Store via server-side ffprobe at upload; client-side mediainfo.js as fallback |
| File info tab | Different code path needed for images vs video (Pitfall 8) | Branch on `asset.type` explicitly |
| File info tab | Signed URL expires during metadata parse (Pitfall 9) | Store metadata at upload time; avoid re-parsing at view time |
| Timecode frame bug fix | DEFAULT_FPS hardcoded to 30 everywhere (Pitfall 10) | Add `fps` field to Asset type and Firestore; thread through as VideoPlayer prop |
| Safe zones opacity slider | Opacity-0 vs active-null state conflict (Pitfall 11) | Keep opacity and active state independent; define clear UX contract at 0 |
| Comment count badge | Already computed server-side as `_commentCount` (Pitfall 12) | Read existing field; do not add new queries |
| DnD visual feedback | `memo` blocks drop-target highlight (Pitfall 14) | Pass `isDropTarget` prop; same pattern as folder cards |

---

## Sources

- Codebase analysis: `src/components/files/AssetCard.tsx`, `src/components/files/FolderBrowser.tsx`, `src/components/viewer/VideoPlayer.tsx`, `src/app/api/assets/route.ts`, `src/app/api/assets/[assetId]/route.ts` (direct inspection, 2026-04-07)
- HTML5 DnD spec: child-element enter/leave flickering is a known browser behavior, documented in MDN "Using the HTML Drag and Drop API" — counter pattern matches existing `dropDragCounter` in `FolderBrowser.tsx`
- HTMLVideoElement spec: `videoWidth`, `videoHeight`, `duration` exposed; codec and fps are not — HIGH confidence from spec
- Video sync: `timeupdate` firing rate is browser-defined (not frame-accurate) — HIGH confidence from HTML Living Standard
- SMPTE frame bug: identified by reading `DEFAULT_FPS = 30` constant and `stepFrame` / `formatSMPTE` implementations directly
