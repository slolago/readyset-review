# Phase 74: viewer-critical-path - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Asset viewer reaches interactive state dramatically faster. Five tightly-coupled fixes on the video + annotation + comment critical path.

Requirements in scope: PERF-10, PERF-11, PERF-12, PERF-13, PERF-14.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. The audit already surfaced concrete fixes with file paths + line numbers — use those as the primary reference.

</decisions>

<code_context>
## Existing Code Insights

Audit findings (from the 4-stream perf audit, 2026-04-21):

**PERF-10 — `preload="auto"` → `preload="metadata"`**
- `src/components/viewer/VideoPlayer.tsx:449` — the `<video>` element specifies `preload="auto"`, which downloads the entire video file before the player becomes interactive. One-line change.

**PERF-11 — thumbnail poster**
- `src/components/viewer/VideoPlayer.tsx:444–470` — no `poster` attribute on the `<video>` element. Thumbnail URL is already on the asset doc (`asset.thumbnailUrl`, set during v1.8 Phase 49 / v2.0 work). Adding `poster={asset.thumbnailUrl ?? ''}` gives instant first-frame rendering. One-line change.

**PERF-12 — Fabric.js pre-warm (fire-and-forget)**
- `src/components/viewer/AnnotationCanvas.tsx:100–120` uses `await import('fabric')` inside `useLayoutEffect` when entering annotation mode. Users see a 200–400ms freeze on first click of "Annotate".
- Fix: on `VideoPlayer` mount (or any viewer mount), fire `import('fabric').catch(() => {})` WITHOUT awaiting — this warms the module cache in the background. The actual canvas init still happens lazily in `AnnotationCanvas`, but by the time the user clicks "Annotate", the bundle is already parsed.
- Keep the dynamic import pattern (Fabric stays out of the initial bundle).

**PERF-13 — VUMeter + AudioContext lazy init**
- `src/components/viewer/VideoPlayer.tsx:545–552` always mounts `VUMeter` when `showVU=true`.
- `src/components/viewer/VUMeter.tsx:28–35` creates `AudioContext` + calls `captureStream()` on mount — 20–50ms of main-thread work, and some browsers require user gesture for `AudioContext.resume()`.
- Fix: Add `audioReady` state in VideoPlayer. Only render `<VUMeter>` when `audioReady` is true. Set `audioReady = true` inside `togglePlay()` the first time the user presses play (or another user interaction if needed).

**PERF-14 — Suspense split for comments**
- `src/app/(app)/projects/[projectId]/assets/[assetId]/page.tsx:29–39, 188–194` — calls `useAsset(assetId)` + `useComments(asset?.id)` at the page level and shows a full-screen `<Spinner>` until BOTH resolve.
- Fix: Render `<VideoPlayer>` as soon as `asset` resolves. Wrap the comment sidebar in `<Suspense fallback={<CommentSidebarSkeleton />}>` so comments load in parallel without blocking video playability. Build a minimal `CommentSidebarSkeleton` (a few pulsing list-item rows in `bg-neutral-800/50`, matching the existing sidebar layout).
- Same pattern applies to `src/app/review/[token]/page.tsx` but do NOT try to boil the ocean — apply to the internal asset viewer in phase 74; the review page restructure is phase 76's job.

## Codebase hints

- `asset.thumbnailUrl` is the signed thumbnail URL on the asset doc (set via `/api/assets/[id]/thumbnail`)
- Existing fabric dynamic import pattern lives in `AnnotationCanvas.tsx` — mirror that style for pre-warm
- Existing `useLayoutEffect` cleanup (`fabricRef.current?.dispose()`) already exists in AnnotationCanvas — don't break it
- `VideoPlayer.tsx` already has `isPlaying` state — pair `audioReady` alongside it

</code_context>

<specifics>
## Specific Ideas

- Keep every fix surgical (CLAUDE.md §3). PERF-10 and PERF-11 are literally one line each. PERF-12 is ~3 lines. PERF-13 is ~10 lines. PERF-14 is ~20 lines.
- Do NOT attempt RSC splitting of the asset viewer page in this phase — that's phase 76's concern. PERF-14 is purely the Suspense + skeleton pattern inside the existing client component.
- Scope PERF-14 to the internal viewer at `src/app/(app)/projects/[projectId]/assets/[assetId]/page.tsx`. Do not touch `src/app/review/[token]/page.tsx`.
- Make sure `poster` fallback (`''`) doesn't cause a broken-image icon — test with an asset that has no thumbnail.

</specifics>

<deferred>
## Deferred Ideas

- Review page Suspense restructure → Phase 76 (asset-viewer-restructure)
- ExportModal + AssetCompareModal dynamic-import → Phase 76
- Optimistic comment add → Phase 76
- FPS-detection optimization on upload → deferred (separate upload-perf phase, not in v2.3 scope)

</deferred>
