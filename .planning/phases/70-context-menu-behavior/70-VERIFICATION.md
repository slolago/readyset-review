---
phase: 70-context-menu-behavior
verified: 2026-04-21T00:00:00Z
status: human_needed
score: 9/9 automated must-haves verified; 4 behaviors require live viewport testing
human_verification:
  - test: "Right-click a folder or asset near the right edge of the viewport"
    expected: "Menu flips left so every item is fully visible and clickable"
    why_human: "Requires real viewport geometry + mouse event at a pixel position; getBoundingClientRect behavior is only observable in a live browser layout"
  - test: "Right-click a folder or asset near the bottom edge of the viewport"
    expected: "Menu flips up so every item is fully visible and clickable"
    why_human: "Same as above — needs live layout at a bottom-adjacent position"
  - test: "Right-click in the bottom-right corner (both edges)"
    expected: "Menu flips on both axes and is fully inside the viewport (>= 8px from each edge)"
    why_human: "Combined flip + clamp behavior must be observed visually"
  - test: "Right-click folder A, then (without dismissing) right-click folder B"
    expected: "First menu disappears; second menu appears at B's position; only one menu in DOM at a time"
    why_human: "Automated check confirms provider holds single state, but the visual swap + absence of stacking needs a live DOM observation"
  - test: "Right-click a folder -> click Rename / Duplicate / Move / Copy / Delete"
    expected: "Action fires; folder does NOT navigate on any item click"
    why_human: "CTX-05 click-through bug was OS/browser-timing-sensitive; defenses are layered but the absence of navigation after each action must be confirmed live"
  - test: "Right-click a folder -> click empty space to dismiss"
    expected: "Menu closes; folder does NOT navigate"
    why_human: "Click-away dismissal without triggering navigate is the core CTX-05 regression"
---

# Phase 70: context-menu-behavior Verification Report

**Phase Goal:** Right-click context menus in the file browser behave predictably — they stay on-screen, close when they should, expose the full action set, and every action actually runs on folders.

**Verified:** 2026-04-21
**Status:** human_needed (all code-verifiable must-haves pass; UI-edge behaviors require live testing)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Menu flips to stay in viewport near right/bottom edges | ? HUMAN (code complete) | `ContextMenu.tsx:54-66` — `useLayoutEffect` reads `getBoundingClientRect`, flips horizontally if `left + rect.width + pad > innerWidth`, flips vertically analogously, then clamps via `Math.max(pad, Math.min(...))`. Logic is structurally correct; actual viewport-edge click behavior can only be confirmed in a live browser. |
| 2a | Click-away closes menu | ✓ VERIFIED | `ContextMenu.tsx:27-52` — document `mousedown` listener calls `onClose` when click is outside `ref.current`. Listener is deferred via `setTimeout(..., 0)` so the opening mousedown doesn't immediately close it. |
| 2b | Escape closes menu | ✓ VERIFIED | `ContextMenu.tsx:31-33` — `keydown` listener on `Escape` calls `onClose`. |
| 2c | Right-clicking a different target replaces (no stacking) | ✓ VERIFIED | `ContextMenu.tsx:109-130` — provider holds a SINGLE `{ key, position, items } \| null` state and renders at most one `<ContextMenu />`. `open()` unconditionally calls `setState(...)`, replacing the previous menu atomically. Two menus in the DOM simultaneously is structurally impossible. |
| 3 | Same unified menu for asset / folder / mixed | ✓ VERIFIED (asset/folder); ⚠️ PARTIAL (mixed) | `fileBrowserActions.ts:54-112` — single `buildFileBrowserActions(target, ctx)` factory used by AssetCard three-dots + right-click, AssetListView row right-click, FolderCard three-dots + right-click. Same variable (`assetActions`, `folderActions`) feeds both surfaces per target. **Mixed selection path:** `target: 'mixed'` is supported by the helper (Open + Rename gated off for mixed), but **no call-site invokes `buildFileBrowserActions('mixed', ...)`**. Right-clicking with a mixed selection today falls back to the per-target helper call (asset card shows asset menu; folder card shows folder menu) — this matches the plan-02 verification note "may be per-target today; CTX-04 acceptable state: same helper, target-appropriate content" and is the acceptance boundary the author explicitly carved out. |
| 4a | Folder right-click runs actions (never falls through to open folder) | ✓ VERIFIED (code); ? HUMAN (live) | `FolderBrowser.tsx:1655-1682` — three layered defenses: (1) `onMouseDown` preventDefault for `button === 2` (line 1658); (2) `suppressNextClickRef` set in `onContextMenu` with 300ms TTL (lines 1679-1680), checked + cleared at top of `onClick` (lines 1664-1667); (3) `role="menu"` target-closest guard in `onClick` (line 1672). Each defense is correctly wired. Live-browser confirmation still needed because the original bug was OS-timing-sensitive. |
| 4b | Three-dots and right-click are identical for folders (and assets) | ✓ VERIFIED | Same `folderActions` variable flows into `<Dropdown items={folderActions.map(...)} />` at line 1760 AND into `ctxMenu.open('folder-${folder.id}', ..., folderActions)` at line 1681. Same `assetActions` feeds both surfaces in AssetCard (lines 408 + 623). Drift is physically impossible. |

