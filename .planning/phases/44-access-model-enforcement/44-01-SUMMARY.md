---
phase: 44-access-model-enforcement
plan: 01
subsystem: access-control
tags: [access-model, permissions, vitest, server-side]
requirements: [ACCESS-01, ACCESS-02, ACCESS-03, ACCESS-07]
metrics:
  tasks_completed: 9
  commits: 9
  unit_tests: 89
  integration_tests: 27
  total_tests: 116
  files_created: 4
  files_modified: 20
  completed_date: 2026-04-20
---

# Phase 44 Plan 01: Access Model Enforcement Summary

One-liner: Centralized all platform/project/review-link authorization into a single pure-function module (`src/lib/permissions.ts`) backed by 116 matrix-driven Vitest cases, closing 7 concrete enforcement gaps across 22 API routes.

## Final permissions.ts API

Pure functions, zero Firestore / NextRequest imports:

**Platform role**
- `PLATFORM_ROLE_RANK`, `PLATFORM_ROLES`, `PlatformRole`
- `platformRoleAtLeast(user, min)`
- `roleAtLeast` (deprecated re-export)

**Project role**
- `PROJECT_ROLES`, `ProjectRole`
- `getProjectRole(user, project)` — admin override returns `'owner'`
- `canAccessProject(user, project)`

**Project scope**
- `canRenameProject`, `canDeleteProject`, `canInviteCollaborator`, `canRemoveCollaborator`

**Asset/stack scope**
- `canUpload`, `canDeleteAsset`, `canRenameAsset`, `canCopyAsset`, `canModifyStack`, `canProbeAsset`, `canGenerateSprite`

**Folder scope**
- `canCreateFolder`, `canRenameFolder`, `canDeleteFolder`

**Review-link scope**
- `canCreateReviewLink`, `canEditReviewLink`, `canDeleteReviewLink`

**Comments**
- `canPostComment`, `canResolveComment`, `canEditComment`, `canDeleteComment`

**Review-link assertions (throw-style)**
- `assertReviewLinkActive(link, { providedPassword })` — throws `ReviewLinkDenied('expired' | 'password')`
- `assertReviewLinkAllows(link, 'comment' | 'approve' | 'download')` — throws `ReviewLinkDenied('comments_disabled' | 'approvals_disabled' | 'downloads_disabled')`
- `class ReviewLinkDenied extends Error`, `ReviewLinkDenyReason`

**Legacy DB wrapper (in `auth-helpers.ts`)**
- `canAccessProject(userId, projectId)` — async DB-loading wrapper (deprecated)

## Matrix tables (as enforced in code)

### Platform role × endpoint verb
| Endpoint                                | viewer | editor | manager | admin |
| --------------------------------------- | ------ | ------ | ------- | ----- |
| POST /api/upload/signed-url             | 403    | canUpload | canUpload | 200 |
| POST /api/upload/complete               | 403    | canUpload | canUpload | 200 |
| POST /api/upload/thumbnail              | 403    | canUpload | canUpload | 200 |
| POST /api/assets/\*                     | 403    | canWriteAsset | canWriteAsset | 200 |
| POST /api/folders                       | 403    | canCreateFolder | canCreateFolder | 200 |
| POST /api/review-links                  | 403    | canCreateReviewLink | canCreateReviewLink | 200 |

Platform role `viewer` is strictly read-only for any write path.

