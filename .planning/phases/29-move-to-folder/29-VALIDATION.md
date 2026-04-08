---
phase: 29
slug: move-to-folder
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest / vitest (Next.js) |
| **Config file** | none — manual E2E verification |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build && npm run lint` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 29-01-01 | 01 | 1 | MOVE-01 | build | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Right-click context menu shows "Move to..." | MOVE-01 | UI interaction | Right-click an asset card → confirm "Move to..." option appears |
| Hover dropdown shows "Move to..." | MOVE-01 | UI interaction | Hover asset card → click "..." → confirm "Move to..." option appears |
| Folder picker modal opens | MOVE-01 | UI modal | Click "Move to..." → confirm modal opens with folder tree |
| Asset moves to destination folder | MOVE-01 | State change | Select destination → confirm → asset disappears from source, appears in destination |
| Version group members all move | MOVE-01 | Batch behavior | Move a versioned asset → confirm all group members relocate together |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
