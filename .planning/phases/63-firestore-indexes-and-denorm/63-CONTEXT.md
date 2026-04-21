# Phase 63: firestore-indexes-and-denorm - Context

**Gathered:** 2026-04-20

<domain>
Eliminate full-collection scans with composite indexes + denormalize commentCount onto asset doc. The hot path /api/assets does 3 full scans per request — replace with indexed queries.
</domain>

<decisions>
- firestore.indexes.json file (create or extend) with: assets(projectId, folderId, deletedAt), folders(projectId, parentId), comments(assetId, parentId, createdAt)
- Asset gets `commentCount: number` (non-optional default 0). Migration: backfill on first list request per asset (if field undefined, scan once, write, cache).
- Comment create/delete route: use FieldValue.increment(±1) inside a transaction with the comment mutation.
- Trash page: use (projectId, deletedAt) index (already added implicitly if we do assets index).
</decisions>

<code_context>
- src/app/api/assets/route.ts (full scans line 29-63)
- src/app/api/folders/route.ts
- src/app/api/comments/route.ts, [id]/route.ts
- firestore.indexes.json (may or may not exist)
- src/lib/jobs.ts etc.
</code_context>

<specifics>IDX-01..04</specifics>
<deferred>Actual index deployment — we generate the JSON, user deploys via firebase CLI.</deferred>
