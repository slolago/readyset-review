---
phase: 57-ux-and-dashboard
plan: 01
subsystem: ux-polish
tags: [dashboard, review-links, comments, admin, rename]
requires: [53]
provides:
  - inline-rename-shared-component
  - guest-comment-auth-branch
  - dashboard-collaborator-card
  - review-expiry-ux
  - guest-info-localstorage-migration
affects: []
tech-stack:
  added: []
  patterns:
    - "Guest auth branch on comment mutation routes (?reviewToken + X-Guest-Name header)"
    - "Shared InlineRename primitive — Enter commits, Escape cancels, blur does NOT commit"
    - "localStorage migration pattern: read new JSON key, fall back to legacy string key, write new on miss"
key-files:
  created:
    - src/components/ui/InlineRename.tsx
  modified:
    - src/app/(app)/dashboard/page.tsx
    - src/app/(app)/projects/page.tsx
    - src/app/api/comments/[commentId]/route.ts
    - src/app/review/[token]/page.tsx
    - src/components/viewer/CommentItem.tsx
    - src/components/files/AssetCard.tsx
    - src/components/files/AssetListView.tsx
    - src/components/admin/UserTable.tsx
    - src/components/review/ReviewHeader.tsx
decisions:
  - "Guest delete ownership = authorName match via X-Guest-Name header — lightweight, matches existing guest POST identity model. Full ownership is out of scope."
  - "Dashboard grid: grid-cols-2 md:grid-cols-3 lg:grid-cols-5 so five cards flow on narrow viewports."
  - "Legacy frame_guest_name key intentionally preserved on migration (not deleted) to tolerate stale tabs running older bundles."
metrics:
  duration: 7m
  completed: 2026-04-21
---

# Phase 57 Plan 01: UX and Dashboard Polish Summary

Polished the last cohort of broken UX affordances from the v1.9 audit: wired dead Quick Actions, restored review-link guest comment actions, migrated AssetListView rename to a shared inline component, unified admin delete via useConfirm, surfaced collaborator count + expiry state, and persisted guest email across reload.

## What shipped

### UX-01 — Dashboard Quick Actions (commit `b2a261f5`)
- `src/app/(app)/projects/page.tsx`: new `?action=upload|invite` handler. If projects exist, redirects to `/projects/{firstProjectId}?action=...`; otherwise opens CreateProjectModal with a toast prompting project creation. Effect gated by a `useRef` flag so it runs once per mount.
- `src/app/(app)/dashboard/page.tsx`: removed VIS-08 TODO block; three Quick Actions now resolve to three distinct live destinations.

### UX-02 — Guest-capable comment resolve & delete (commit `7363bcf5`)
- `src/app/api/comments/[commentId]/route.ts`: both PUT and DELETE now branch on `?reviewToken=`. Guest PUT is whitelisted to `resolved: boolean` only. Guest DELETE requires `!comment.authorId` (guest-authored), matching `reviewLinkId`, and `X-Guest-Name` header equal to `comment.authorName`. Uses `assertReviewLinkAllows(link, 'comment')` from `lib/permissions.ts`.
- `src/app/review/[token]/page.tsx`: new `handleResolveComment` / `handleDeleteComment` that call `/api/comments/{id}?reviewToken={token}` with `X-Guest-Name` header, replacing the stubbed `async () => false` handlers.
- `src/components/viewer/CommentItem.tsx`: `canDelete` widened with `(!user && !comment.authorId)` so guests see the trash icon on their own guest comments.

### UX-03 — <InlineRename/> extraction (commit `36bd0626`)
- New `src/components/ui/InlineRename.tsx` — controlled input with `onCommit(next)` / `onCancel`, check/X buttons, Enter commits, Escape cancels. Blur does NOT commit (per Phase 53 fix). `selectOnMount` prop, default true.
- `AssetCard.tsx`: removed `renameValue`/`renameInputRef` state, `commitRename` now takes `next: string` arg. Replaced inline 30-line input/button block with `<InlineRename>`.
- `AssetListView.tsx`: deleted the `window.prompt`-based `handleRename`, added `isRenaming` state + `commitRename(next)`, swapped the Name cell's static span for `<InlineRename>`. ContextMenu "Rename" now sets `isRenaming=true`. Name `<td>` stops propagation while renaming so the row click doesn't navigate mid-edit.

