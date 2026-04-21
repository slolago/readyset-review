---
phase: 71-grid-view-affordances
verified: 2026-04-21T00:00:00Z
status: human_needed
score: 3/3 must-haves verified (automated); UI interactions require human smoke test
human_verification:
  - test: "Folders-only list view renders rows"
    expected: "Open a folder that contains only subfolders (no assets). Click the list-view icon in the header. Folders render as a table with one row per folder showing checkbox, icon, name, date created, and three-dots column. Clicking a row navigates into that folder. Right-click opens the same context menu as the grid card. Toggle back to grid restores the FolderCard grid."
    why_human: "Requires running app + navigation into a real folders-only folder; visual/interactive behavior cannot be grep-verified"
  - test: "Asset three-dots clickable over video hover preview"
    expected: "Open a folder containing a video asset in grid view. Hover the card — sprite preview appears and scrubs with mouse X. Move cursor up to the top-right corner over the three-dots button — button remains visible and clicking it opens the asset action dropdown. Moving the cursor back off the button onto the rest of the thumbnail continues to scrub."
    why_human: "Requires real-time mouse interaction with the hover-preview overlay; pointer-events + z-index layering cannot be proven by static analysis alone"
  - test: "Asset vs folder three-dots parity"
    expected: "Hover a folder card's three-dots and an asset card's three-dots side-by-side. Both reveal on hover with identical styling (w-7 h-7, black/60 bg, MoreHorizontal icon), both open a Dropdown with the same menu item ordering/labels (Open, Rename, Duplicate, Copy to, Move to, Create review link, Add to review link, Delete)."
    why_human: "Visual parity confirmation"
---

# Phase 71: grid-view-affordances Verification Report

**Phase Goal:** Grid and list view work in all folder states, and the per-card three-dots button on assets is reliably clickable without the hover preview stealing the pointer.
**Verified:** 2026-04-21
**Status:** human_needed — all automated checks pass; UI interactions require a human smoke test before closing the phase
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | List/grid toggle renders folders as rows in folders-only folders (VIEW-01) | ✓ VERIFIED (code) / ? HUMAN (interaction) | `FolderBrowser.tsx:1177` branches folders block on `viewMode === 'grid'`; list branch instantiates `FolderListView` (1205) which renders a `<table>` of `FolderListRow`s. View toggle at 1050-1074 is unconditional. `AssetListView` empty-guard untouched — folders block now renders independently. |
| 2 | Asset three-dots stays clickable during video hover preview (VIEW-02) | ✓ VERIFIED (code) / ? HUMAN (interaction) | `AssetCard.tsx:618` actions wrapper raised to `z-20`. `AssetCard.tsx:521` sprite overlay `pointer-events-none`. `AssetCard.tsx:533` scrub bar `pointer-events-none`. `AssetCard.tsx:543` loading spinner `pointer-events-none`. Parent `onMouseMove` at line 426 preserved (scrub continues to work via event bubbling). |
| 3 | Asset three-dots behaves identically to folder three-dots | ✓ VERIFIED | Both wrappers use `absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity`, both wrap a `Dropdown` with the same `w-7 h-7 … bg-black/60 backdrop-blur-sm` trigger button + `MoreHorizontal w-4 h-4` icon. FolderCard uses `z-10` (sufficient because FolderCard has no sprite overlay); AssetCard deliberately uses `z-20` to exceed the `z-[2]` scrub layer. Menu content driven by `buildFileBrowserActions` on both sides. |

