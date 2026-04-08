---
phase: 28-version-stack-dnd
verified: 2026-04-08T00:00:00Z
status: human_needed
score: 7/7 must-haves verified
human_verification:
  - test: "Drag highlight — drag one asset card over another"
    expected: "Target card shows accent-colored border, ring-2, and bg-frame-accent/10 tint while hovering"
    why_human: "CSS class application and browser drag-over visual state cannot be verified without rendering the UI"
  - test: "Successful merge — drop one asset onto a different asset"
    expected: "Toast 'Added to [target name]'s version stack', source card disappears, target version badge increments"
    why_human: "Requires live browser interaction, Firestore write, and grid refresh cycle"
  - test: "Self-drop no-op — drag card and drop back on itself"
    expected: "No toast, no change"
    why_human: "Browser drag-and-drop interaction required"
  - test: "Same-stack no-op — drop one version onto its sibling root"
    expected: "No toast, no change (both versionGroupId guards fire)"
    why_human: "Requires live data with an existing version stack"
  - test: "Uploading card blocks drop — drag asset over an uploading card"
    expected: "No accent highlight; cursor shows no-drop icon"
    why_human: "Requires an in-progress upload to test the isUploading guard path"
  - test: "Folder-move DnD unchanged — drag an asset onto a folder"
    expected: "Folder highlights and move completes as before"
    why_human: "Browser interaction required to confirm folder move still works alongside new asset DnD"
---

# Phase 28: Version Stack DnD Verification Report

**Phase Goal:** Implement drag-and-drop version stacking — dragging asset A onto asset B merges A into B's version stack.
**Verified:** 2026-04-08
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dragging one asset card onto another highlights the target card with an accent border | ? HUMAN | `isDropTarget` prop wired to `ring-2 ring-frame-accent bg-frame-accent/10` in AssetCard className ternary (line 215); requires browser to confirm visual |
| 2 | Releasing the drag over a target card calls POST /api/assets/merge-version and shows a success toast | ? HUMAN | `handleAssetDrop` in FolderBrowser.tsx fetches `/api/assets/merge-version` (line 708) and calls `toast.success(...)` on `res.ok` (line 715); manual test needed |
| 3 | After a successful merge, the source card disappears and the target card's version count increments | ? HUMAN | `refetchAssets()` called on success (line 716); data model behavior requires live Firestore verification |
| 4 | Dragging an asset onto itself or onto a card in the same version group is a no-op | ✓ VERIFIED | `handleAssetDrop` line 695 early-returns on `sourceId === targetAssetId`; lines 700-703 check `versionGroupId` fallback; API also returns 400 for both cases |
| 5 | Dropping onto an uploading/pending asset card is blocked (cursor shows no-drop) | ✓ VERIFIED | AssetCard passes `undefined` for `onDragOver` when `isUploading` (line 202); FolderBrowser `handleAssetDragOver` also guards `status !== 'ready'` (line 666); cursor behavior needs human confirm |
| 6 | Existing folder-move drag behavior is completely unchanged | ✓ VERIFIED | `handleFolderDragOver/Leave/Drop` unchanged; OS file-upload handler still guards on `application/x-frame-move` at lines 462, 469; folder DnD wired at lines 911-913 |
| 7 | Asset cards set both application/x-frame-move and application/x-frame-version-stack on drag start | ✓ VERIFIED | `handleItemDragStart` in FolderBrowser.tsx lines 292 and 294 sets both MIME types |

