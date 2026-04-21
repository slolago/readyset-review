# Phase 55: bulk-mutations-and-soft-delete - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning (skip_discuss)

<domain>
Fix the bulk-mutation correctness issues and sweep the soft-delete filter across all list/copy/stats paths that miss it.
</domain>

<decisions>
### Claude's Discretion
- BLK-01: Version-stack DELETE behavior — soft-delete all members of the group atomically. VersionStackModal's per-row delete continues to delete that single version only.
- BLK-05: Folder deep copy — breadth-first traversal via Firestore batch writes. Use a helper in `src/lib/folders.ts` (new if missing).
- BLK-02/03: Replace Promise.all with Promise.allSettled; fail-summary toast "N updated, M failed" + per-failure console.error.
- SDC sweep: Add filter in each identified endpoint. Most use in-memory filter (consistent with Phase 52 pattern).
- Allow 3-tier filter: `.where('deletedAt', '==', null)` OR in-memory `!doc.deletedAt` — use whichever avoids composite index.
</decisions>

<code_context>
Relevant files:
- src/app/api/assets/[assetId]/route.ts — DELETE (line 151)
- src/components/files/FolderBrowser.tsx — handleMoveSelected (line 567), handleBulkSetStatus (line 474), handleAssetDrop (line 888)
- src/app/api/folders/copy/route.ts — shallow copy (line 43)
- src/app/api/stats/route.ts (lines 32-40)
- src/app/api/assets/copy/route.ts (line 42-48)
- src/app/api/assets/size/route.ts
- src/app/api/review-links/[token]/route.ts (lines 126-136, 198-213)
- src/app/api/review-links/[token]/contents/route.ts (lines 67-75)
- src/lib/version-groups.ts (existing helper)
</code_context>

<specifics>
9 REQs: SDC-01..04, BLK-01..05
</specifics>

<deferred>
- N+1 optimization in hardDeleteFolder (v2)
- Trash auto-purge cron (v2)
</deferred>