**Score:** 3/3 truths verified by static analysis; all 3 have a behavioral component needing human confirmation.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/components/files/FolderBrowser.tsx` | viewMode branch + FolderListView + FolderListRow | ✓ VERIFIED | 1177: `viewMode === 'grid' ?` branch. 1886-1947: `FolderListView` React.memo wrapper. 1973-2157: `FolderListRow` with checkbox, folder icon, InlineRename-capable name, formatRelativeTime date, three-dots Dropdown, ctxMenu, CTX-05 suppression, drag/drop. |
| `src/components/files/AssetCard.tsx` | Three-dots wrapper raised above sprite overlay | ✓ VERIFIED | 618: `z-20` on actions wrapper. 521/533/543: `pointer-events-none` on all three hover-preview layers. 426: parent `onMouseMove` preserved. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| FolderBrowser folders block | viewMode state | Conditional branch on viewMode for grid/list rendering | ✓ WIRED | Line 1177 `{viewMode === 'grid' ? (<grid>) : (<FolderListView />)}`. Both branches consume `sortedFolders` (real data from `folders` prop via useMemo sort at line 173). |
| AssetCard actions wrapper | sprite + scrub overlays | z-20 wrapper over pointer-events-none overlays | ✓ WIRED | Wrapper z-20 (618) > scrub z-[2] (533) > sprite z-[1] (521). All three overlays have `pointer-events-none`, so the overlay stack no longer captures clicks in the button region; mouse events fall through to the z-20 wrapper AND to the parent div for scrub. |
| Grid FolderCard & new FolderListRow | buildFileBrowserActions('folder', …) | Both rows construct identical menu via shared helper | ✓ WIRED | Occurrences at 1655 (FolderCard) and 2035 (FolderListRow) — same callback shape, same icon set, same handler wiring. |
| Grid + list rows | handleCopyFolder / handleDuplicateFolder | Lifted helpers (852, 871) shared between both branches | ✓ WIRED | Grid passes per-folder lambdas (1192-1193); list passes helper directly since `FolderListView` forwards the folder on each call (1216-1217). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| FolderListView | `folders` prop | `sortedFolders` (173) derived from parent `folders` prop (real Firestore list) | ✓ Yes | ✓ FLOWING |
| FolderListRow | `folder` prop | Map from `sortedFolders` (1920); fields `name`, `createdAt`, `id` all used with Firestore shape fallback (2058-2061) | ✓ Yes | ✓ FLOWING |
| AssetCard three-dots | `folderActions` (was `assetActions` in AssetCard) | Menu items from parent's `onXxx` callbacks — unchanged by this phase; wrapper layering change only | ✓ Yes | ✓ FLOWING |

No stubs, no hardcoded empty arrays, no disconnected props found in the changed regions.

### Behavioral Spot-Checks

Step 7b: SKIPPED (UI-only changes — no runnable entry point that can verify interactive pointer-events / hover behavior without a browser). `npx tsc --noEmit` already confirmed clean compilation during author's final verification; repeat run during this verification also produced no output (clean).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| VIEW-01 | 71-01-PLAN.md | List/grid toggle available & functional in folders-only listings; switching to list renders folders as rows | ✓ SATISFIED (pending human interaction smoke) | `viewMode === 'grid' ? grid : <FolderListView>` branch at 1177; FolderListView renders `<table>` of FolderListRow (1886-1947); view toggle itself was already unconditional |
| VIEW-02 | 71-01-PLAN.md | Three-dots on asset cards stays reachable over hover preview | ✓ SATISFIED (pending human interaction smoke) | z-20 wrapper + pointer-events-none on sprite/scrub/spinner overlays (521, 533, 543, 618); parent onMouseMove preserved (426) |

No orphaned requirements — REQUIREMENTS.md maps only VIEW-01 + VIEW-02 to Phase 71, both claimed by 71-01-PLAN.

### Anti-Patterns Found

None. No TODO / FIXME / placeholder / stub patterns in either modified file. No `return null` / `return []` / hardcoded-empty-props anti-patterns in the changed regions. Type-check clean. Author reports lint clean (no new warnings).

### Acceptance-Criteria Audit (Plan 71-01)

All author-claimed acceptance criteria re-verified against HEAD:

Task 1 (VIEW-01):
- ✓ `viewMode === 'grid' ?` inside folders block — 1 match (line 1177)
- ✓ `FolderListView` — 5 matches (interface, memo wrapper, `FolderListView({`, type annotation, usage at 1205)
- ✓ `FolderListRow` — 6 matches (comment, interface, function decl, props type, usage in FolderListView, plus declaration comment)
- ✓ `ctxMenu.open(\`folder-${folder.id}\`, …)` — 2 matches (grid FolderCard 1712, list row 2092)
- ✓ `buildFileBrowserActions('folder', …)` — 2 matches (1655, 2035)
- ✓ `suppressNextClickRef` — 10+ matches (grid decl 1592 + list decl 2002 + setters/clears in both)
- ✓ `grid grid-cols-2 sm:grid-cols-3` preserved — 1 match (1178)
- ✓ `npx tsc --noEmit` clean (re-ran during this verification: no output)

Task 2 (VIEW-02):
- ✓ `absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100` — 1 match (line 618)
- ✓ `absolute inset-0 z-[1] bg-black pointer-events-none` — 1 match (line 521)
- ✓ `h-[3px] bg-black/40 z-[2] pointer-events-none` — 1 match (line 533)
- ✓ `bottom-1 right-1 z-[2] … pointer-events-none` — 1 match (line 543)
- ✓ No stale `absolute top-2 right-2 opacity-0 group-hover` without z-20 — 0 matches (all surviving matches include z-20)
- ✓ `onMouseMove={asset.type === 'video' && isHovering && spriteLoaded ? handleHoverScrub …}` preserved (line 426)

### Human Verification Required

See frontmatter `human_verification`. Three interactive smoke tests are needed because z-index / pointer-events / hover-scrub are runtime-layer behaviors that static analysis can infer but not observe.

### Gaps Summary

None. Both plans executed as specified; the single deviation (adding `InlineRename` + `formatRelativeTime` imports) was a correct Rule-3 catch during execution — the plan's "no new imports" claim was wrong and the author documented the override in 71-01-SUMMARY.md.

The stacking-order reasoning is sound: the new `z-20` wrapper sits above the `z-[2]` scrub bar and the `z-[1]` sprite, and because all hover-preview chrome is now `pointer-events-none`, clicks in the top-right corner deterministically reach the three-dots button. Scrub is preserved because `onMouseMove` is on the parent thumbnail div (not an overlay), and mouse events bubble to it from any child — including through pointer-events-none overlays (events fall through) and from the z-20 wrapper (events bubble up).

The folders-block branch is clean: grid keeps its exact prior markup, list delegates to a new memo'd `FolderListView` that shares `handleCopyFolder` / `handleDuplicateFolder` / `buildFileBrowserActions('folder', …)` with the grid card — guaranteeing menu parity.

---

_Verified: 2026-04-21_
_Verifier: Claude (gsd-verifier)_
