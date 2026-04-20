---
phase: 48
status: human_needed
plan: 01
---

# Phase 48 Verification — Playback Loop & Selection Hierarchy

**Status:** Awaiting human verification (Task 7 checkpoint).

## How to verify

1. `npm run dev`, open a project with at least one video asset.

### Loop — whole video

2. Open any video in the viewer.
3. Click the new loop (Repeat icon) button next to the speed selector. Its color should change to the purple accent.
4. Seek near the end, press play. When the video ends it should restart at 0 and keep playing — no pause.
5. Switch to a different asset (back button, pick another). Return to the first video. Loop should be OFF again (per-session reset).

### Loop — in/out range

6. Open a video. In the comment composer, press **IN** at ~0:02, let playback continue, press **OUT** at ~0:06.
7. Turn loop **ON**. Press play from before the in-point. When playback crosses 0:06 it should snap back to 0:02 and continue. Repeat a couple of cycles.
8. While looping, manually click the scrubber to seek to ~0:10 (outside the range). Playback should continue from 0:10 naturally (no instant snap-back). When the video ends it should jump back to 0:02 (the in-point) and continue looping.

### Selection hierarchy

9. In the projects grid, hover a project card — border goes accent/30. No jitter / layout shift.
10. Open a project → folder grid. Hover a folder card — accent/30 border. Click into a folder.
11. In the asset grid, click the selection checkbox on an asset — card gets solid accent border + ring-1 + subtle bg tint.
12. Check the sidebar tree: the project you're inside should show the **dashed** accent border (parent-of-selected). The active folder row should show the **solid** accent border (selected).
13. Navigate to the project's root page. The project row in the tree should now switch from dashed to solid accent border.

### No regressions

14. Drag an asset card onto another to stack — drop target still shows the ring-2 accent (not blended into plain selection).
15. Annotations, scrubber, frame-step, range comments on the timeline — all still work.

## Resume signal

Type **"approved"** to mark this phase complete, or describe what's off so we can iterate.