### Project role × endpoint verb
| Endpoint                         | owner | editor | reviewer | stranger | admin |
| -------------------------------- | ----- | ------ | -------- | -------- | ----- |
| GET /api/projects/[id]           | 200   | 200    | 200      | 403      | 200   |
| PUT /api/projects/[id]           | 200   | 403    | 403      | 403      | 200   |
| DELETE /api/projects/[id]        | 200   | 403    | 403      | 403      | 200   |
| POST /api/projects/[id]/collab   | 200   | 403    | 403      | 403      | 200   |
| POST /api/folders                | 200   | 200    | 403      | 403      | 200   |
| DELETE /api/folders/[id]         | 200   | 200    | 403      | 403      | 200   |
| POST /api/folders/copy           | 200   | 200    | 403      | 403      | 200   |
| PUT /api/assets/[id]             | 200   | 200    | 403      | 403      | 200   |
| DELETE /api/assets/[id]          | 200   | 200    | 403      | 403      | 200   |
| POST /api/assets/copy            | 200   | 200    | 403      | 403      | 200   |
| POST /api/assets/merge-version   | 200   | 200    | 403      | 403      | 200   |
| POST /api/assets/unstack-version | 200   | 200    | 403      | 403      | 200   |
| POST /api/assets/reorder-versions| 200   | 200    | 403      | 403      | 200   |
| POST /api/assets/\*/probe        | 200   | 200    | 403      | 403      | 200   |
| POST /api/assets/\*/generate-sprite | 200 | 200    | 403      | 403      | 200   |
| POST /api/upload/signed-url      | 200   | 200    | 403      | 403      | 200   |
| POST /api/review-links           | 200   | 200    | 403      | 403      | 200   |
| PATCH /api/review-links/[token]  | 200†  | 200*   | 403      | 403      | 200   |
| DELETE /api/review-links/[token] | 200†  | 200*   | 403      | 403      | 200   |
| POST /api/comments (auth)        | 200   | 200    | 200      | 403      | 200   |

† Project owner can edit any review link regardless of creator.
\* Editor can edit only if they are the link's `createdBy`.

### Review-link flags × action
| Flag / state            | Server enforcement                                  |
| ----------------------- | --------------------------------------------------- |
| expiresAt past          | 410 on GET /[token], POST /comments guest, GET /comments?reviewToken |
| password set + missing  | 401 on GET /[token], POST /comments guest, GET /comments?reviewToken |
| allowComments=false     | 403 on POST /comments guest (was silently 201 before) |
| allowApprovals=false    | 403 on POST /comments guest when body.approvalStatus set |
| allowDownloads=false    | downloadUrl omitted from public GET /[token]; assertReviewLinkAllows('download') available for future endpoints |
| showAllVersions         | Version grouping on public GET /[token] (unchanged) |

## Audit gaps closed

