---
phase: 1
slug: breadcrumb-nav
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright MCP (visual/browser testing — no automated test framework exists) |
| **Config file** | none |
| **Quick run command** | Playwright MCP visual screenshot |
| **Full suite command** | Playwright MCP visual flow walkthrough |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Visual check via Playwright MCP screenshot
- **After every plan wave:** Full breadcrumb navigation flow via Playwright MCP
- **Before `/gsd:verify-work`:** Full visual suite must pass
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 1-01-01 | 01 | 1 | REQ-01 | visual | Playwright MCP screenshot | ⬜ pending |
| 1-01-02 | 01 | 1 | REQ-02 | visual | Playwright MCP click crumb | ⬜ pending |
| 1-01-03 | 01 | 1 | REQ-03 | visual | Playwright MCP project name crumb | ⬜ pending |

---

## Wave 0 Requirements

- None — No automated test framework needed. Validation is via Playwright MCP visual review.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Breadcrumb renders with correct path | REQ-01 | Visual UI verification | Navigate to nested folder, screenshot breadcrumb area |
| Clicking crumb navigates to folder | REQ-02 | Interactive behavior | Click a middle crumb, verify folder contents change |
| Project name appears as first crumb | REQ-03 | Visual UI verification | Screenshot root level and nested level |

---

## Validation Sign-Off

- [ ] All tasks have visual verification via Playwright MCP
- [ ] Breadcrumb visible and correct at each nesting level
- [ ] Clicking each crumb navigates correctly
- [ ] Matches dark theme styling
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
