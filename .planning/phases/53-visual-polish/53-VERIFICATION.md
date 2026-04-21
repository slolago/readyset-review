---
phase: 53-visual-polish
plan: 01
mode: human_needed
status: awaiting_verification
---

# Phase 53 Verification — Human Needed

All 9 auto tasks landed. Task 10 is the blocking human-verify checkpoint.

## Pre-flight

1. Pull the latest `master` (commits `a60291f0..04d54a5f`).
2. `npm install` (no new deps, but safe).
3. `npm run dev` — local server on the usual port.
4. Have at least one project with a folder containing 2+ assets, and one asset with a version stack (`versionCount > 1`).

## 8-step checklist

Walk through the exact steps below. Each corresponds to one VIS requirement.

### 1. VIS-01 — Modal accent clipped

- Go into any project → click `+ Folder` → the New Folder modal opens.
- **Expected:** The thin purple gradient line at the top of the card does NOT extend past the rounded corners. No pixel of the gradient is visible beyond `rounded-2xl`.

### 2. VIS-02 — Folder preview thumbnails

- In a project view, locate a folder card that contains at least 1 asset.
- **Expected:** The card shows 1–4 small tiled thumbnails in the slot that used to hold the Folder icon.
- **Expected:** An empty folder still shows the Folder icon (fallback).
- **Expected:** No layout shift in the folder grid as tiles load.

### 3. VIS-03 — Rename confirm buttons

Asset card rename:
- Hover an asset → open the `…` menu → click Rename.
- Type a new name, **click outside the card** → name does NOT commit (reverts to original).
- Rename again → click the ✓ button → name DOES commit.
- Rename again → press Escape OR click the ✕ button → cancels.

Folder card rename:
- Repeat the same 3 checks for a folder.

### 4. VIS-04 — Aspect-preserving thumbnails

- Upload a tall portrait JPEG (e.g. 1080×1920) to a folder.
- **Expected:** The asset card letterboxes the full image on black — no cropping, no stretching.
- **Expected:** Video cards and wide/landscape images look identical to before.

### 5. VIS-05 — Single version badge

- Find an asset with `versionCount > 1` (V2, V3, etc.).
- **Expected:** Exactly ONE version indicator on the card: the `V{N}` overlay badge on the thumbnail.
- **Expected:** The info row shows filename, size, comment count, upload date — nothing version-related.

### 6. VIS-06 — Legible status pill

- Set an asset to "Approved" whose thumbnail is bright/white.
- **Expected:** The status pill (bottom-left of the thumbnail) is easily readable — a dark translucent backdrop sits behind the badge.
- **Expected:** Other uses of ReviewStatusBadge (viewer header, list view) are visually unchanged.

### 7. VIS-07 — Contained Create Review Link modal

- Open Create Review Link from any folder.
- Test at viewport widths ~1280px AND ~390px (DevTools mobile toolbar).
- **Expected:** Every control — name input, all four toggles, expires grid buttons (Never / 1 day / 7 days / 30 days), password field, Cancel + Create Link buttons — stays inside the rounded card boundary with no horizontal bleed.

### 8. VIS-08 — Distinct Quick Actions

- On the Dashboard page, hover each of the three Quick Action cards.
- **Expected:** URLs in the browser status bar are distinct:
  - Browse Projects → `/projects`
  - Upload Assets   → `/projects?action=upload`
  - Invite Team     → `/projects?action=invite`
- Known follow-up: the projects page does not yet read `?action=*` and open the relevant modal. That wiring is deferred to a follow-up plan (TODO comment in `dashboard/page.tsx`).

## Decision

- Reply **"approved"** if all 8 pass.
- Otherwise list which VIS-NN items regressed and we'll re-open the relevant task.