**Score:** 6 / 7 truths fully verified by code; 3 require live-UI confirmation to satisfy the "actually works in a viewport" qualifier.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/ui/ContextMenu.tsx` | Measured-flip + singleton provider/hook | ✓ VERIFIED | 136 lines. `getBoundingClientRect` at line 56, `useLayoutEffect` at line 54, `visibility: hidden`-until-measured at line 71, `ContextMenuProvider` at line 109, `useContextMenuController` at line 132, `createContext` at line 107. Legacy `ContextMenu` export preserved at line 22. |
| `src/components/files/fileBrowserActions.ts` | Unified action factory | ✓ VERIFIED | 112 lines (>= 80 min). Exports `ActionTarget` (type), `BrowserAction` (interface), `ActionContext` (interface), `buildFileBrowserActions` (function) — 4 named exports. Asset-only gating at line 79, 91, 100. Mixed-selection gating at 62, 66. |
| `src/components/files/FolderBrowser.tsx` | Provider wrap + FolderCard hardening | ✓ VERIFIED | Outer wrapper at lines 62-68 renders `<ContextMenuProvider>` around `<FolderBrowserInner />`. `useContextMenuController` consumed in both `FolderBrowserInner` (line 205) and `FolderCard` (line 1553). Imports at lines 49-50. |
| `src/components/files/AssetCard.tsx` | Controller consumer + helper consumer | ✓ VERIFIED | `useContextMenuController` at line 65, `buildFileBrowserActions` at line 358, `ctxMenu.open('asset-${asset.id}', ...)` at line 408, Dropdown translation at line 623. |
| `src/components/files/AssetListView.tsx` | Controller consumer + helper consumer | ✓ VERIFIED | `useContextMenuController` at line 242, `buildFileBrowserActions` at line 413, `ctxMenu.open('row-${asset.id}', ...)` at line 454. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `FolderBrowser.tsx` | `ContextMenuProvider` | wraps FolderBrowserInner | ✓ WIRED | `FolderBrowser.tsx:62-68` |
| `FolderBrowserInner` (canvas) | `useContextMenuController` | replaces local useState<{x,y}\|null> | ✓ WIRED | `useState<{...}\|null>(null)` pattern absent; `ctxMenu.open('canvas', ...)` at line 1098 |
| `FolderCard` | `useContextMenuController` | replaces local useState | ✓ WIRED | line 1553 |
| `FolderCard` | `buildFileBrowserActions('folder', ...)` | single source for 3-dots + right-click | ✓ WIRED | `folderActions` built once at line 1624, consumed by both `<Dropdown items={folderActions.map(...)}>` (1760) and `ctxMenu.open(..., folderActions)` (1681) |
| `AssetCard` | `useContextMenuController` | replaces local useState | ✓ WIRED | line 65 |
| `AssetCard` | `buildFileBrowserActions('asset', ...)` | single source for 3-dots + right-click | ✓ WIRED | `assetActions` built once at line 358, consumed by `<Dropdown items={assetActions.map(...)}>` (623) and `ctxMenu.open(..., assetActions)` (408) |
| `AssetListView` (row) | `useContextMenuController` | replaces local useState | ✓ WIRED | line 242 |
| `AssetListView` (row) | `buildFileBrowserActions('asset', ...)` | single source for right-click | ✓ WIRED | line 413, consumed at line 454 |
| FolderCard onClick | suppressNextClickRef | CTX-05 defense 2 | ✓ WIRED | declared 1561, set 1679, TTL-cleared 1680, checked 1664, cleared 1665 |
| FolderCard onClick | `role="menu"` closest guard | CTX-05 defense 1 | ✓ WIRED | line 1672 |
| FolderCard onMouseDown | right-button preventDefault | CTX-05 defense 3 | ✓ WIRED | lines 1655-1659 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `ContextMenu` | `items` prop | `ContextMenuProvider` state, populated by `open(key, pos, items)` | Yes — items come from `assetActions` / `folderActions` / inline canvas array, each is a real `BrowserAction[]` derived from real handlers | ✓ FLOWING |
| `assetActions` (AssetCard) | factory output | `buildFileBrowserActions('asset', { onOpen: onClick, onRename: handleRename, onDuplicate: handleDuplicate, ... })` | Yes — each handler is a real function reference from the component's scope (handleRename does `setIsRenaming`, handleDelete fires delete, etc.) | ✓ FLOWING |
| `folderActions` (FolderCard) | factory output | `buildFileBrowserActions('folder', { onOpen: () => router.push(...), onRename: handleRenameFolder, onDuplicate: onDuplicate, ... })` | Yes — `onDuplicate`, `onDelete`, `onCreateReviewLink`, `onAddToReviewLink`, `onRequestMove` are parent props from `FolderBrowserInner`; when parent supplies them they flow through as menu onClicks. When parent omits (undefined), helper cleanly drops the item. | ✓ FLOWING |
| `assetActions` (AssetListView row) | factory output | `buildFileBrowserActions('asset', { onOpen: () => router.push(...), onRename: () => setIsRenaming(true), ... })` | Yes — same pattern | ✓ FLOWING |

No hollow props detected; no stub data paths.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript clean | `npx tsc --noEmit` | No output (clean) | ✓ PASS |
| ContextMenu export surface | file exports intact: `ContextMenu`, `ContextMenuProvider`, `useContextMenuController`, `MenuItem` | All four found at lines 22, 109, 132, 7 | ✓ PASS |
| fileBrowserActions exports | `grep -cE "^export (function|interface|type) "` | Returns 4: `ActionTarget`, `BrowserAction`, `ActionContext`, `buildFileBrowserActions` | ✓ PASS |
| Zero residual local contextMenu states | regex `useState<{x:number;y:number}\|null>(null)` across all three consumer files | No matches | ✓ PASS |
| Zero literal action labels outside factory | grep `"label: 'Rename'"`, `"label: 'Duplicate'"`, etc. in consumer files | Zero in consumer files; only in `fileBrowserActions.ts` | ✓ PASS |
| Live viewport-edge flip | would require `npm run dev` + real mouse at pixel coords | Not runnable without dev server | ? SKIP |
| Folder right-click actions reach handlers | would require running app + interactive clicks | Not runnable here | ? SKIP |

Spot-checks that require a running browser were routed to Human Verification.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CTX-02 | 70-01 | Right-click menu stays inside viewport; flips up/left when natural anchor would clip | ✓ SATISFIED (code); ? HUMAN (live) | `ContextMenu.tsx:54-66` — real measured flip + final clamp inside 8px padding |
| CTX-03 | 70-01 | Click-away, Escape, or right-clicking another target closes / replaces the menu; single menu invariant | ✓ SATISFIED | Provider singleton (`ContextMenu.tsx:109-130`); outside-click + Escape listeners (27-52) |
| CTX-04 | 70-02 | Right-click menu exposes full action set; matches three-dots; consistent across asset / folder; mixed selection shows one menu | ✓ SATISFIED (asset + folder surfaces); ⚠️ PARTIAL (mixed) | `fileBrowserActions.ts` single factory drives 5 surfaces. Mixed-selection code path (`target: 'mixed'`) exists in the helper but is not invoked at any call site — when a user right-clicks one card with a heterogeneous selection, they see that card's target-specific menu. The author's 70-02 summary explicitly called this out as the acceptance boundary; REQUIREMENTS.md CTX-04 allows "a consistent intersection, or the full set with target-appropriate actions disabled". Today's behavior (same factory, target-appropriate items) is within that envelope but not the strongest interpretation. |
| CTX-05 | 70-02 | Folder right-click menu items run their actions; never falls through to folder-open navigation | ✓ SATISFIED (code); ? HUMAN (live) | Three layered defenses in `FolderBrowser.tsx:1655-1682` |

No orphaned requirements: `grep "Phase 70" REQUIREMENTS.md` lists exactly CTX-02/03/04/05 — all declared across 70-01 and 70-02 PLAN frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | No TODO / FIXME / placeholder / stub returns in touched files | — | — |
| `ContextMenu.tsx` | 72-95 | The rendered `<div>` has no `role="menu"` or `role="menuitem"` on items | ℹ️ INFO | The CTX-05 defense-1 guard in FolderCard (`target.closest('[role="menu"]')`) only catches overlaps with *Dropdown* items (which do set role="menu"). If a ContextMenu item click ever bubbled back to a FolderCard, defense-1 wouldn't catch it — but defense-2 (`suppressNextClickRef`) would, and in practice the ContextMenu is a fixed-portaled child of `document.body` so it never bubbles into a card. Non-blocking; also a minor a11y gap pre-existing to this phase. |

No blockers found.

### Human Verification Required

### 1. Viewport-flip near right edge
**Test:** With a folder/asset grid, right-click on a card whose natural anchor is within ~200px of the right edge of the viewport.
**Expected:** Menu appears to the LEFT of the cursor, fully visible, >=8px from the right edge.
**Why human:** `getBoundingClientRect` behavior depends on real layout; code is structurally correct but the visual result can only be confirmed live.

### 2. Viewport-flip near bottom edge
**Test:** Right-click on a card near the bottom of the viewport.
**Expected:** Menu appears ABOVE the cursor, fully visible, >=8px from the bottom.
**Why human:** Same as above.

### 3. Bottom-right corner (both axes)
**Test:** Right-click a card near the bottom-right viewport corner.
**Expected:** Menu flips to upper-left of cursor; `Math.max(pad, Math.min(...))` clamp keeps it fully inside.
**Why human:** Combined flip + clamp is the subtle edge case for tall menus.

### 4. Single-menu swap behavior
**Test:** Right-click folder A; while its menu is open, right-click folder B (or asset) without dismissing first.
**Expected:** A's menu disappears; B's menu appears; exactly one `<div>` with fixed-position menu in the DOM.
**Why human:** Provider code guarantees the invariant, but live-DOM observation confirms no visual stacking or stale portal.

### 5. Folder right-click -> every action runs
**Test:** Right-click a folder, click each of: Rename, Duplicate, Move to..., Copy to..., Delete. Also right-click a folder and click Create review link / Add to review link... if surfaced.
**Expected:** Each action fires its handler (inline-rename input appears for Rename, duplicate folder appears for Duplicate, move modal opens, etc.); the folder does NOT navigate at any point.
**Why human:** CTX-05 original bug was OS/browser-timing-sensitive; layered defenses are correct on paper but only live testing confirms no regression.

### 6. Right-click folder -> dismiss via outside click -> folder still doesn't navigate
**Test:** Right-click a folder; click empty space or another card (left-click).
**Expected:** Menu closes; originating folder does NOT navigate to its route.
**Why human:** Dismissal-without-navigation is a secondary CTX-05 pitfall.

### Gaps Summary

**No blocker gaps.** All automated checks pass cleanly:
- TypeScript compiles with no errors.
- All five expected artifacts exist at the specified sizes with the specified exports.
- All key wiring links are present (provider wrap, controller consumption in 4 sites, helper consumption in 5 surfaces, three CTX-05 defenses).
- All literal duplicate item arrays (the drift source for CTX-04) are eliminated — `grep label: 'Rename'` / `label: 'Duplicate'` etc. return zero in consumer files and only match inside the single factory.
- The `{x: number; y: number} | null` local-state pattern is gone from all three consumer files.

**Minor / acceptable observations:**
1. **Mixed-selection path is a latent code path.** `buildFileBrowserActions('mixed', ctx)` is implemented and correct but not invoked by any consumer today. When the user has a mixed asset+folder selection and right-clicks one card, they see that card's target-specific menu. The 70-02 summary flagged this explicitly; REQUIREMENTS.md CTX-04 accepts "consistent intersection OR full set with disabled items" — today is closer to "consistent per-target view" than a true intersection. Raise as a follow-up if a product decision demands a true mixed menu.
2. **`ContextMenu` component doesn't set `role="menu"`.** The CTX-05 defense-1 `target.closest('[role="menu"]')` guard relies on Dropdown's `role="menu"` to short-circuit three-dots clicks. ContextMenu items are portaled to body so bubbling to a FolderCard is already impossible in practice, and defense-2 (`suppressNextClickRef`) covers the OS-level synthetic-click path. Non-blocking; minor a11y gap (pre-existing).

**Why status is `human_needed` rather than `passed`:** The four phase success criteria include claims of the form "right-click near the bottom-right corner opens a menu fully visible" and "every folder menu item runs its handler". Those are live-viewport / live-interaction behaviors — the code is structurally correct and every wire is in place, but the phase goal is defined by observable UI behavior at specific pixel positions, not by code structure alone. The six live tests above confirm or refute the goal; nothing in the code review suggests they will fail, but they cannot be automated from this environment without starting a dev server and driving a mouse.

---

_Verified: 2026-04-21_
_Verifier: Claude (gsd-verifier)_
