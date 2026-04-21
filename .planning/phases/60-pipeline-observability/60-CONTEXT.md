# Phase 60: pipeline-observability - Context

**Gathered:** 2026-04-20
**Status:** Ready (skip_discuss)

<domain>
Replace fire-and-forget with observable job tracking for probe, sprite, thumbnail, export. Dedupe duplicate triggers. Verify GCS objects before marking ready. Wait for probe before sprite.
</domain>

<decisions>
### Claude's Discretion
- New Firestore collection `jobs` with shape: { id, type: 'probe'|'sprite'|'thumbnail'|'export', assetId, userId, status: 'queued'|'running'|'ready'|'failed', startedAt, completedAt?, error?, attempt: number }
- Retry: same jobId, attempt++, max 3 before 'failed' sticks
- UI indicator: tiny spinner/dot on AssetCard thumbnail corner while any job is `running`; red dot + tooltip if `failed`
- OBS-03 dedupe: remove the client-side sprite fetch in useUpload/useAssets (server-side from upload/complete is the source of truth)
- OBS-04 GCS verify: `bucket.file(gcsPath).getMetadata()` before `update({ status: 'ready' })`; reject 400 if missing or size=0
- OBS-05: sprite route reads fresh asset.duration from Firestore before computing timestamps (covers the probe-delay race)
</decisions>

<code_context>
Relevant:
- src/app/api/upload/complete/route.ts (fire-and-forget probe + sprite)
- src/app/api/assets/[assetId]/probe/route.ts
- src/app/api/assets/[assetId]/generate-sprite/route.ts
- src/app/api/exports/route.ts
- src/hooks/useAssets.ts (client-side sprite trigger — DUPLICATE, remove)
- src/components/files/AssetCard.tsx (where UI indicator goes)
- src/lib/gcs.ts (add object-exists helper)
</code_context>

<specifics>5 REQs: OBS-01..05</specifics>
<deferred>None</deferred>
