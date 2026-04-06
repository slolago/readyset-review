# Phase 11: nice-to-have - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning
**Source:** User decisions (conversation)

<domain>
## Phase Boundary

Four additions to the existing file browser and review link system:
1. **Guest name prompt** — When an external guest opens a review link for the first time, they see a name modal before accessing content. Name saved to localStorage; not shown again on same browser.
2. **Short review link tokens** — Review link URLs use a 6-8 char alphanumeric token instead of a UUID. New links get short tokens; old links continue working.
3. **Right-click context menu on asset/folder cards** — Native browser contextmenu event triggers a custom overlay menu at cursor position. Menu mirrors the existing MoreHorizontal dropdown: Open, Rename, Duplicate, Copy to, Move to, Download, Get link, Delete. Works in both grid and list view.
4. **Right-click context menu on empty canvas** — Right-clicking on the empty FolderBrowser area (not on a card) shows: New Folder, Upload files, Upload folder.

</domain>

<decisions>
## Implementation Decisions

### Guest Name Prompt
- Shown only on external review pages (`/review/[token]` route), never in the main app
- Modal blocks access to review content until name is submitted
- Name stored in localStorage key `frame_guest_name`
- If localStorage already has a name, skip the prompt entirely
- Guest name used in the comment author field (instead of "Guest")
- No backend storage — purely client-side localStorage

### Short Review Link Tokens
- Token format: 6-8 alphanumeric chars (e.g. `xK3mP9`, `aB7qR2wL`)
- Generated on the server at review link creation time using nanoid or similar
- New links get short tokens; existing links (UUID-based) continue working — no migration
- Firestore doc ID remains the token itself (established in Phase 5 bug fix)
- No collision detection needed at this scale (62^6 ≈ 56 billion combinations)

### Right-Click Context Menu — Asset/Folder Cards
- Triggered via `onContextMenu` handler on the card container
- Prevents browser default context menu with `e.preventDefault()`
- Menu rendered as a fixed-position overlay at `{x: e.clientX, y: e.clientY}`
- Same actions as existing MoreHorizontal dropdown:
  - **Open** — navigate to asset detail or folder
  - **Rename** — same inline rename flow as existing
  - **Duplicate** — same duplicate flow as existing
  - **Copy to** — same copy modal as existing
  - **Move to** — same move modal as existing
  - **Download** — direct download via signed URL (new — not in MoreHorizontal yet)
  - **Get link** — copy asset URL or review link to clipboard
  - **Delete** — same delete flow as existing
- Divider before Delete (same style as existing dropdown divider)
- Dismisses on: click outside menu, Escape key, scroll
- Must work in both grid view (AssetCard/FolderCard) and list view (AssetListRow/FolderCard)
- Reuse existing action handlers — context menu is a second trigger surface, not a replacement

### Right-Click Context Menu — Empty Canvas
- Triggered by `onContextMenu` on the FolderBrowser content wrapper, but only if the event target is NOT a card (`[data-selectable]`) or descendant
- Same fixed-position overlay pattern as item context menu
- Actions:
  - **New Folder** — opens existing new folder dialog
  - **Upload files** — triggers file input click (same as header Upload button)
  - **Upload folder** — triggers folder input click (same as header Upload Folder button)
- Dismisses same way as item context menu

### Context Menu Component
- Single reusable `<ContextMenu>` component (`src/components/ui/ContextMenu.tsx`)
- Props: `items: MenuItem[]`, `position: {x, y}`, `onClose: () => void`
- `MenuItem`: `{ label, icon?, onClick, dividerBefore?, disabled? }`
- Portal-rendered into document.body to escape any `overflow:hidden` ancestors
- Style consistent with existing Dropdown component (same dark bg, same item hover)

### Claude's Discretion
- Exact positioning logic (flip-to-avoid-viewport-edge)
- Whether to use a global context menu state provider or per-component local state
- Download implementation detail (anchor with `download` attr vs. `fetch` + `createObjectURL`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Context Menu / Dropdown Patterns
- `src/components/ui/Dropdown.tsx` — existing dropdown component; context menu should match its visual style
- `src/components/files/AssetCard.tsx` — has MoreHorizontal dropdown with Rename/Duplicate/Copy to/Move to/Delete; context menu reuses these handlers
- `src/components/files/FolderCard.tsx` — same as AssetCard for folder-specific actions
- `src/components/files/AssetListView.tsx` — list view rows; needs onContextMenu wired up

### Review Link System
- `src/app/review/[token]/page.tsx` (or equivalent) — review page where guest name prompt lives
- `src/app/api/review-links/route.ts` — POST handler that creates review links; token generation here
- `src/app/api/review-links/[token]/route.ts` — GET handler; already uses token as doc ID

### File Browser
- `src/components/files/FolderBrowser.tsx` — main browser; add canvas right-click handler here
- `src/components/files/AssetListView.tsx` — list view; wire up onContextMenu on rows

### Project State
- `.planning/STATE.md` — architecture decisions log
- `.planning/ROADMAP.md` — updated phase 11 with REQ-11C, REQ-11D

</canonical_refs>

<specifics>
## Specific Ideas

From user screenshots:
- **Asset/folder context menu items (in order)**: Open, Rename, Duplicate, Copy to, Move to, Download, Get link, Delete (with divider before Delete)
- **Canvas context menu items**: New Folder, Upload files, Upload folder
- Style matches Frame.io dark theme — consistent with existing app dark palette

</specifics>

<deferred>
## Deferred Ideas

- Server-side guest name persistence (could store in Firestore for analytics later)
- Keyboard navigation within context menu (arrow keys, Enter)
- Context menu on asset in review page (out of scope for this phase)
- Migrating existing UUID review link tokens to short tokens

</deferred>

---

*Phase: 11-nice-to-have*
*Context gathered: 2026-04-06 via conversation*
