# Phase 61: transactional-mutations - Context

**Gathered:** 2026-04-20
**Status:** Ready (skip_discuss)

<domain>
Wrap all stack-mutation endpoints in Firestore runTransaction so concurrent writes never corrupt version numbering. Same for auto-versioning on upload. Guard folder-delete-during-upload.
</domain>

<decisions>
- TXN-01/02: merge-version + unstack-version go from db.batch() → db.runTransaction() (reorder already uses it — follow that pattern)
- TXN-03: upload/signed-url auto-version scan → transaction scoped to (projectId, folderId, filename) with name match
- TXN-04: validate folderId is not soft-deleted in signed-url request
</decisions>

<code_context>
- src/app/api/assets/merge-version/route.ts (batch, line 57-75)
- src/app/api/assets/unstack-version/route.ts
- src/app/api/assets/reorder-versions/route.ts (reference — already transactional)
- src/app/api/upload/signed-url/route.ts (auto-versioning scan)
</code_context>

<specifics>4 REQs: TXN-01..04</specifics>
<deferred>None</deferred>
