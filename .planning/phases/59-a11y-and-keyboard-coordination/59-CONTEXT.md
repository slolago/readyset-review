# Phase 59: a11y-and-keyboard-coordination - Context

**Gathered:** 2026-04-20
**Status:** Ready (skip_discuss)

<domain>
A11y + keyboard: focus trap + role=dialog on Modal + UserDrawer, keyboard nav + ARIA on Dropdown, coordinate window.keydown listeners so modal-layer keys don't leak to viewer.
</domain>

<decisions>
### Claude's Discretion
- A11Y-01/02: Build a small `useFocusTrap(ref)` hook; apply to Modal + UserDrawer. Set `role="dialog"` + `aria-modal="true"` + `aria-labelledby` on the title.
- A11Y-03: Dropdown needs `role="menu"`, items get `role="menuitem"`, trigger gets `aria-haspopup="menu"` + `aria-expanded`. Add keyboard nav with active-index state.
- A11Y-04: Shared context-free approach: set `document.body.dataset.modalOpen = 'true'` when a modal opens (Modal + UserDrawer + ConfirmDialog + ExportModal + any other overlay with its own keydown). In keydown handlers (VideoPlayer, VersionComparison, CommentSidebar), check `document.body.dataset.modalOpen` at the top — early-return if set.
</decisions>

<code_context>
- src/components/ui/Modal.tsx
- src/components/admin/UserDrawer.tsx
- src/components/ui/Dropdown.tsx
- src/components/ui/ConfirmDialog.tsx
- src/components/viewer/VideoPlayer.tsx (keydown handler line 162+)
- src/components/viewer/VersionComparison.tsx (keydown handler)
- src/components/viewer/CommentSidebar.tsx
- src/components/viewer/ExportModal.tsx (has its own ESC handler, make sure it sets dataset)
</code_context>

<specifics>
4 REQs: A11Y-01..04
</specifics>

<deferred>None</deferred>
