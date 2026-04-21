# Milestones

## v2.0 Architecture Hardening (Shipped: 2026-04-20)

**Phases completed:** 7 phases (60–66), 7 plans
**Tests:** 156 → 171 (+15)
**Source:** Deep pipeline-lifecycle + unhappy-path audit — 5 critical + 8 medium + 4 low findings, 5 systemic patterns

**Systemic patterns attacked:**

1. Fire-and-forget jobs with no observability → Phase 60
2. Signed URLs regenerated per-request → Phase 62
3. Full-collection scans instead of composite indexes → Phase 63
4. `batch()` where `runTransaction()` is needed → Phase 61
5. Client metadata stale window → Phase 66 (provisional-metadata pattern)

**Key accomplishments:**

1. **Phase 60 pipeline-observability:** Generalized `Job` model + `src/lib/jobs.ts` lifecycle helpers. Probe/sprite/thumbnail/export write `{type, status, startedAt, completedAt, error?, attempt}` to Firestore `jobs` collection. `GET /api/assets/[id]/jobs` + `POST /api/jobs/[id]/retry` endpoints. AssetCard renders an amber dot while running, red dot + tooltip on failed, retry button. Client-side duplicate sprite trigger removed (OBS-03). `upload/complete` verifies GCS object exists + size>0 before marking `ready` (OBS-04). Sprite route re-reads fresh duration from Firestore (OBS-05).
2. **Phase 61 transactional-mutations:** merge-version, unstack-version, upload/signed-url auto-versioning all wrapped in `db.runTransaction()` — concurrent writes can no longer produce duplicate version numbers. `fetchGroupMembersTx` helper in version-groups.ts. folderId live-check in signed-url (TXN-04) prevents orphaned uploads into soft-deleted folders.
3. **Phase 62 signed-url-caching:** `signedUrl` + `signedUrlExpiresAt` + thumbnail + sprite caching on asset doc. New `src/lib/signed-url-cache.ts::getOrCreateSignedUrl` regenerates only within 30 min of expiry. `/api/assets` and `/api/review-links/[token]` both go through the cache. A 200-asset review link no longer fires 200 GCS signing calls per guest page load. Sync batched write-back to persist fresh URLs.
4. **Phase 63 firestore-indexes-and-denorm:** New `firestore.indexes.json` with composite indexes on `assets(projectId, folderId, deletedAt)`, `folders(projectId, parentId, deletedAt)`, `comments(assetId, parentId, createdAt)`. `commentCount` denormalized onto asset doc with `FieldValue.increment(±1)` inside transactions. List endpoints use indexed queries with graceful fallback + `console.warn` if index not deployed.
5. **Phase 64 format-edge-cases:** Export copy path now accepts `mov+h264+aac` (was rejecting). `sweepStaleJobs()` marks any running job >2min old as failed (catches SIGKILL'd functions). `image-metadata.ts` falls back to ffprobe for HEIC/AVIF/HDR when `image-size` returns null. Sprite frame spacing adapts: clamped to 0.1..duration-0.1s for <3s clips; normal 0.02..0.98 span otherwise.
6. **Phase 65 security-and-upload-validation:** `bcryptjs` hashing (cost 10) on review-link passwords with transparent legacy migration (plaintext match → fire-and-forget rehash). `x-review-password` header replaces `?password=` query string (backwards-compat with deprecation warning). MIME validation on `upload/complete` — GCS content-type must be on ACCEPTED_MIME allow-list with octet-stream fallback to asset.mimeType.
7. **Phase 66 dead-data-and-contracts:** Removed `Asset.url` phantom field (bucket is private, no one reads it). Unified sprite URL naming on `spriteSignedUrl` across list + on-demand paths. Expanded `UploadCompleteRequest` type with `frameRate` + `thumbnailGcsPath` + `mimeType`. `useAssets.fetchAssets` gets AbortController. `folderIsAccessible` uses `Folder.path[]` array for O(1) ancestry (replaces N sequential Firestore reads). Sprite generation properly awaits `writer.once('close')` + `reader.cancel()` on size-exceeded path. Videos tagged `probed: false` on upload so UI differentiates "no probe yet" vs "probe complete".

**New files (high-value):** `src/lib/jobs.ts`, `src/lib/signed-url-cache.ts`, `src/lib/review-links.ts` (serializeReviewLink → Phase 54, extended here), `src/lib/review-password.ts` (bcrypt), `firestore.indexes.json`, `src/app/api/assets/[assetId]/jobs/route.ts`, `src/app/api/jobs/[jobId]/retry/route.ts`, `src/hooks/useAssetJobs.ts`.

**Operational follow-ups:**
- Deploy `firestore.indexes.json` via `firebase deploy --only firestore:indexes`
- Existing review-link passwords will self-migrate to bcrypt on first verify
- No migration script needed for other changes — backward-compatible

---

## v1.9 Hardening & Consistency Audit (Shipped: 2026-04-20)

**Phases completed:** 6 phases (54–59), 6 plans
**Timeline:** Single-session sprint, 2026-04-20
**Source:** Four parallel full-app audits (UX, backend/security, file-management flows, viewer/player) surfaced 21 CRITICAL / 33 MEDIUM / 21 LOW findings. v1.9 attacked the top 37 across 6 phases.

**Key accomplishments:**

1. **Phase 54 — security-hardening:** `/api/debug` gated behind admin + stripped of credential hints; `/api/safe-zones GET` authenticated; `disabled` user check moved into `getAuthenticatedUser` (closes the ~1h ID-token window on suspend); `PATCH /api/review-links/[token]` extended to cover every editable flag (password, expiresAt, all allow-*, showAllVersions); `serializeReviewLink` helper strips password in every response path; `approvalStatus` now persists on comment POST; guest comment GET uses compound Firestore query with composite-index fallback.
2. **Phase 55 — bulk-mutations-and-soft-delete:** Version-stack aware DELETE (`?allVersions=true`); deep folder copy (`src/lib/folders.ts::deepCopyFolder`, BFS with Promise.all per level); `Promise.allSettled` on bulk move + bulk status with per-item error reporting; drag-to-stack clears source from selectedIds; soft-delete filter sweep on stats, copy, size, review-link root/drill-down/contents.
3. **Phase 56 — viewer-alignment:** ExportModal receives `initialIn`/`initialOut` from the parent so marked loop range pre-fills trim bar; 0-duration waiting state; review-page routes documents (PDF/HTML) to DocumentViewer/HtmlViewer + other types to FileTypeCard; range-comment click unifies with shared `rangeIn`/`rangeOut` (loop + composer + export all read the same state); VUMeter AudioContext ref-counts and closes on last unmount; VersionComparison duration effects re-subscribe on version swap.
4. **Phase 57 — ux-and-dashboard:** Dashboard Quick Actions routed (Browse → `/projects`, Upload → `?action=upload`, Invite → `?action=invite`); review-link guest resolve/delete work end-to-end (server + client); new `<InlineRename />` primitive adopted in grid + list views (no more `window.prompt`); UserTable delete via `useConfirm`; Collaborators stat card on dashboard; review-link expiry banner + dedicated expired screen; guest name + email persisted in single `frame_guest_info` JSON with back-compat.
5. **Phase 58 — data-consistency:** Deprecated async `canAccessProject` wrapper removed; all callers migrated to pure function; `Asset` declares `thumbnailGcsPath`/`spriteStripUrl`/`spriteStripGcsPath`/`description`; `Comment.approvalStatus` typed; new `src/lib/names.ts` with `validateAssetRename`/`validateFolderRename` + 13 tests; name-collision returns 409 on rename; every `catch` in API routes logs with contextual `[ROUTE VERB]` prefix.
6. **Phase 59 — a11y-and-keyboard-coordination:** New `useFocusTrap` + `useModalOwner` hooks; Modal + UserDrawer render `role="dialog"`, `aria-modal="true"`, trap Tab focus, Escape closes; Dropdown full keyboard nav (arrow keys, Enter, Escape) + `role="menu"`/`role="menuitem"` + `aria-haspopup`; VideoPlayer + VersionComparison + ExportModal keydown handlers early-return when `document.body.dataset.modalOpen === 'true'` — no more shortcut leak across layers.

**New files (high-value):** `src/lib/review-links.ts` (serializeReviewLink), `src/lib/folders.ts` (deepCopyFolder), `src/lib/names.ts` (rename collision validators), `src/components/ui/InlineRename.tsx`, `src/hooks/useFocusTrap.ts`, `src/hooks/useModalOwner.ts`.

**Tests:** 138 → 151 (+13 name validation tests, all green).

**Deferred to v2 / Future (21 lower-severity audit findings):** Modal `size="full"` + AssetCompareModal migration, Dropdown/ContextMenu divider API unification, useAssets AbortController, ReviewHeader flag pills, hash-sort folders, N+1 fixes in hardDeleteFolder, Trash auto-purge cron, inline design-file preview.

**Pending:** Live QA walkthroughs on phases 56 + 57 verifications (flagged human_needed — AudioContext leak under real navigation, review-page document routing, guest resolve/delete end-to-end).

---

## v1.8 Asset Pipeline & Visual Polish (Shipped: 2026-04-20)

**Phases completed:** 5 phases (49–53), 5 plans
**Timeline:** Single-session sprint, 2026-04-20

**Key accomplishments:**

1. **Phase 49 — metadata-accuracy:** ffprobe skipped on images; new `src/lib/image-metadata.ts` extracts dimensions server-side via `image-size` (pure-JS, no native binary). Client reads dimensions from original File via `createImageBitmap` (not downscaled canvas). New `src/lib/format-date.ts` with `coerceToDate` handles every Timestamp shape (`toDate`, `{seconds,nanoseconds}`, `{_seconds,_nanoseconds}`, ISO, epoch, Date) — kills "Invalid Date". FileInfoPanel renders image-appropriate section (no Container/Pixel format/Color space/Bitrate rows for images). 13 new unit tests.
2. **Phase 50 — review-links-repair:** Root cause: `/api/review-links` did `.where(projectId).orderBy(createdAt)` which required an undeployed composite Firestore index → 500 → clients read "empty". Dropped `orderBy`, sort in memory (mirrors `/api/review-links/all`). Added `!res.ok` guards on 3 client callsites so empty state no longer masquerades as success on error. 9 new integration tests.
3. **Phase 51 — file-type-expansion:** New `src/lib/file-types.ts` centralizes MIME/extension classification for 6 types: video, image, document (PDF/HTML), archive (ZIP), font (TTF/OTF/WOFF/WOFF2), design (AI/PSD/AEP/FIG). Server + client allow-lists unified. New viewer components: `DocumentViewer` (PDF iframe), `HtmlViewer` (sandboxed iframe), `FileTypeCard` (icon + metadata + Download). Grid + list cards render type-specific icons instead of broken thumbnails.
4. **Phase 52 — trash-and-recovery:** Soft-delete for assets and folders (`deletedAt`, `deletedBy` fields). DELETE endpoints now soft-delete; hard-delete logic extracted to `src/lib/trash.ts` (`hardDeleteAsset`, `hardDeleteFolder`). New endpoints: GET `/api/projects/[id]/trash`, POST `/api/trash/restore`, POST `/api/trash/permanent-delete`, POST `/api/trash/empty`. New `/projects/[id]/trash` page with Restore + Permanent Delete + Empty Trash. Restore auto-reparents to project root when the original folder is also deleted.
5. **Phase 53 — visual-polish:** 8 VIS bugs closed — Modal `overflow-hidden` clips the accent line; new `/api/folders/[id]/preview-assets` + tiled folder thumbnails; rename uses Check/X confirm buttons (blur no longer commits); `object-contain` preserves asset aspect ratio; single version count badge; ReviewStatusBadge wrapped in `bg-black/50 backdrop-blur-sm` for contrast on bright thumbs; CreateReviewLinkModal contents contained; Dashboard Quick Actions have distinct hrefs (`/projects`, `/projects?action=upload`, `/projects?action=invite`).

**New files (high-value):** `src/lib/image-metadata.ts`, `src/lib/format-date.ts`, `src/lib/file-types.ts`, `src/lib/trash.ts`, `src/components/viewer/{DocumentViewer,HtmlViewer,FileTypeCard}.tsx`, 4 trash API routes, 1 folder preview-assets API route, 1 trash UI page.

**Pending:** Human verification walkthroughs for phases 49, 51, 52, 53 (automated tests all green; live uploads required for end-to-end checks).

---

## v1.7 Review UX & Access Rewrite (Shipped: 2026-04-20)

**Phases completed:** 6 phases (43–48), 6 plans, 66 commits
**Files changed (src/):** 56 files, +3,251 / -364 lines
**Timeline:** Single-day sprint, 2026-04-20

**Key accomplishments:**

1. **Phase 43 — version-stack-rewrite:** New `src/lib/version-groups.ts` helper centralizes legacy-root handling; merge, unstack, reorder APIs refactored to use it. Fixed 4 audit bugs: legacy-root drop on merge, ghost-group on unstack root, ad-hoc legacy fallback, reorder partial-input. Added `StackOntoModal` context-menu affordance from grid. Regression script `scripts/verify-stack-integrity.ts`.
2. **Phase 44 — access-model-enforcement:** Stood up Vitest from zero; created `src/lib/permissions.ts` as single source of truth for platform + project + review-link permissions; refactored 22 API routes to delegate; closed 7 concrete security holes (reviewer-write bypass, allowComments bypass on guest POST, expiry/password bypass on guest writes, admin override on projects, project-owner review-link revocation). **116/116 tests green.**
3. **Phase 45 — admin-ui-and-project-rename:** New admin surfaces — `ProjectPermissionsPanel` (audit collaborators + review-link holders + flags), `OrphanUsersPanel` (uninvited cleanup), `UserSessionActions` (suspend + revoke). Three new admin API routes. `RenameProjectModal` + server-side collision check on PUT `/api/projects/:id`.
4. **Phase 46 — comments-integrity-and-range:** Range-comment timeline tooltips polished; `CommentItem` shows range badge + click-to-seek to in-point; composer state + pendingAnnotation cleared on asset switch; `_commentCount` derivation fixed (skip replies + empty text); sidebar tab count matches grid badge; OUT<IN guard + pulsing OUT hint.
5. **Phase 47 — video-export-pipeline:** New `ExportJob` model; POST `/api/exports` runs ffmpeg inline — MP4 (stream-copy with re-encode fallback), GIF (two-pass palettegen/paletteuse); GET `/api/exports/[jobId]` returns fresh signed URL; `ExportModal` with trim bar + format toggle + filename; wired into internal viewer (hidden on review-link pages). `next.config.mjs` updated for Vercel bundling.
6. **Phase 48 — playback-loop-and-selection-hierarchy:** Lifted in/out markers from CommentSidebar to viewer parent; new `loop` toggle in VideoPlayer controls — loops whole video when no range set, clamps to in/out when set (with one-cycle grace on manual seek); new `src/lib/selectionStyle.ts` helper; applied to ProjectCard / FolderCard / AssetCard + sidebar tree parent-of-selected indicator.

**New files (high-value):** `src/lib/permissions.ts`, `src/lib/version-groups.ts`, `src/lib/selectionStyle.ts`, `src/lib/exports.ts`, `src/lib/ffmpeg-resolve.ts`, `tests/permissions.test.ts`, `tests/permissions-api.test.ts`, `src/components/admin/{ProjectPermissionsPanel,OrphanUsersPanel,UserSessionActions}.tsx`, `src/components/viewer/ExportModal.tsx`, `src/components/projects/RenameProjectModal.tsx`, `src/components/files/StackOntoModal.tsx`, 3 admin API routes + exports API routes.

**Pending:** Human verification walkthroughs for phases 43, 45, 46, 47, 48 (automated verification passed all; live-environment checks require running dev server).

---

## v1.3 Video Review Polish (Shipped: 2026-04-08)

**Phases completed:** 6 phases (23–28), 8 plans
**Files changed:** 56 files, +6,074 / -64 lines
**Timeline:** 2026-04-07 → 2026-04-08

**Key accomplishments:**

1. Fixed SMPTE timecode frame digit freezing on frame-step — direct `setCurrentTime` call bypasses the 0.25s rAF threshold in `VideoPlayer.tsx`
2. Added opacity slider to safe zones overlay — slider shows only when a zone is active, resets to 100% on zone change
3. Comment count badge on grid cards — `MessageSquare` icon + "99+" cap, reads `_commentCount` from existing API response (zero API calls)
4. File info tab in asset viewer sidebar — Comments/Info tab bar; `FileInfoPanel` shows 10 metadata fields (filename, type, size, duration, resolution, aspect ratio, FPS, uploader name, date, version)
5. Synchronized asset comparison modal — select 2 assets → full-screen side-by-side with shared play/pause, shared scrubber, and per-side audio toggle
6. Drag-and-drop version stacking — drag asset A onto B merges A's entire version group into B's stack via atomic Firestore batch write; accent border highlight, toast confirmation, grid refresh

**New files:** `FileInfoPanel.tsx`, `AssetCompareModal.tsx`, `POST /api/assets/merge-version`

---

## v1.2 Feature Expansion (Shipped: 2026-04-07)

22 phases shipped. See [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) for full details.

---
