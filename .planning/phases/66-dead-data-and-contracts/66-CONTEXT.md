# Phase 66: dead-data-and-contracts - Context

**Gathered:** 2026-04-20

<domain>
Cleanup pass: remove phantom fields, unify naming, complete types, add AbortController, use Folder.path for ancestry, fix writer cleanup, tag client metadata as provisional.
</domain>

<decisions>
- CLN-01: remove `url` field from Asset type + from signed-url creation write
- CLN-02: sprite naming — response shape already uses `spriteStripUrl` (keep) but AssetCard reads different names (`spriteSignedUrl` from list, `spriteStripUrl` from fallback). Unify — AssetCard reads `spriteSignedUrl` consistently; the on-demand response renames to `spriteSignedUrl` too
- CLN-03: UploadCompleteRequest adds `frameRate?`, `thumbnailGcsPath?`, `mimeType?`
- CLN-04: useAssets.fetchAssets adds AbortController (pattern already in useComments)
- CLN-05: folderIsAccessible uses Folder.path[] array — O(1) ancestry check vs N sequential reads
- CLN-06: generate-sprite writer.destroy() → also await reader.cancel() + once('close'); same for all early-abort paths
- CLN-07: upload/complete marks `probed: false` when server-side probe is async so UI can show a pending state
</decisions>

<code_context>
- src/types/index.ts
- src/app/api/upload/signed-url/route.ts (writes `url` field)
- src/app/api/assets/[assetId]/generate-sprite/route.ts (response field + writer cleanup)
- src/components/files/AssetCard.tsx (reads)
- src/hooks/useAssets.ts (no AbortController)
- src/hooks/useComments.ts (reference pattern)
- src/app/api/review-links/[token]/route.ts (folderIsAccessible parent walk)
</code_context>

<specifics>CLN-01..07</specifics>
<deferred>None</deferred>
