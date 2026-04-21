# Phase 54: security-hardening - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning (auto-generated, skip_discuss)

<domain>
Close the security gaps surfaced by the audit: unauthenticated endpoints leaking credentials, suspended-user bypass on every route except session, missing review-link PATCH coverage, password field leaks, and approvalStatus silent drop.
</domain>

<decisions>
### Claude's Discretion
- Move the `disabled` check into `getAuthenticatedUser` so it applies to ALL routes, not just session
- Create `serializeReviewLink(link)` helper that strips `password` + returns `hasPassword: boolean`; use in all review-link response paths
- PATCH /api/review-links/[token] whitelist: name, password, expiresAt, allowComments, allowDownloads, allowApprovals, showAllVersions; reject unknown fields
- For composite index on comments: filter reviewLinkId in-memory (avoids new index deploy)
- Debug endpoint: keep for admins but strip all sensitive values (just return a healthcheck ping with "admin" confirmation)
</decisions>

<code_context>
Relevant files:
- src/app/api/debug/route.ts — leaks
- src/app/api/safe-zones/route.ts — GET unauth
- src/lib/auth-helpers.ts — getAuthenticatedUser (line 25-36)
- src/app/api/review-links/[token]/route.ts — PATCH only takes name
- src/app/api/review-links/route.ts + /all/route.ts + /[token]/contents/route.ts — password leaks
- src/app/api/comments/route.ts — approvalStatus not persisted + inefficient filter
</code_context>

<specifics>
7 REQs (SEC-01..07) fully traceable to audit findings.
</specifics>

<deferred>None.</deferred>
