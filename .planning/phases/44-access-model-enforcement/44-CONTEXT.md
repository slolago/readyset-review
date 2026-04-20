# Phase 44: access-model-enforcement - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Server-side rewrite of the access-control model — platform roles, project roles, review-link permission flags — with a single source of truth, enforced consistently across all API endpoints, and covered by tests. This phase is the foundation for Phase 45 (admin UI). Scope: model + enforcement + tests. **No UI work.**

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- Define the canonical role matrix in code (single module), not just documentation
- Platform roles: admin > manager > editor > viewer (strict rank)
- Project roles: owner / editor / reviewer (set membership, not rank)
- Review-link flags: allowComments, allowDownloads, allowApprovals, showAllVersions, password — each must be checked on every read and every write path
- Tests via Vitest (or Jest if already present) — unit-level, one test per permission matrix row
- No silent fall-through: every gate is explicit allow/deny

</decisions>

<code_context>
## Existing Code Insights

Relevant files:
- src/lib/auth-helpers.ts — requireAdmin, getAuthenticatedUser, canAccessProject, roleAtLeast
- src/app/api/projects/[projectId]/* — project endpoints
- src/app/api/assets/* — asset endpoints
- src/app/api/review-links/[token]/* — review-link read paths
- src/types/index.ts — User, Collaborator, ReviewLink types
- src/app/api/auth/session/route.ts — session guard (recently hardened)

Known gaps:
- Review-link permission flags are sometimes honored only on the UI render path, not on the API
- Project role enforcement is inconsistent — some endpoints only check ownerId, not collaborator role
- No centralized "can this user call this endpoint" matrix
</code_context>

<specifics>
## Specific Ideas

Success criteria (from ROADMAP):
1. Platform role model documented + enforced — admin/manager/editor/viewer with endpoint matrix
2. Project role model documented + enforced — owner/editor/reviewer with upload/delete/rename/invite/share matrix
3. Review-link flags enforced server-side (API) AND client-side (UI hides controls)
4. All access-control tests pass — per-role matrix; no silent fallthrough

</specifics>

<deferred>
## Deferred Ideas

- Admin UI for auditing permissions — Phase 45
- Orphan user cleanup UI — Phase 45
- Project rename UI — Phase 45 (but server-side endpoint + auth gate IS in this phase if touched)

</deferred>
