---
phase: 53-visual-polish
plan: 01
subsystem: ui-polish
tags: [modal, folder-browser, asset-card, review-link, dashboard]
requires:
  - src/lib/auth-helpers (getAuthenticatedUser)
  - src/lib/permissions (canAccessProject)
  - src/lib/gcs (generateReadSignedUrl)
provides:
  - GET /api/folders/[folderId]/preview-assets
  - FolderCard with thumbnail preview tiles
  - Explicit rename confirm affordance (Check + X) in AssetCard & FolderCard
  - Aspect-preserving asset thumbnails (object-contain)
  - Single version badge per AssetCard
  - Legible ReviewStatusBadge over bright thumbnails
  - Contained Create Review Link modal at md size
  - Distinct Dashboard Quick Action hrefs
affects:
  - src/components/ui/Modal.tsx
  - src/app/api/folders/[folderId]/preview-assets/route.ts (new)
  - src/components/files/FolderBrowser.tsx
  - src/components/files/AssetCard.tsx
  - src/components/review/CreateReviewLinkModal.tsx
  - src/app/(app)/dashboard/page.tsx
key-files:
  created:
    - src/app/api/folders/[folderId]/preview-assets/route.ts
  modified:
    - src/components/ui/Modal.tsx
    - src/components/files/FolderBrowser.tsx
    - src/components/files/AssetCard.tsx
    - src/components/review/CreateReviewLinkModal.tsx
    - src/app/(app)/dashboard/page.tsx
decisions:
  - FolderCard preview tiles use a 16x12 tile container; 1/2/4 cells laid out;
    3-item case pads with an empty bg cell in a 2×2 grid.
  - Dashboard Quick Actions use ?action=upload / ?action=invite; projects page
    handler deferred to a follow-up plan (TODO comment in dashboard).
  - Modal overflow-hidden applied to card container; no existing modal renders
    a popover that escapes the card, so horizontal-only clipping is unneeded.
  - ReviewStatusBadge component itself is NOT modified — only the AssetCard
    usage is wrapped in dark translucent backdrop to preserve other contexts.
metrics:
  completed: 2026-04-21
  duration: ~45 minutes
  tasks: 9 auto + 1 human-verify checkpoint
  files_touched: 6
---

# Phase 53 Plan 01: visual-polish Summary

Eight surgical UI fixes for v1.7 QA feedback — modal accent clipping, folder preview thumbnails, explicit rename confirm affordance, aspect-preserving asset thumbnails, single version badge, legible status pill over bright thumbnails, contained review-link modal, and distinct dashboard Quick Action routes.

## Per-VIS Delta

