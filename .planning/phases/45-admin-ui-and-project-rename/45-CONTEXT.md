# Phase 45: admin-ui-and-project-rename - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

UI surface for the access rewrite landed in Phase 44 — audit views for projects and review links, suspend/revoke user actions, orphan user cleanup, and project rename (owner/admin surface). This phase consumes the permissions module from Phase 44; no server model changes.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- Admin UI under existing /admin route (src/app/(app)/admin/page.tsx)
- Use existing Modal, Button, Avatar, Badge UI primitives — don't reinvent
- Suspend = set users.disabled = true (already supported in session endpoint)
- Revoke sessions = invalidate Firebase refresh tokens via admin SDK (revokeRefreshTokens)
- Orphan = user doc with no invitation history AND no active project collaboration
- Project rename: inline edit on project card + modal variant; collision detection within owner's projects

</decisions>

<code_context>
## Existing Code Insights

Relevant files:
- src/app/(app)/admin/page.tsx — admin panel entry
- src/components/admin/UserTable.tsx — user list
- src/components/admin/SafeZonesManager.tsx — reference pattern for admin sub-managers
- src/app/api/admin/users/route.ts — user list API
- src/app/api/admin/users/[userId]/route.ts — individual user update (disable/suspend already wired)
- src/lib/permissions.ts — NEW in Phase 44; consume for role displays
- src/components/projects/ProjectCard.tsx — renders project on dashboard
- src/components/projects/CollaboratorsPanel.tsx — recently refactored with chips multi-select
- src/app/api/projects/[projectId]/route.ts — project CRUD (PATCH covers rename after Phase 44)

</code_context>

<specifics>
## Specific Ideas

Success criteria (from ROADMAP):
1. Admin UI shows full permission state of any project/review link (collaborators, review-link holders, pending invites) in ONE view — no Firestore console
2. Admin can suspend any user + revoke all their active sessions; suspended users cannot establish new session
3. Admin can audit uninvited/orphaned users + delete or suspend in-app
4. User with owner OR admin role can rename a project (name field) with collision detection

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
