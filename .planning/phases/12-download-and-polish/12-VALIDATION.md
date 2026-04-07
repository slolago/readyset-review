---
phase: 12
slug: download-and-polish
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-07
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — project has no test framework (jest/vitest/playwright not installed) |
| **Config file** | none |
| **Quick run command** | `npx next lint --quiet` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | lint ~15s, build ~60s |

**Note:** All behavioral verification is manual browser testing. Automated checks are lint + build only.

---

## Sampling Rate

- **After every task commit:** Run lint structural checks from task `<verify>` blocks
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Build must pass + manual smoke test of each REQ

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 12-01-01 | 12-01 | 1 | REQ-12B, REQ-12D, REQ-12E | structural | `npx next lint --quiet 2>&1 \| head -20` | ⬜ pending |
| 12-02-01 | 12-02 | 1 | REQ-12A, REQ-12C, REQ-12F | structural | `npx next lint --quiet 2>&1 \| head -20` | ⬜ pending |
| 12-02-02 | 12-02 | 1 | REQ-12G | build | `npm run build 2>&1 \| tail -5` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — no test framework to install.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Selecting assets shows Download button | REQ-12A | UI interaction + file system | Select 2+ assets; confirm Download button appears; click it; verify files download |
| Header checkbox toggles select/deselect | REQ-12B | UI state interaction | Click header checkbox: all selected. Click again: all deselected. Verify indeterminate on partial. |
| Canvas right-click "Download all" | REQ-12C | UI interaction | Right-click empty space; confirm "Download all" present; click it; verify all assets download |
| Right-click menu dismisses on outside click | REQ-12D | Browser event | Open right-click menu; click anywhere outside it; menu must close immediately |
| Checkbox styling matches dark theme | REQ-12E | Visual | Checkboxes have frame-accent fill when checked; no browser default grey |
| Three-dot menu Download works | REQ-12F | File download | Click ⋯ → Download on an asset; file downloads to disk (not just opens in browser) |
| Review link download button | REQ-12F | UI + auth | Open review link with allowDownloads=true; per-asset download button visible; works |
| Performance: no full re-render on selection | REQ-12G | Browser DevTools | Open React DevTools; select items; only selection-related components should highlight |

---

## Validation Sign-Off

- [x] All tasks have structural `<verify>` commands or build check
- [x] Wave 0: no test framework needed
- [x] No watch-mode flags
- [x] Build check gates wave completion
- [x] Manual tests documented for all 7 requirements
- [x] `nyquist_compliant: true` set in frontmatter (manual-only project)

**Approval:** pending
