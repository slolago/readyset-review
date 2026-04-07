---
phase: 13
slug: review-polish-and-fixes
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-07
---

# Phase 13 — Validation Strategy

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
| 13-01-01 | 13-01 | 1 | REQ-13A | structural | `npx next lint --quiet 2>&1 \| head -20` | ⬜ pending |
| 13-02-01 | 13-02 | 1 | REQ-13B | structural | `npx next lint --quiet 2>&1 \| head -20` | ⬜ pending |
| 13-03-01 | 13-03 | 1 | REQ-13C | structural | `npx next lint --quiet 2>&1 \| head -20` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — no test framework to install.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| File download goes to disk | REQ-13A | Browser file system | Click Download on any asset; confirm file appears in Downloads folder (not opens in new tab) |
| Three-dot menu renders correctly on review page | REQ-13B | Visual/CSS | Open review link; click ⋯ on asset; verify menu is visible, not clipped |
| Guest cannot see editing actions | REQ-13C | UI conditional rendering | Open review link without logging in; verify no Rename/Delete/Duplicate/Copy actions visible |

---

## Validation Sign-Off

- [x] All tasks have structural `<verify>` commands or build check
- [x] Wave 0: no test framework needed
- [x] No watch-mode flags
- [x] Build check gates wave completion
- [x] Manual tests documented for all 3 requirements
- [x] `nyquist_compliant: true` set in frontmatter (manual-only project)

**Approval:** pending