| VIS | Fix | Files | Commit |
| --- | --- | --- | --- |
| VIS-01 | Add `overflow-hidden` to Modal card so the `h-px` accent line is clipped by `rounded-2xl`. | `Modal.tsx` | `a60291f0` |
| VIS-02a | New `GET /api/folders/[folderId]/preview-assets` returns up to 4 most-recent non-deleted assets with signed thumbnail/read URLs, permission-gated via `canAccessProject`. | `preview-assets/route.ts` (new) | `dac0eda6` |
| VIS-02b | `FolderCard` fetches preview tiles on mount (AbortController on unmount), renders 1/2/4 tiles (object-cover) or falls back to the existing Folder icon when empty. | `FolderBrowser.tsx` | `47ce65b0` |
| VIS-03 | Both AssetCard and FolderCard rename: `onBlur={commit*}` removed. Added explicit Check (commit) and X (cancel) buttons next to the input. Enter still commits, Escape still cancels. | `AssetCard.tsx`, `FolderBrowser.tsx` | `2656a2d8` |
| VIS-04 | `object-cover` → `object-contain` on the Image, thumbnail `<img>`, and first-frame `<video>` branches inside the thumbnail container. `aspect-video bg-black` now letterboxes tall sources. Sprite-hover overlay and list view untouched. | `AssetCard.tsx` | `4eb3a64a` |
| VIS-05 | Deleted the `{versionCount} versions` label in the AssetCard info row. `V{N}` overlay badge on the thumbnail is now the single canonical version indicator. | `AssetCard.tsx` | `bf80016d` |
| VIS-06 | Wrapped `ReviewStatusBadge` usage in AssetCard with `bg-black/50 backdrop-blur-sm rounded px-1.5 py-0.5`. Component itself unchanged (other call sites — viewer header, list view — don't sit over bright thumbnails). | `AssetCard.tsx` | `cbaaa57c` |
| VIS-07 | Toggle rows: `gap-3` + `min-w-0` on text wrapper + `flex-shrink-0` on the toggle button. Expires grid: `px-2` → `px-1 min-w-0 truncate` so "30 days" cannot push the grid past the card. Modal.tsx `overflow-hidden` (VIS-01) also contributes. | `CreateReviewLinkModal.tsx` | `c762a3bd` |
| VIS-08 | Upload Assets → `/projects?action=upload`; Invite Team → `/projects?action=invite`; Browse Projects unchanged. TODO comment flags the `?action=` handler as a follow-up. | `dashboard/page.tsx` | `04d54a5f` |

## Files Touched Outside `files_modified`

None — everything in this plan was already listed in the frontmatter `files_modified`.

## Task 10 — Human Verification Checklist

Task 10 is the human-verify checkpoint. No code changes. Run the app locally (`npm run dev`) then walk through each step:

1. **VIS-01** — Open the New Folder modal (any project page → "+ Folder"). The purple gradient accent line at the top does NOT extend past the rounded corners.
2. **VIS-02** — Navigate into any project that contains folders with assets. Each folder card shows 1–4 tiled thumbnails in its icon slot; empty folders still show the Folder icon. No layout shift after the fetch resolves.
3. **VIS-03** — Inline rename: start an asset rename, click outside the card → name is unchanged. Click the check → commits. Start again, type new text, press Escape or click X → reverts. Repeat the same three checks for a folder rename.
4. **VIS-04** — Upload a tall portrait JPEG to a folder. The grid card shows the full image letterboxed on black, not stretched or cropped. Video cards with horizontal thumbnails look identical to v1.7.
5. **VIS-05** — Find an asset with `versionCount > 1`. The card shows exactly ONE version indicator: the `V{N}` overlay badge on the thumbnail. The info row shows only filename, size, comment count (if any), and upload date.
6. **VIS-06** — Set an asset to "Approved" and find one with a bright/white thumbnail. The status pill is legible — dark translucent backdrop sits behind the badge.
7. **VIS-07** — Open Create Review Link on a folder. At 1280px and ~390px viewport widths every control — name input, four toggles, expires grid (Never / 1 day / 7 days / 30 days), password input, Cancel + Create buttons — stays inside the rounded card border.
8. **VIS-08** — From the Dashboard, hover each Quick Action card. URLs in the status bar are distinct:
   - Browse Projects → `/projects`
   - Upload Assets   → `/projects?action=upload`
   - Invite Team     → `/projects?action=invite`

Reply "approved" if all 8 pass. If any regress, list which VIS-NN items need rework.

## Deviations from Plan

None — plan executed exactly as written. `npm` scripts don't include a `typecheck` target, so verification used `npx tsc --noEmit` (clean after every task). No project-wide lint pass run (out of scope; previous phases follow the same convention).

## Follow-up TODOs

- **VIS-08 follow-up:** The projects list page does not yet read `?action=upload` / `?action=invite`. Wiring those into the upload modal + invite modal should be a small plan in a later phase. The TODO comment in `dashboard/page.tsx` flags this.

## Known Stubs

None.

## Self-Check: PASSED

- `src/app/api/folders/[folderId]/preview-assets/route.ts` — FOUND
- All 9 commits present: `a60291f0`, `dac0eda6`, `47ce65b0`, `2656a2d8`, `4eb3a64a`, `bf80016d`, `cbaaa57c`, `c762a3bd`, `04d54a5f`
- `npx tsc --noEmit` clean after each task
