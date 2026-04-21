# Phase 65: security-and-upload-validation - Context

**Gathered:** 2026-04-20

<domain>
Hash review-link passwords, move to POST body, server-side MIME validation on upload/complete.
</domain>

<decisions>
- SEC-20 bcrypt: use `bcryptjs` (pure JS, no native binary — Vercel-friendly). Cost 10. Migration: when reading a password that's plaintext (no $2a$/$2b$ prefix), accept the match IF it equals the plaintext, then immediately hash+rewrite in Firestore (transparent upgrade).
- SEC-21 POST body: /api/review-links/[token]?password=X is the legacy GET query. Change to accept POST {password} body in a new endpoint or widen the existing handler. Keep backward compat for 1 release — accept both, add deprecation warning.
- SEC-22: OBS-04 already added GCS verify. This REQ is now partially covered — extend with MIME check (SEC-23).
- SEC-23: getMetadata() returns contentType. Compare against ACCEPTED_MIME from file-types.ts. Reject if not allowed. On match mismatch (user uploaded file .mp4 but GCS says application/octet-stream), allow if the extension is on allow-list — some browsers don't set Content-Type on PUT.
</decisions>

<code_context>
- src/lib/permissions.ts (assertReviewLinkActive — password compare)
- src/app/api/review-links/* (password paths)
- src/app/api/upload/complete/route.ts (already has GCS verify from OBS-04)
- src/lib/file-types.ts (ACCEPTED_MIME list)
- package.json (add bcryptjs)
</code_context>

<specifics>SEC-20..23</specifics>
<deferred>Full bcrypt plaintext deprecation schedule — keep back-compat for this phase.</deferred>