| # | Gap                                                                                              | Closed in                                                       | Commit     |
| - | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ---------- |
| 1 | Platform viewer could upload, rename assets, mutate stacks (8 routes had no platform gate)       | signed-url, complete, thumbnail, assets/*, folders/*            | 290d0c2d / dcef27fa |
| 2 | Platform-editor project-owner blocked from creating folders/review-links (roleAtLeast==manager) | folders POST, review-links POST → canCreateFolder / canCreateReviewLink | a22d1b70 / 521481e2 |
| 3 | Platform-editor project-owner blocked from deleting own folders                                  | folders/[id] DELETE → canDeleteFolder                           | a22d1b70   |
| 4 | Project reviewer could rename/delete assets, copy, merge/unstack/reorder, probe/sprite           | assets/*, upload/thumbnail                                      | 290d0c2d / dcef27fa |
| 5 | Platform admin couldn't rename projects / manage collaborators (owner-only)                      | projects/[id] PUT/DELETE, collaborators POST/DELETE             | 0d1532bf   |
| 6 | Project owner couldn't revoke a review link created by a former collaborator                     | review-links/[token] PATCH/DELETE → canEditReviewLink / canDeleteReviewLink | 521481e2   |
| 7 | Guest could POST comments when `link.allowComments===false`, after expiry, or without password  | comments POST guest branch → assertReviewLinkActive + assertReviewLinkAllows('comment') | 36acd6a0   |
| 8 | Guest GET comments with expired review link (no expiry check)                                    | comments GET ?reviewToken path                                  | 36acd6a0   |
| 9 | Inconsistent admin override on projects/[id] GET vs DELETE                                       | GET now uses canAccessProject (which admin-overrides)           | 0d1532bf   |

## Deferred Items

- **Password on guest writes uses request body/query, not a signed handshake token.** Current implementation: guest must re-present `password` on every write to a password-protected link (documented in plan `<audit>` — accepted simpler route for v1.7). Future phase should upgrade to a short-lived review-link-scoped token exchanged via password handshake.
- **`allowApprovals` gate is wired but no approval-bearing `comments POST` flow exists yet.** Phase 44 adds the check (`assertReviewLinkAllows(link, 'approve')` when `body.approvalStatus !== undefined`) so the server is ready; UI lands in Phase 46+.
- **Admin endpoints under `src/app/api/admin/**`** still contain `ownerId === uid` project-business-logic checks (e.g., transferring ownership). Those are not authz gates (they're wrapped by `requireAdmin`) — out of scope.
- **`src/app/api/assets/size/route.ts`** and **`src/app/api/users/*`** were not touched — size is admin-wrapped; users/* is `requireAdmin` or self-scoped — no matrix change needed.

## Commits

| Task | Commit   | Summary                                                                            |
| ---- | -------- | ---------------------------------------------------------------------------------- |
| 1    | 89d43729 | Install vitest + create permissions.ts + 89 unit tests                             |
| 2    | a3becee4 | Move canAccessProject/roleAtLeast out of auth-helpers into permissions             |
| 3    | 0d1532bf | Refactor projects endpoints + integration test scaffold                            |
| 4    | a22d1b70 | Refactor folders endpoints — fixes platform-editor project-owner delete            |
| 5    | 290d0c2d | Refactor all asset endpoints — reviewer 403 on writes                              |
| 6    | dcef27fa | Enforce canUpload on signed-url/complete/thumbnail                                 |
| 7    | 521481e2 | Refactor review-link endpoints + use assertReviewLinkActive helper                 |
| 8    | 36acd6a0 | Close allowComments/expiry/password holes in comments pipeline                     |
| 9    | dc7c10a6 | Final sweep — centralize list-endpoint access filters; no ad-hoc checks remain     |

## Success criteria — each one satisfied

1. **ACCESS-01 (platform matrix):** `PLATFORM_ROLE_RANK` + `platformRoleAtLeast` live ONLY in `src/lib/permissions.ts`. Grep `roleAtLeast` across `src/app/api/**` returns zero matches.
2. **ACCESS-02 (project matrix):** Semantic functions (`canUpload`, `canDeleteAsset`, `canCreateFolder`, etc.) enforce the owner/editor/reviewer matrix on every write path. Integration test `'DELETE /api/assets/[id] — reviewer is 403 (gap closure)'` passes — reviewer cannot delete, rename, copy, merge, unstack, reorder, probe, or generate sprites.
3. **ACCESS-03 (review-link flags):** Guest `POST /api/comments` calls `assertReviewLinkActive` + `assertReviewLinkAllows('comment')`, mapping to 410/401/403 respectively. Test `'guest POST blocked when link.allowComments=false (gap closure)'` passes. `allowDownloads` gates `downloadUrl` on GET `/review-links/[token]`. `allowApprovals` gate wired for future use.
4. **ACCESS-07 (test coverage):** 116 tests across 2 files (89 unit + 27 integration); `npm test` exits 0; every asserted response code is 200/201/401/403/404/410 — no 500s in the suite.

## Grep verification (run on HEAD)

```
grep -rn "roleAtLeast" src/app/api           → no matches
grep -rn "user\.role === 'admin'" src/app/api → no matches
grep -rn "collaborators\?\.some" src/app/api → no matches (only remaining is in admin/*, wrapped by requireAdmin)
grep -rn "ownerId === " src/app/api          → only in admin/* (ownership transfer logic, not authz) and stats/review-links-all (no longer — replaced with canAccessProject)
```

## Self-Check: PASSED
- src/lib/permissions.ts — FOUND
- tests/permissions.test.ts — FOUND (89 tests, all pass)
- tests/permissions-api.test.ts — FOUND (27 tests, all pass)
- tests/helpers/firestore-mock.ts — FOUND
- vitest.config.ts — FOUND
- All 9 commits in git log — FOUND
- npx tsc --noEmit — clean
- npm run build — success
- npx vitest run — 116/116 pass
