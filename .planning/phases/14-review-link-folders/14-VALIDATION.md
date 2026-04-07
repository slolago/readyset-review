---
phase: 14
slug: review-link-folders
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-07
---

# Phase 14 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none |
| **Quick run command** | `npx next lint --quiet` |
| **Full suite command** | `npm run build` |

## Per-Task Verification Map

| Task ID | Plan | Requirement | Test Type | Automated Command | Status |
|---------|------|-------------|-----------|-------------------|--------|
| 14-01-01 | 14-01 | REQ-14A | structural | `npx next lint --quiet 2>&1 \| head -20` | ⬜ pending |
| 14-01-02 | 14-01 | REQ-14B | structural | `npx next lint --quiet 2>&1 \| head -20` | ⬜ pending |
| 14-01-03 | 14-01 | REQ-14C | build | `npm run build 2>&1 \| tail -5` | ⬜ pending |

## Manual-Only Verifications

| Behavior | Requirement | Test Instructions |
|----------|-------------|-------------------|
| Sidebar shows Review Links entry per project | REQ-14A | Expand a project in sidebar; confirm "Review Links" entry visible |
| Review links list shows links as folder cards | REQ-14B | Click Review Links; confirm cards with link name and creation date |
| Clicking link shows its assets | REQ-14C | Click a review link card; confirm assets from that link are shown |
| List view shows creation date | REQ-14C | Toggle to list view; confirm createdAt column visible |
| Assets are read-only (no editing actions) | REQ-14C | Confirm no rename/delete/upload buttons in review link asset view |

**Approval:** pending