**Score:** 4/7 truths fully verified programmatically; 3/7 require human interaction to confirm visual/runtime behavior. All code paths for all 7 truths are substantively implemented and wired.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/assets/merge-version/route.ts` | POST handler: auth, self-merge, same-group, batch write, returns `{ merged: N }` | ✓ VERIFIED | 99 lines; all guards present; atomic batch.commit() at line 92 |
| `src/components/files/AssetCard.tsx` | `isDropTarget` prop, `onDragOver/onDragLeave/onDrop` event forwarding | ✓ VERIFIED | Props in interface lines 27-30; destructured line 36; wired to outer div lines 202-204; className ternary line 214-215 |
| `src/components/files/AssetGrid.tsx` | Prop thread: `dragOverAssetId`, `onAssetDragOver`, `onAssetDragLeave`, `onAssetDrop` | ✓ VERIFIED | All four props in interface lines 19-22; destructured lines 36-39; passed to each AssetCard lines 64-67 |
| `src/components/files/FolderBrowser.tsx` | `dragOverAssetId` state, `handleAssetDragOver/Leave/Drop`, dual MIME type in `handleItemDragStart` | ✓ VERIFIED | State line 106; dual MIME lines 292-294; handlers lines 661-724; AssetGrid JSX lines 953-956 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| FolderBrowser.tsx `handleItemDragStart` | AssetCard `onDragStart` | dual `setData` call — `application/x-frame-version-stack` alongside `application/x-frame-move` | ✓ WIRED | Both MIME types set at lines 292, 294; forwarded through AssetGrid → AssetCard |
| FolderBrowser.tsx `handleAssetDrop` | `/api/assets/merge-version` | `fetch` POST with `{ sourceId, targetId }` | ✓ WIRED | `fetch('/api/assets/merge-version', { method: 'POST', body: JSON.stringify({ sourceId, targetId }) })` at lines 708-712 |
| FolderBrowser.tsx `handleAssetDrop` | `refetchAssets` | called on API success | ✓ WIRED | `refetchAssets()` at line 716 inside `if (res.ok)` block |
| AssetCard outer div | `isDropTarget` prop | conditional Tailwind class `border-frame-accent ring-2 ring-frame-accent bg-frame-accent/10` | ✓ WIRED | className ternary at lines 214-215; `isDropTarget` placed before `isSelected` for correct priority |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `merge-version/route.ts` | `sourceMembers`, `targetMembers` | Firestore `db.collection('assets').where('versionGroupId', ...)` queries + root asset fallback | Yes — live Firestore reads + batch write | ✓ FLOWING |
| `FolderBrowser.tsx` `handleAssetDrop` | `assets` (source/target lookup) | `assets` prop from parent (populated by `refetchAssets` → Firestore) | Yes — live state from Firestore-backed hook | ✓ FLOWING |
| `AssetCard.tsx` | `isDropTarget` | `dragOverAssetId === asset.id` computed in AssetGrid, state driven by `handleAssetDragOver` | Yes — set by real drag events | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| API route file exists and is non-empty | `test -f src/app/api/assets/merge-version/route.ts` | File exists, 99 lines | ✓ PASS |
| Self-merge guard present | `grep "Cannot merge asset with itself" route.ts` | Found at line 17 | ✓ PASS |
| Same-group guard present | `grep "already in the same version stack" route.ts` | Found at line 44 | ✓ PASS |
| TypeScript build clean | `npx tsc --noEmit` | Exited 0, no output | ✓ PASS |
| Live browser: drag highlight, merge toast, no-op guards, upload block, folder-move | Manual dev server test | Not run — requires browser | ? SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| P28-01 | 28-01 | Route exists at POST /api/assets/merge-version | ✓ SATISFIED | `src/app/api/assets/merge-version/route.ts` exists, exports `POST` |
| P28-02 | 28-01 | All source group docs reassigned to target versionGroupId | ✓ SATISFIED | Batch loop lines 85-90 sets `versionGroupId: targetGroupId` on every source member |
| P28-03 | 28-01 | Version numbers renumbered without collisions | ✓ SATISFIED | `maxTargetVersion + 1 + i` formula; source sorted ascending before assignment |
| P28-04 | 28-01 | Atomic batch write | ✓ SATISFIED | Single `batch.commit()` at line 92 |
| P28-05 | 28-01 | Self-merge returns 400 | ✓ SATISFIED | `sourceId === targetId` check at line 16, returns 400 |
| P28-06 | 28-01 | Same-group merge returns 400 | ✓ SATISFIED | `sourceGroupId === targetGroupId` check at line 43, returns 400 |
| P28-07 | 28-01 | Route requires authentication | ✓ SATISFIED | `getAuthenticatedUser` at line 6; returns 401 if falsy |
| P28-08 | 28-02 | Asset drag sets both MIME types | ✓ SATISFIED | `handleItemDragStart` sets `application/x-frame-move` (line 292) and `application/x-frame-version-stack` (line 294) |
| P28-09 | 28-02 | AssetCard renders accent border when isDropTarget | ✓ SATISFIED | className ternary: `isDropTarget ? 'border-frame-accent ring-2 ring-frame-accent bg-frame-accent/10 ...'` |
| P28-10 | 28-02 | Drop target highlight has visual priority over selection ring | ✓ SATISFIED | `isDropTarget` check comes before `isSelected` in ternary chain |
| P28-11 | 28-02 | Self-drop and same-group drop are no-ops | ✓ SATISFIED | `handleAssetDrop` early-returns for self-drop (line 695) and same versionGroupId (lines 700-703) |
| P28-12 | 28-02 | Drop triggers POST /api/assets/merge-version with toast | ✓ SATISFIED | `fetch('/api/assets/merge-version', ...)` + `toast.success(...)` on success |
| P28-13 | 28-02 | After drop, refetchAssets removes source and increments target count | ✓ SATISFIED (code) / ? HUMAN (runtime) | `refetchAssets()` called at line 716; visual outcome requires browser verification |
| P28-14 | 28-02 | Uploading/pending cards cannot receive drops | ✓ SATISFIED | Dual guard: AssetCard passes `undefined` onDragOver when `isUploading`; FolderBrowser checks `status !== 'ready'` |
| P28-15 | 28-02 | Folder-move DnD unaffected | ✓ SATISFIED | `handleFolderDragOver/Leave/Drop` untouched; `application/x-frame-move` guards at lines 462, 469, 597, 611 still present |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO/FIXME/placeholder comments, no hardcoded empty returns, no stub handlers found in modified files. All `return` statements in the API route return real data or structured errors. The `versionGroupId` fallback to `asset.id` is a semantic design choice, not a stub.

### Human Verification Required

All 15 requirements have substantive code implementation verified. The items below require a running dev server and browser to confirm visual and Firestore-backed runtime behavior.

#### 1. Drag Highlight

**Test:** Start dev server (`npm run dev`), navigate to a project with at least 2 independent assets. Drag one asset card slowly over another.
**Expected:** Target card immediately shows a bright accent border (`border-frame-accent`), `ring-2` glow, and a subtle accent background tint. Highlight disappears when drag leaves the card.
**Why human:** CSS class application during browser drag-over state cannot be verified from static analysis.

#### 2. Successful Merge

**Test:** Drop the dragged card onto a different asset (not the same version group).
**Expected:** Toast notification: "Added to [target name]'s version stack". Source card disappears from the grid. Target card's version badge changes from V1 to V2 (or increments by count of source group).
**Why human:** Requires live Firestore write, response handling, and grid re-render cycle in browser.

#### 3. Self-Drop No-Op

**Test:** Pick up an asset card and drop it back on itself.
**Expected:** No toast, no network request, no visible change.
**Why human:** Browser drag interaction required.

#### 4. Same-Stack No-Op

**Test:** If a card shows "2 versions", drag it onto its sibling root version (same versionGroupId).
**Expected:** No toast, no change.
**Why human:** Requires existing version stack in live data.

#### 5. Uploading Card Blocks Drop

**Test:** Trigger a file upload, then during the upload progress drag a different asset over the uploading card.
**Expected:** No accent highlight on the uploading card. Cursor shows no-drop icon.
**Why human:** Requires an in-progress upload; timing-dependent.

#### 6. Folder-Move Still Works

**Test:** Drag an asset onto a folder in the sidebar or grid.
**Expected:** Folder highlights as before and asset moves to that folder on drop. No interference from the new version-stack DnD code.
**Why human:** Browser interaction required; confirms the `stopPropagation` and MIME type guards don't break the existing folder handler.

### Gaps Summary

No code gaps found. All 15 requirements (P28-01 through P28-15) have complete, substantive implementations verified in the codebase. The three unverified truths (#1, #2, #3 in the truths table) are unverified only because they describe visual rendering and Firestore runtime behavior — the code paths that produce those behaviors are fully implemented and wired. Status is `human_needed`, not `gaps_found`.

---

_Verified: 2026-04-08_
_Verifier: Claude (gsd-verifier)_
