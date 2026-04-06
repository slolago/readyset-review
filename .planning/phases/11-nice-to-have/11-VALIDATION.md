---
phase: 11
slug: nice-to-have
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-06
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — project has no test framework (jest/vitest/playwright not installed) |
| **Config file** | none |
| **Quick run command** | `npx next build` (compilation check only) |
| **Full suite command** | `npx next build` |
| **Estimated runtime** | ~60 seconds |

**Note:** This project uses manual browser testing via Playwright MCP for all behavioral verification. No automated test suite exists. All "automated" verify commands in plans are structural (grep) or compilation (`npx next build`) checks only.

---

## Sampling Rate

- **After every task commit:** Run `grep` structural checks specified in task `<verify>` blocks
- **After every plan wave:** Run `npx next build`
- **Before `/gsd:verify-work`:** Build must pass + manual Playwright MCP smoke test
- **Max feedback latency:** N/A (no test framework)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 11-01-01 | 11-01 | 1 | REQ-11B | structural | `grep "customAlphabet\|nanoid" src/app/api/review-links/route.ts` | ⬜ pending |
| 11-01-02 | 11-01 | 1 | REQ-11A | structural | `grep "frame_guest_name" src/app/review/` | ⬜ pending |
| 11-02-01 | 11-02 | 1 | REQ-11C | structural | `grep "ContextMenu" src/components/ui/ContextMenu.tsx` | ⬜ pending |
| 11-02-02 | 11-02 | 1 | REQ-11C | structural | `grep "onContextMenu\|ContextMenu" src/components/files/AssetCard.tsx` | ⬜ pending |
| 11-02-03 | 11-02 | 1 | REQ-11C, REQ-11D | structural | `grep "onContextMenu\|ContextMenu\|onRequestMove" src/components/files/FolderBrowser.tsx` | ⬜ pending |
| 11-02-04 | 11-02 | 1 | REQ-11C | structural + build | `grep "onContextMenu\|ContextMenu" src/components/files/AssetListView.tsx && npx next build` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — no test framework to install. Existing compilation infrastructure covers all automated checks.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| First-time guest sees name modal | REQ-11A | UI interaction, localStorage state | Open `/review/[token]` in incognito; modal should appear before content |
| Returning guest skips modal | REQ-11A | localStorage persistence | Submit name once; reload page; modal should not appear |
| Guest comments show entered name | REQ-11A | Comment submission flow | Submit name "Test User"; post a comment; verify author shows "Test User" not "Guest" |
| New review links use short token | REQ-11B | URL inspection | Create a new review link; confirm URL token is 6-8 alphanumeric chars (not UUID) |
| Old review links still work | REQ-11B | Backward compat | Load an existing UUID-based review link; confirm it opens normally |
| Right-click on asset card | REQ-11C | UI/browser event | Right-click an asset card in grid view; context menu with all 8 items should appear at cursor |
| Right-click on folder card | REQ-11C | UI/browser event | Right-click a folder card; context menu should appear with folder-appropriate items |
| Right-click in list view | REQ-11C | UI/browser event | Switch to list view; right-click a row; context menu should appear |
| Right-click on empty canvas | REQ-11D | UI/browser event | Right-click empty space in folder browser; New Folder / Upload files / Upload folder menu appears |
| Context menu dismisses | REQ-11C, REQ-11D | UI interaction | Click outside menu; press Escape; menu should disappear |
| Native context menu suppressed | REQ-11C | Browser default | Right-click on card; browser's native menu should NOT appear |

---

## Validation Sign-Off

- [x] All tasks have structural `<verify>` grep commands
- [x] Wave 0: no test framework setup needed (none exists in project)
- [x] No watch-mode flags
- [x] Build check (`npx next build`) gates wave completion
- [x] Manual behavioral tests documented above for all 4 requirements
- [x] `nyquist_compliant: true` set in frontmatter (manual-only project)

**Approval:** pending
