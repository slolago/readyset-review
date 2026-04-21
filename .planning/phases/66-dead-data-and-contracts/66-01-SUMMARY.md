---
phase: 66
plan: 01
subsystem: architecture-hardening
tags: [cleanup, types, abort-controller, firestore, sprite, probe]
requires: []
provides:
  - Removed Asset.url phantom field
  - Unified sprite URL field name across list + on-demand endpoints
  - Complete UploadCompleteRequest type
  - Race-free folder switches in useAssets
  - O(1) review-link folder ancestry check
  - Safer /tmp cleanup on sprite size-abort
  - Explicit probed:false for provisional client video metadata
affects:
  - src/types/index.ts
  - src/app/api/upload/signed-url/route.ts
  - src/app/api/upload/complete/route.ts
  - src/app/api/assets/[assetId]/generate-sprite/route.ts
  - src/app/api/review-links/[token]/route.ts
  - src/components/files/AssetCard.tsx
  - src/components/viewer/VersionComparison.tsx
  - src/components/viewer/ImageViewer.tsx
  - src/hooks/useAssets.ts
tech-stack:
  added: []
  patterns:
    - AbortController in data hooks
    - Denormalized path[] for ancestry
key-files:
  created:
    - .planning/phases/66-dead-data-and-contracts/66-01-PLAN.md
    - .planning/phases/66-dead-data-and-contracts/66-01-SUMMARY.md
    - .planning/phases/66-dead-data-and-contracts/66-01-VERIFICATION.md
  modified:
    - src/types/index.ts
    - src/app/api/upload/signed-url/route.ts
    - src/app/api/upload/complete/route.ts
    - src/app/api/assets/[assetId]/generate-sprite/route.ts
    - src/app/api/review-links/[token]/route.ts
    - src/components/files/AssetCard.tsx
    - src/components/viewer/VersionComparison.tsx
    - src/components/viewer/ImageViewer.tsx
    - src/hooks/useAssets.ts
decisions:
  - Drop asset.url fallbacks entirely rather than keep a dead `|| asset.url` branch — bucket is private, public URL never resolved.
  - Set probed:false only for videos (images keep probed:true — no ffprobe).
  - Single-doc read via Folder.path[] replaces the parentId walk; skip full project scan when link is project-scoped (same semantics as before).
metrics:
  duration_sec: 901
  completed: 2026-04-21
  tasks: 7
  files_modified: 9
---

# Phase 66 Plan 01: Dead Data & Contracts Cleanup Summary

Seven independent cleanups — phantom fields, inconsistent naming, incomplete types, stale-response races, O(N) ancestry walks, unclean writer teardown, ambiguous probe state — each shipped as its own commit with type/test verification.

## Tasks

### CLN-01 — Remove Asset.url phantom field
Commit: `2c6e4ad5`
- Dropped `url: string` from the `Asset` interface.
- Removed the `getPublicUrl()` write in `/api/upload/signed-url`.
- Swapped the `(asset as any).signedUrl || asset.url` fallbacks in `VersionComparison.tsx` and `ImageViewer.tsx` to `(asset as any).signedUrl ?? ''`. The public URL never resolved (bucket is private) so the fallback was dead code.
- `grep asset.url` across src/ → zero hits.

### CLN-02 — Unify sprite URL naming
Commit: `afdb6386`
- `/api/assets/[assetId]/generate-sprite` now returns `spriteSignedUrl` on both the cached-hit path and the fresh-generation path (was `spriteStripUrl`).
- `AssetCard.ensureSprite` reads `data.spriteSignedUrl`. Same field name is used by the list endpoint — one name everywhere.

### CLN-03 — Complete UploadCompleteRequest
Commit: `1d0b0dbe`
- Added `frameRate?: number`, `thumbnailGcsPath?: string`, `mimeType?: string` to the type. All are either read by the server's `request.json()` destructure or included per plan spec.

### CLN-04 — AbortController in useAssets.fetchAssets
Commit: `c4a07fbf`
- Ported the pattern verbatim from `useComments.ts`: signal plumbed through `fetch`, AbortError swallowed, aborted-flag guards on `setLoading`, `useEffect` creates a fresh `AbortController` and returns `ctrl.abort` as cleanup.
- `refetch: fetchAssets` keeps its old zero-arg call signature (signal is optional).

### CLN-05 — O(1) folder ancestry via Folder.path[]
Commit: `72986837`
- Rewrote `folderIsAccessible` inside `/api/review-links/[token]/route.ts`: one doc read, then set-membership of the folder's `path[]` against `editableRoots`.
- Replaces the parentId walk (up to 20 sequential Firestore reads per folder check).

### CLN-06 — Clean writer/reader teardown on sprite size-abort
Commit: `a08ae740`
- On the `downloaded > MAX_BYTES` branch, now `writer.destroy(); await reader.cancel().catch(()=>{}); await once('close')` before returning.
- The `finally { fs.rm(tmpDir) }` block no longer races an open fd → no EBUSY on cleanup.

### CLN-07 — Explicit probed:false for client video metadata
Commit: `c36ab4a4`
- Videos arriving at `/api/upload/complete` now get `probed: false` explicitly. The background ffprobe flip to `true` is already wired.
- Images keep `probed: true` (no ffprobe path).
- Consumers can now differentiate "no probe yet" from "probe complete but no dims" and surface a pending-probe UX.

## Verification

- `npx tsc --noEmit` — clean after every task.
- `npx vitest run` — 171/171 tests passing after every task.
- `grep asset.url src/` — 0 matches.
- `grep spriteStripUrl src/` — 0 matches.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None introduced.

## Self-Check: PASSED
