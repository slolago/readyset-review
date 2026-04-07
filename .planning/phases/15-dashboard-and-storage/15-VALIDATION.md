---
phase: 15
slug: dashboard-and-storage
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-07
---

# Phase 15 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none |
| **Quick run command** | `npx next lint --quiet` |
| **Full suite command** | `npm run build` |

## Per-Task Verification Map

| Task ID | Plan | Requirement | Test Type | Automated Command | Status |
|---------|------|-------------|-----------|-------------------|--------|
| 15-01-01 | 15-01 | REQ-15A | structural | `npx next lint --quiet 2>&1 \| head -20` | ⬜ pending |
| 15-02-01 | 15-02 | REQ-15B | structural | `npx next lint --quiet 2>&1 \| head -20` | ⬜ pending |
| 15-02-02 | 15-02 | REQ-15B | build | `npm run build 2>&1 \| tail -5` | ⬜ pending |

## Manual-Only Verifications

| Behavior | Requirement | Test Instructions |
|----------|-------------|-------------------|
| Dashboard shows real project count | REQ-15A | Open dashboard; confirm project count matches actual projects |
| Dashboard shows real asset count | REQ-15A | Open dashboard; confirm assets count is non-zero and accurate |
| Dashboard shows collaborator count | REQ-15A | Open dashboard; confirm collaborators stat is real number |
| Dashboard shows total storage | REQ-15A | Open dashboard; confirm storage shown as MB/GB (not "—") |
| Folder size shown in FolderBrowser | REQ-15B | Navigate to any folder; confirm storage size shown near breadcrumb |
| Folder size includes subfolders | REQ-15B | Navigate to parent folder with subfolders; confirm size > current folder's assets only |

**Approval:** pending