### UX-04 — UserTable delete via useConfirm (commit `eb689266`)
- Removed the two-stage `confirmDelete` inline "Sure? / Yes, delete / Cancel" branch.
- `handleDelete` now opens a destructive `ConfirmDialog` via `useConfirm()`.
- Single hover-revealed Delete button, disabled during deletion.

### UX-05 — Collaborators stat card (commit `c856f0dd`)
- Dashboard grid widened from 4 to 5 cards: `grid-cols-2 md:grid-cols-3 lg:grid-cols-5`.
- New `<StatCard>` reading `stats.collaboratorCount` inserted between Assets and Review Links.
- Added `pink` entry to `colorMap` so the new card is visually distinct from the existing Projects (purple).

### UX-06 — Expiry banner + expired screen (commit `82571f59`)
- `src/components/review/ReviewHeader.tsx`: inlined `formatHoursRemaining(ms)` helper. Renders a yellow banner below the header when `reviewLink.expiresAt` is within 24h (and not yet past). Header wrapped in fragment.
- `src/app/review/[token]/page.tsx`: `fetchReview` now parses the server error body (`{ error }`) instead of swallowing it with a generic string. When `error` matches `/expired/i`, renders a dedicated "This link has expired" screen with a Clock icon. Client-side guard: if `data.reviewLink.expiresAt` is in the past at any point, force-render the expired screen (covers the mid-session race).

### UX-07 — `frame_guest_info` JSON key (commit `b239bf0b`)
- `useState` initializer reads `frame_guest_info` (new key) as JSON; on miss, reads legacy `frame_guest_name` string, writes migrated JSON `{name, email:''}` to the new key, returns it.
- `handleGuestSubmit` writes JSON to `frame_guest_info`.
- Legacy key left in place — follow-up will purge once all clients are on new code.

## Deviations from Plan

None — plan executed as written.

Minor refinements:
- `formatHoursRemaining` kept inline in ReviewHeader.tsx (single caller), matching the plan's "inline is simpler" guidance.
- Dashboard grid uses `grid-cols-2 md:grid-cols-3 lg:grid-cols-5` (vs plan's `grid-cols-2 lg:grid-cols-5`) per executor-prompt guidance to flow on narrow viewports.

## Verification

- `npx tsc --noEmit` — 0 errors (run after each task).
- `npx vitest run` — 138/138 passed across 3 test files (format-date, permissions, permissions-api).
- `grep window.prompt src/components/files/` — 0 matches.
- Automated node-eval checks from each task's `<verify>` block — all passed.

## Follow-ups

- Projects detail page `?action=upload|invite` consumer — this plan only guarantees the dashboard link resolves to a real project URL; the detail page does not yet open the upload or invite sheet when it sees `?action=`. Pick up in a follow-up REQ.
- Purge `frame_guest_name` legacy key once rollout window for UX-07 migration has elapsed.
- Full guest ownership model (beyond authorName match) for comment delete — currently any two guests sharing a link who pick the same name could delete each other's comments. Acceptable for the current link-gated threat model; revisit if review links gain authenticated guest sessions.

## Self-Check: PASSED

Files verified:
- FOUND: src/components/ui/InlineRename.tsx
- FOUND: src/app/(app)/dashboard/page.tsx
- FOUND: src/app/(app)/projects/page.tsx
- FOUND: src/app/api/comments/[commentId]/route.ts
- FOUND: src/app/review/[token]/page.tsx
- FOUND: src/components/viewer/CommentItem.tsx
- FOUND: src/components/files/AssetCard.tsx
- FOUND: src/components/files/AssetListView.tsx
- FOUND: src/components/admin/UserTable.tsx
- FOUND: src/components/review/ReviewHeader.tsx

Commits verified: b2a261f5, 7363bcf5, 36bd0626, eb689266, c856f0dd, 82571f59, b239bf0b
