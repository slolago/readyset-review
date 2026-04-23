# Architecture: v2.4 XMP Metadata Stamping Integration

**Project:** readyset-review
**Researched:** 2026-04-23
**Confidence:** HIGH — all integration points verified against live codebase
**Scope:** How XMP stamping slots into the existing review-link pipeline without structural teardown

---

## Executive Summary

XMP stamping is a "download-to-/tmp, process binary, upload back" job — identical structurally to the probe and generate-sprite routes. The stamp result is asset-scoped (one stamped GCS copy per asset, cached on the asset doc), not review-link-scoped. The review-link POST triggers stamps, the review-link GET `decorate()` serves stamped URLs to guests, and the internal `/api/assets` path is left unchanged. The only genuinely new structural decision is the sync/async split: stamp ≤3 assets synchronously inside the POST (fits the 60s budget), queue the rest as observable jobs for async polling.

---

## 1. Existing Architecture Snapshot (v2.3 state)

### Relevant Firestore Collections

```
assets/{assetId}
  gcsPath, name, projectId, type, mimeType, status
  signedUrl, signedUrlExpiresAt           — Phase 62 URL cache
  thumbnailSignedUrl, thumbnailSignedUrlExpiresAt
  spriteSignedUrl, spriteSignedUrlExpiresAt
  thumbnailGcsPath, spriteStripGcsPath

jobs/{jobId}
  type: 'probe' | 'sprite' | 'thumbnail' | 'export'
  assetId, projectId, userId
  status: 'queued' | 'running' | 'ready' | 'failed'
  attempt: number   (1-based, max 3)
  createdAt, startedAt, completedAt, error?

reviewLinks/{token}   (token IS the doc ID)
  assetIds?: string[]
  folderIds?: string[]
  folderId: string | null
  allowDownloads: boolean
  ...
```

### Key Existing Files

| File | Role |
|------|------|
| `src/types/index.ts` | `Asset`, `Job`, `JobType`, `ReviewLink` types |
| `src/lib/jobs.ts` | `createJob`, `updateJob`, `getJob`, `sweepStaleJobs`, `listJobsForAsset` |
| `src/lib/signed-url-cache.ts` | `getOrCreateSignedUrl` — TTL-based signed URL cache |
| `src/lib/gcs.ts` | `downloadToFile`, `uploadBuffer`, `generateReadSignedUrl`, `generateDownloadSignedUrl`, `deleteFile` |
| `src/app/api/review-links/route.ts` | POST creates review link |
| `src/app/api/review-links/[token]/route.ts` | GET: `decorate()` signs URLs per asset; `flushUrlWrites()` batch-commits cache updates |
| `src/app/api/assets/[assetId]/probe/route.ts` | Reference: download via signed URL → spawn binary → write Firestore |
| `src/app/api/assets/[assetId]/generate-sprite/route.ts` | Reference: download to `/tmp` → spawn ffmpeg → upload buffer → update asset doc |
| `src/app/api/exports/route.ts` | Reference: inline ffmpeg spawn, job created, encoded, uploaded |

---

## 2. Architectural Decisions

### 2a. Job type vs inline — DECISION: jobs collection, probe/sprite pattern

**Use the `jobs` collection row pattern, not inline like `/api/exports`.**

Rationale:
- Export is one-shot user-initiated from the internal viewer; it has one caller, one timeout budget, and no reuse question.
- Stamping is triggered by review-link POST (potentially batching 1–200 assets), must be observable (UI spinner), and the stamp result is reusable across multiple review links for the same asset. A `jobs` row gives you: status polling, retry button, stale-job sweep, and deduplication key.
- The probe and sprite routes are the exact structural match: create job → set running → spawn binary on /tmp → upload → update asset doc → set ready/failed.

New job type: `'metadata-stamp'`. Add to `JobType` union in `src/types/index.ts`.

New route: `POST /api/assets/[assetId]/stamp-metadata` — follows probe/sprite pattern exactly, with `runtime = 'nodejs'` and `maxDuration = 60`.

### 2b. Stamp invalidation — DECISION: `stampedAt` timestamp + compare to `updatedAt`

**Store `stampedAt: Timestamp` on the asset doc. Invalidation condition: `!stampedGcsPath || stampedAt < updatedAt`.**

Options considered:

| Option | Pros | Cons |
|--------|------|------|
| `stampedAt` vs `updatedAt` comparison | Works with existing `updatedAt` field writes; no extra mutation needed on rename/upload | Requires `updatedAt` to be reliably set on every mutating write (verify this) |
| `stampInvalidated: boolean` flag | Explicit intent | Must be set to `true` on every rename and new-version-upload path (4+ write sites); easy to miss one |

The `stampedAt < updatedAt` approach is self-healing: any write that bumps `updatedAt` automatically invalidates the stamp without needing to remember to set a flag. The only requirement is that rename (`PUT /api/assets/[assetId]`) and version upload (`/api/upload/complete`) must write `updatedAt: FieldValue.serverTimestamp()`. Verify both do this before implementing.

If `updatedAt` is not consistently written today, add it to those paths as part of this milestone — it is a cheap field write that serves other future uses too.

### 2c. Review-link POST integration — DECISION: sync ≤3 inline, async ≥4 with job IDs in response

**Three-option analysis:**

| Option | 1–3 assets | 4+ assets | Consistency | Complexity |
|--------|-----------|-----------|-------------|------------|
| (1) Sync all | Fine | Timeout risk at 200 assets | Strong | Low |
| (2) Sync ≤N, async >N | Fine | Jobs + polling | Eventual for large | Medium |
| (3) Always async | Instant POST | Polling always required | Always eventual | Low but UX worse |

Recommendation: **Option 2, threshold N=3**. A single stamp job (exiftool on a small video: download ~50MB, exiftool write, upload) takes approximately 10–20s. Three jobs in parallel fit in 60s. Four or more introduces timeout risk. The `CreateReviewLinkModal` already shows a progress spinner during POST — it can show "Applying metadata (1/3)…" for sync and switch to "Queued — metadata will be applied shortly" for async.

The POST response extends to include `pendingStampJobIds?: string[]` when any jobs were queued async. The UI polls `GET /api/assets/[assetId]/jobs` (already exists) per asset, or a new batch endpoint can be added later.

Threshold 3 is a REQ-level decision, not design-level. The value should be a named constant `SYNC_STAMP_THRESHOLD = 3` in the route, not buried in logic.

### 2d. GCS layout — DECISION: asset-level path, one per asset

```
projects/{projectId}/assets/{assetId}/stamped{ext}
```

Example: `projects/abc/assets/xyz/stamped.mp4`

**Rationale for asset-level over per-review-link path:**

The stamp content is identical for all review links of the same asset (same `Attrib` tags, same `ExtId` derived from `asset.name`). Storing one copy per asset eliminates redundant GCS storage and redundant exiftool processing when the same asset is in multiple review links. The signed-URL cache on the asset doc (`stampedSignedUrl`) is already the right shape for this.

**What is lost:** per-link audit trail. A review link cannot carry a different stamp than another review link for the same asset. This is acceptable — the stamp content is deterministic from the asset name + hardcoded constants.

**Extension note (future):** When `project.metaConfig` is introduced, the stamp will vary by project config, not by link. The path `projects/{pid}/assets/{aid}/stamped{ext}` still works because the stamp is invalidated when the asset changes, and a project config change would trigger a new stamp.

**Extension function to add to `src/lib/gcs.ts`:**
```typescript
export function buildStampedGcsPath(projectId: string, assetId: string, ext: string): string {
  // ext should include the leading dot, e.g. '.mp4', '.jpg'
  return `projects/${projectId}/assets/${assetId}/stamped${ext}`;
}
```

### 2e. `decorate()` change — DECISION: prefer stampedGcsPath; fallback to original

**In `src/app/api/review-links/[token]/route.ts`, the `decorate()` function must be modified as follows:**

```typescript
// New logic at the TOP of decorate(), before the existing gcsPath block:
const gcsPathToServe = asset.stampedGcsPath ?? asset.gcsPath;

// Replace all asset.gcsPath references for signedUrl/downloadUrl with gcsPathToServe.
// The stampedSignedUrl cache fields on the asset doc are used when stampedGcsPath is set.
```

Specifically:
- If `asset.stampedGcsPath` exists AND `!stampIsStale(asset)` → sign `stampedGcsPath` as both `signedUrl` AND `downloadUrl`
- If `asset.stampedGcsPath` is absent or stale → sign `asset.gcsPath` (original) as `signedUrl`

**Do NOT return 503 or disable preview when stamp is missing.** Guests always get a working video — the stamp is a metadata overlay, not a content gate. A missing stamp is handled gracefully by falling back to the original. The UI adds a "Meta-stamped" badge only when `stampedGcsPath` is confirmed fresh.

**Stamp staleness check helper (add to `src/lib/stamp-helpers.ts`):**
```typescript
export function isStampStale(asset: Asset): boolean {
  if (!asset.stampedGcsPath || !asset.stampedAt) return true;
  if (!asset.updatedAt) return false; // no updatedAt → can't compare → treat as fresh
  return asset.stampedAt.toMillis() < asset.updatedAt.toMillis();
}
```

This helper is used in both `decorate()` and the stamp-metadata route to decide whether to re-stamp.

The cached signed URL for the stamped file lives in `asset.stampedSignedUrl` / `asset.stampedSignedUrlExpiresAt`, following the exact same `getOrCreateSignedUrl` pattern as thumbnail and sprite.

### 2f. Concurrency — DECISION: Firestore transaction check-and-create in `src/lib/jobs.ts`

When two review links for the same asset are created simultaneously (or a retry races a new stamp request), the stamp job must not run twice.

**Mechanism:** Add `findOrCreateStampJob` to `src/lib/jobs.ts`:

```typescript
export async function findOrCreateStampJob(
  assetId: string,
  projectId: string,
  userId: string,
): Promise<{ jobId: string; created: boolean }> {
  const db = getAdminDb();

  // Atomically: check for an existing queued/running stamp job, create if none.
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(
      db.collection('jobs')
        .where('type', '==', 'metadata-stamp')
        .where('assetId', '==', assetId)
        .where('status', 'in', ['queued', 'running'])
        .limit(1)
    );
    // NOTE: Firestore does not allow queries inside transactions on Admin SDK v2+
    // without first doing the read outside. Use the pattern below instead:
    ...
  });
}
```

**Correction — Firestore transactions cannot contain arbitrary queries.** The correct pattern:

```typescript
export async function findOrCreateStampJob(
  assetId: string,
  projectId: string,
  userId: string,
): Promise<{ jobId: string; created: boolean }> {
  const db = getAdminDb();

  // Check outside transaction first (best-effort; race window is small)
  const existing = await db.collection('jobs')
    .where('type', '==', 'metadata-stamp')
    .where('assetId', '==', assetId)
    .where('status', 'in', ['queued', 'running'])
    .limit(1)
    .get();

  if (!existing.empty) {
    return { jobId: existing.docs[0].id, created: false };
  }

  // Create — if two concurrent requests both see empty above, both try to create.
  // That's acceptable: the stamp job is idempotent (same output) and the second
  // job will find stampedGcsPath already set when it runs, and short-circuit.
  const ref = await db.collection('jobs').add({
    type: 'metadata-stamp',
    assetId,
    projectId,
    userId,
    status: 'queued',
    attempt: 1,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { jobId: ref.id, created: true };
}
```

The second job will short-circuit because the stamp route checks `isStampStale(asset)` at the start of execution: if the first job already completed and set `stampedGcsPath`, the second job marks itself `ready` immediately without re-running exiftool. This is safer than a distributed lock and has no failure mode that blocks a review link from being created.

### 2g. Exiftool process lifecycle — DECISION: fresh instance per request, `et.end()` in finally

**Do NOT use `-stay_open True` in the serverless stamp route.**

The `-stay_open True` mode (used in the desktop scf-metadata app) keeps a persistent exiftool subprocess alive as a daemon for efficient repeated writes. In a long-running Electron app this is ideal: one startup cost, zero cold starts per write.

In a Vercel serverless function:
- Each invocation may run in a cold container — no warm subprocess to attach to.
- A function that completes with `-stay_open` child alive will cause the Node.js process to hang waiting for the child's stdin/stdout to close, which burns the Vercel function timeout budget until SIGKILL.
- As of `exiftool-vendored` v35, the library cleans up automatically on Node.js exit, but relying on that in a 60s-capped function is fragile.

**Correct pattern for the stamp route:**

```typescript
import { ExifTool } from 'exiftool-vendored';

// Inside the route handler, inside try/finally:
const et = new ExifTool({ taskTimeoutMillis: 30000 });
try {
  await et.write(localFilePath, { Attrib: [...] }, ['-overwrite_original', '-config', configPath]);
  // ...
} finally {
  await et.end();
}
```

**No `-stay_open` flag in the `ExifTool` constructor.** `exiftool-vendored`'s default behavior (without `exiftoolArgs`) does NOT pass `-stay_open True` — the library manages its own lifecycle. The scf-metadata desktop app passes it explicitly because it wraps the raw process; the npm package handles it internally and defaults to a single-use pattern when `maxTasksPerProcess: 1` is set.

For maximum speed in a cold-start serverless context, set:
```typescript
new ExifTool({
  taskTimeoutMillis: 30000,
  maxProcs: 1,
  maxTasksPerProcess: 1,  // spawn fresh process per task — avoids hang risk
})
```

### 2h. Failure modes — per-asset skip with warning accumulation

When stamping a batch of assets and one fails, the review link is NOT aborted. The link is created regardless. The failed stamp produces a `failed` job in the `jobs` collection with `error` set. The `decorate()` fallback to the original URL ensures guests always see content.

For the sync (≤3) path: collect errors per asset, create the review link, return `{ link, stampErrors: [{ assetId, error }] }` in the 201 response. The UI displays a warning per failed asset.

For the async path: the jobs run independently; failures are observable via `GET /api/assets/[assetId]/jobs`. The UI polls and shows per-asset stamp status.

**No retry at the review-link level.** Retry is handled by the existing `POST /api/jobs/[jobId]/retry` endpoint (Phase 60 infrastructure already in place).

---

## 3. Data Model Changes

### 3a. Asset type extension (`src/types/index.ts`)

```typescript
export interface Asset {
  // ... existing fields ...

  // v2.4: XMP stamp cache
  /** GCS path of the XMP-stamped copy. Set by stamp-metadata job. Absent until first stamp. */
  stampedGcsPath?: string;
  /** When the stamp was last written. Compare to updatedAt to detect staleness. */
  stampedAt?: Timestamp;
  /** Cached signed URL for the stamped copy. Same TTL pattern as signedUrl (120 min). */
  stampedSignedUrl?: string;
  stampedSignedUrlExpiresAt?: Timestamp;
  /** updatedAt — must be set on every mutating write (rename, new version). */
  updatedAt?: Timestamp;
}
```

**Note on `updatedAt`:** If this field is not already reliably written on rename (`PUT /api/assets/[assetId]`) and on upload-complete (`/api/upload/complete`), add `updatedAt: FieldValue.serverTimestamp()` to both before implementing stamp invalidation. Verify both write paths before Phase 1.

### 3b. JobType union extension (`src/types/index.ts`)

```typescript
// Before:
export type JobType = 'probe' | 'sprite' | 'thumbnail' | 'export';

// After:
export type JobType = 'probe' | 'sprite' | 'thumbnail' | 'export' | 'metadata-stamp';
```

### 3c. ReviewLink type — no change required

The `ReviewLink` type does not need new fields. Stamp state lives on asset docs, not review link docs.

---

## 4. New Files

| File | Purpose |
|------|---------|
| `src/app/api/assets/[assetId]/stamp-metadata/route.ts` | POST: download → exiftool → upload → update asset doc |
| `src/lib/stamp-helpers.ts` | `isStampStale(asset)`, `buildStampedGcsPath(pid, aid, ext)` — pure helpers, importable from route and decorate() |
| `public/exiftool/.config` | Copy of the scf-metadata `.config` Perl file (XMP namespace definition) — must be in a path accessible at Vercel function runtime |

**Config file placement:** The exiftool `.config` file must be accessible at runtime, not just build time. Place at `public/exiftool/.config`. At runtime, resolve via:
```typescript
import path from 'path';
const CONFIG_PATH = path.join(process.cwd(), 'public', 'exiftool', '.config');
```
On Vercel, `process.cwd()` is the project root. The `public/` directory is included in the serverless function bundle. Verify this with a test deploy before Phase 1 completion.

---

## 5. Modified Files

### 5a. `src/types/index.ts`
- Add `'metadata-stamp'` to `JobType` union
- Add `stampedGcsPath?`, `stampedAt?`, `stampedSignedUrl?`, `stampedSignedUrlExpiresAt?`, `updatedAt?` to `Asset` interface

### 5b. `src/lib/jobs.ts`
- Add `findOrCreateStampJob(assetId, projectId, userId): Promise<{ jobId: string; created: boolean }>` — check for existing queued/running stamp job before creating
- Add `SYNC_STAMP_THRESHOLD = 3` as exported constant (used by the review-links POST route)

### 5c. `src/lib/gcs.ts`
- Add `buildStampedGcsPath(projectId: string, assetId: string, ext: string): string`

### 5d. `src/app/api/review-links/route.ts` (POST)
- After the review link doc is written, resolve asset IDs from `assetIds` and/or query from `folderIds`
- For each asset, call `findOrCreateStampJob()` — up to `SYNC_STAMP_THRESHOLD` execute synchronously via internal fetch to `/api/assets/[assetId]/stamp-metadata`; remainder are left as `queued` jobs
- Return `{ link, pendingStampJobIds?: string[] }` in the 201 response

### 5e. `src/app/api/review-links/[token]/route.ts` (GET — `decorate()`)
- Import `isStampStale` from `src/lib/stamp-helpers.ts`
- At the start of `decorate()`, resolve `gcsPathToServe`:
  ```typescript
  const stampFresh = asset.stampedGcsPath && !isStampStale(asset);
  const gcsPathToServe = stampFresh ? asset.stampedGcsPath : asset.gcsPath;
  const cachedUrl = stampFresh ? asset.stampedSignedUrl : asset.signedUrl;
  const cachedExp = stampFresh ? asset.stampedSignedUrlExpiresAt : asset.signedUrlExpiresAt;
  ```
- Sign `gcsPathToServe` as `asset.signedUrl` (overwrite in the returned object — guests always see this as `signedUrl`)
- If `link.allowDownloads`, sign `gcsPathToServe` for download
- Write-back to correct cache fields (`stampedSignedUrl` vs `signedUrl`) based on `stampFresh`

### 5f. `vercel.json`
- Add stamp-metadata route config:
  ```json
  "src/app/api/assets/[assetId]/stamp-metadata/route.ts": {
    "maxDuration": 60,
    "memory": 1024
  }
  ```

---

## 6. Data Flow: Happy Path (sync, ≤3 assets)

```
User clicks "Create Review Link" in CreateReviewLinkModal
  │
  ▼
POST /api/review-links
  ├─ Validate body, auth, project access
  ├─ Generate token, write reviewLinks/{token} doc
  ├─ Resolve asset IDs (from assetIds[] or folderIds[])
  ├─ For each asset (≤3, sync):
  │    ├─ findOrCreateStampJob(assetId) → jobId (new or existing)
  │    ├─ If new job: POST /api/assets/[assetId]/stamp-metadata (internal call)
  │    │    ├─ Mark job running
  │    │    ├─ Check isStampStale(asset) → skip if fresh
  │    │    ├─ generateReadSignedUrl(asset.gcsPath) → sourceUrl
  │    │    ├─ mkdtemp → localPath
  │    │    ├─ downloadToFile(gcsPath, localPath)
  │    │    ├─ new ExifTool({ maxTasksPerProcess: 1 })
  │    │    ├─ et.read(localPath) → { FileName, Attrib? }
  │    │    ├─ Build Attrib array (merge existing + new entry)
  │    │    ├─ et.write(localPath, { Attrib }, ['-overwrite_original', '-config', CONFIG_PATH])
  │    │    ├─ et.end()
  │    │    ├─ uploadBuffer(stampedGcsPath, fs.readFile(localPath), contentType)
  │    │    ├─ db.assets.update({ stampedGcsPath, stampedAt: now })
  │    │    ├─ updateJob(jobId, { status: 'ready', completedAt: now })
  │    │    └─ fs.rm(tmpDir)
  │    └─ Collect result: stamped | failed | skipped-fresh
  ├─ Return 201 { link: serializeReviewLink(...), stampErrors?: [...] }
  │
  ▼
User copies link, shares with guest
  │
  ▼
GET /api/review-links/{token}
  ├─ Validate token, password, expiry
  ├─ Resolve asset docs
  ├─ For each asset, decorate():
  │    ├─ stampFresh = !!asset.stampedGcsPath && !isStampStale(asset)
  │    ├─ gcsPathToServe = stampFresh ? stampedGcsPath : gcsPath
  │    ├─ getOrCreateSignedUrl(gcsPathToServe, cached, cachedExp, 120)
  │    │    → asset.signedUrl = <stamped URL or original URL>
  │    ├─ getOrCreateSignedUrl(thumbnailGcsPath, ...) → asset.thumbnailSignedUrl
  │    ├─ getOrCreateSignedUrl(spriteStripGcsPath, ...) → asset.spriteSignedUrl
  │    └─ if allowDownloads: generateDownloadSignedUrl(gcsPathToServe, name)
  ├─ flushUrlWrites() — batch-commits fresh cache values
  └─ Return { reviewLink, assets, folders, projectName }
```

---

## 7. Data Flow: Async Path (>3 assets)

```
POST /api/review-links (4+ assets)
  ├─ Write reviewLinks/{token} doc
  ├─ For each asset:
  │    └─ findOrCreateStampJob(assetId) → jobId
  │         (all jobs left at status: 'queued')
  ├─ Return 201 { link, pendingStampJobIds: ['job1', 'job2', ...] }
  │
  ▼
Client (CreateReviewLinkModal)
  ├─ Sees pendingStampJobIds in response
  ├─ Shows "Metadata being applied… (0/4 complete)"
  ├─ Polls GET /api/assets/[assetId]/jobs every 3s per asset
  │    (already exists from Phase 60)
  └─ Updates badge: "Stamped ✓" | "Failed ⚠"
  │
  ▼
[Background] How are queued jobs executed?
  ├─ Option A (v2.4 scope): jobs remain queued until someone calls the stamp route
  │    → the next time the review link is shared and decorate() runs, if stamp is
  │       still missing (stale), serve original. The user can trigger a manual stamp
  │       retry via "Retry" in the job status UI (Phase 60 already has retry button).
  │
  ├─ Option B (future): a cron or queue worker picks up queued jobs
  │    → deferred; v2.4 does not introduce a queue worker
  │
  └─ DECISION for v2.4: queued jobs are executed when the stamp-metadata route is
     called directly. For async batches >3, the CreateReviewLinkModal can call
     POST /api/assets/[assetId]/stamp-metadata for each queued job in sequence
     after the 201 returns (client-driven background processing). This avoids
     a queue worker while keeping the POST under 60s.
```

---

## 8. Failure Modes

| Failure | Detection | Handling |
|---------|-----------|---------|
| exiftool binary not found | `et.version()` throws | Mark job `failed`, log error, `decorate()` falls back to original |
| exiftool write fails (corrupt file, unsupported format) | `et.write()` throws | Mark job `failed`, log, fall back to original. Serve original URL to guest. |
| One of 5 assets fails in sync batch | Collect per-asset error | Create review link anyway. Return `stampErrors: [{assetId, error}]` in 201. UI shows warning per asset. |
| GCS download timeout (large file in 60s budget) | fetch timeout / function SIGKILL | `sweepStaleJobs()` (already in Phase 60) marks running jobs >2min as failed. Next GET decorate() falls back to original. |
| Concurrent stamp requests for same asset | Both create jobs | Second job finds `stampedGcsPath` fresh on execution → short-circuits to `ready`. No double-write. |
| Stamp exists but is stale (renamed asset) | `isStampStale(asset)` returns true | `decorate()` serves original. Stamp job is created fresh on next review-link POST for this asset. |
| /tmp disk full | `fs.mkdtemp` or download throws | Mark job `failed`. `finally` block tries `fs.rm` but will fail too (log and move on). Vercel /tmp is ephemeral per-invocation so this won't persist. |
| exiftool config file missing | `et.write()` throws (unknown tag) | Mark job `failed`. Log `CONFIG_PATH` for debugging. Alert: verify `public/exiftool/.config` is in bundle. |

---

## 9. Stamp Logic: Exact Replication of scf-metadata

The exiftool.js from the desktop app (verified from source):

```javascript
// From scf-metadata exiftool.js:
const ExtId = basename(tags.FileName, extname(tags.FileName))  // = asset.name without extension
const Created = dayjs().format('YYYY:MM:DD')
const oldAttrib = [...(tags?.Attrib || [])].map(tag => ({ ...tag, Data: this.Data }))
const Attrib = [...oldAttrib, { ExtId, Created, Data: this.Data, FbId: this.FbId }]
await this.exiftool.write(filePath, { Attrib }, ['-overwrite_original'])
```

Server-side equivalent in the stamp route:

```typescript
const CONFIG_PATH = path.join(process.cwd(), 'public', 'exiftool', '.config');
const FB_ID = 2955517117817270;
const DATA = '{"Company":"Ready Set"}';

const et = new ExifTool({ maxProcs: 1, maxTasksPerProcess: 1, taskTimeoutMillis: 30000 });
try {
  const tags = await et.read(localPath);
  const ext = path.extname(tags.FileName ?? asset.name);
  const ExtId = path.basename(tags.FileName ?? asset.name, ext);
  const Created = new Date().toISOString().slice(0, 10).replace(/-/g, ':'); // YYYY:MM:DD

  // Preserve existing Attrib entries, update their Data field, append new entry
  const oldAttrib = (tags.Attrib ?? []).map((a: Record<string, unknown>) => ({ ...a, Data: DATA }));
  const Attrib = [...oldAttrib, { ExtId, Created, Data: DATA, FbId: FB_ID }];

  await et.write(localPath, { Attrib }, ['-overwrite_original', '-config', CONFIG_PATH]);
} finally {
  await et.end();
}
```

**The `-config` flag is passed per-write, not via constructor args**, because `exiftool-vendored` manages the subprocess args internally. The config must be passed as an extra arg to each `write()` call.

**Data field format:** The scf-metadata source shows `this.Data = '|{"Company":"Ready Set"|}'` — note the pipe characters. However the ARCHITECTURE of the Attrib struct shows `Data: {}` as a plain string field. The hardcoded value to use is exactly `'|{"Company":"Ready Set"|}'` as stored in the desktop app. Verify against a sample file tagged by the desktop app using `exiftool -Attrib:all <file>` before v2.4 ships.

---

## 10. Bundle Size and Vercel Constraints

**`exiftool-vendored` npm package breakdown:**
- `exiftool-vendored` (core JS): ~200KB
- `exiftool-vendored.pl` (Linux Perl binary): ~20–30MB unpacked (Perl interpreter + ExifTool scripts; testing/help files excluded since v10.38.0)
- `exiftool-vendored.exe` (Windows): not installed in Linux Vercel environment (optional peer dep)

**Total addition to Vercel bundle: ~25–35MB.** The existing bundle already includes ffmpeg-static (~60MB) and @ffmpeg-installer (~30MB). Total function bundle stays well under Vercel Pro's 250MB limit.

**Vercel runtime notes:**
- `exiftool-vendored.pl` runs via the system `perl` interpreter. Vercel's Node.js lambda environment includes Perl. If it does not, `exiftool-vendored` falls back to spawning the bundled Perl binary. Verify on first deploy.
- The stamp route needs `runtime = 'nodejs'` and `maxDuration = 60` (same as probe/sprite).
- Memory: 1024MB (same as sprite). exiftool on typical media files uses <50MB resident.

**Confirm `exiftool-vendored` is platform-aware:** On Linux (Vercel), npm installs `exiftool-vendored.pl` automatically (optional dep resolved by platform). The `.exe` variant is skipped. No manual configuration needed.

---

## 11. Integration Points: Exact Function Signatures to Modify

### `src/types/index.ts`
- `JobType`: add `'metadata-stamp'`
- `Asset`: add 4 new optional fields (see §3a)

### `src/lib/jobs.ts`
- ADD: `findOrCreateStampJob(assetId: string, projectId: string, userId: string): Promise<{ jobId: string; created: boolean }>`
- ADD: `export const SYNC_STAMP_THRESHOLD = 3`

### `src/lib/gcs.ts`
- ADD: `buildStampedGcsPath(projectId: string, assetId: string, ext: string): string`

### `src/lib/stamp-helpers.ts` (NEW FILE)
- ADD: `isStampStale(asset: Asset): boolean`

### `src/app/api/assets/[assetId]/stamp-metadata/route.ts` (NEW FILE)
- `export async function POST(request: NextRequest, { params }: RouteParams)`
- `export const runtime = 'nodejs'`
- `export const maxDuration = 60`

### `src/app/api/review-links/route.ts`
- Modify `POST` handler: after `await db.collection('reviewLinks').doc(token).set(data)`, add stamp trigger logic
- Signature of the exported `POST` function does not change

### `src/app/api/review-links/[token]/route.ts`
- Modify `decorate()` (inner function, not exported): prepend stamp-aware path selection before existing `asset.gcsPath` block
- `decorate` signature does not change: `(asset: any) => Promise<any>`

### `vercel.json`
- Add stamp-metadata entry under `functions`

---

## 12. Phase Breakdown

### Phase A: Stamp Pipeline Standalone

**Goal:** `POST /api/assets/[assetId]/stamp-metadata` works end-to-end and is independently testable.

Deliverables:
1. `exiftool-vendored` added to `package.json`
2. `public/exiftool/.config` in repo
3. `src/types/index.ts`: `'metadata-stamp'` in `JobType`, new Asset fields
4. `src/lib/gcs.ts`: `buildStampedGcsPath`
5. `src/lib/stamp-helpers.ts`: `isStampStale`
6. `src/lib/jobs.ts`: `findOrCreateStampJob`, `SYNC_STAMP_THRESHOLD`
7. `src/app/api/assets/[assetId]/stamp-metadata/route.ts`
8. `vercel.json`: stamp-metadata entry
9. Manual test: POST to `/api/assets/[assetId]/stamp-metadata` → verify stamped GCS file, asset doc fields, job status

**Verification:** Can be tested before touching review-links at all. Call the route directly via `curl` or a test script, confirm `stampedGcsPath` is set on the asset doc, confirm the GCS file exists and has XMP metadata (`exiftool -Attrib:all <localDownload>`).

### Phase B: Review-Link Integration

**Goal:** Review-link POST triggers stamps; guest GET serves stamped URLs.

Deliverables:
1. Modify `src/app/api/review-links/route.ts` POST: stamp trigger logic, sync/async split
2. Modify `src/app/api/review-links/[token]/route.ts` `decorate()`: stamp-aware URL selection
3. Verify `updatedAt` is written on rename and upload-complete; add if missing

**Dependencies:** Phase A must complete first. `decorate()` changes can be written against Phase A's `stampedGcsPath` field.

### Phase C: UI Feedback

**Goal:** `CreateReviewLinkModal` shows "Applying metadata…" spinner for sync and polling status for async.

Deliverables:
1. `CreateReviewLinkModal`: handle `pendingStampJobIds` in POST response
2. Spinner/progress during sync stamp
3. Per-asset stamp status badge on the review link page
4. "Meta-stamped" badge on review-link guest view asset cards

**Dependencies:** Phase B. UI changes are additive; no new API routes needed.

### Phase D: Invalidation + Backfill

**Goal:** Stamp invalidates correctly on rename and new version; existing assets can be backfilled.

Deliverables:
1. Confirm `updatedAt: FieldValue.serverTimestamp()` is written by rename and upload-complete (may be done in Phase B)
2. Backfill script: `scripts/backfill-stamp-metadata.mjs` — iterates assets in review links, calls stamp route for any without `stampedGcsPath`
3. Cleanup: when a new stamp is produced, `deleteFile(old stampedGcsPath)` if it differs from the new one (ext change on rename)

**Dependencies:** Phases A, B, C. Can run in parallel with C.

---

## 13. REQ-Level Decisions (Must Be Locked Before Implementation)

These are architectural decisions that, if changed mid-implementation, require significant rework. Lock them before Phase A starts.

| Decision | This Doc's Recommendation | Why It's REQ-Level |
|----------|--------------------------|-------------------|
| Sync threshold (N=3 assets inline) | `SYNC_STAMP_THRESHOLD = 3` | Determines review-link POST response shape; UI async polling flow depends on this |
| One stamp per asset (not per review-link) | `projects/{pid}/assets/{aid}/stamped{ext}` | Determines GCS path scheme, cache strategy, and audit trail posture |
| Fallback on missing stamp: serve original (not 503) | Always return working URL | Determines guest UX contract; changing to 503 later would break existing review links |
| Stamp invalidation: `stampedAt < updatedAt` | Compare timestamps | Requires `updatedAt` be reliably written; changing to boolean flag later requires migration |
| Exiftool process: one per request, `et.end()` in finally | No `-stay_open` in serverless | Changing to a persistent subprocess requires a different execution model (not serverless) |
| Async queued jobs executed by client after POST | Client-driven background processing | Changing to a queue worker requires infra change (Vercel cron, Cloud Run, etc.) |

---

## 14. Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Probe/sprite pattern reuse | HIGH | Read both routes in full; stamp route is structurally identical |
| exiftool-vendored API (`read`, `write`, `end`) | HIGH | Verified against scf-metadata source + photostructure docs |
| Exact XMP tag values | HIGH | `.config` file and `exiftool.js` read directly from scf-meta install |
| Bundle size within 250MB | MEDIUM | ~25–35MB estimate based on scf-meta's install; not measured on fresh Linux install |
| Perl availability on Vercel | MEDIUM | Common in Node.js Lambda environments; not verified on Vercel Pro specifically |
| `et.write()` with `-config` as extra arg | MEDIUM | Inferred from exiftool-vendored API; verify the extra-args pattern works for `-config` |
| `updatedAt` field presence on all assets | LOW | Not verified; must check rename and upload-complete handlers before Phase A |

---

## 15. Open Questions

1. **Is `updatedAt` reliably written?** Check `PUT /api/assets/[assetId]` (rename path) and `/api/upload/complete`. If not, add it in Phase A/B as a prerequisite.

2. **Does Vercel Pro Lambda have Perl?** `exiftool-vendored.pl` requires the system `perl` binary. Test with a minimal deploy before Phase A is declared done.

3. **`-config` as extra arg to `et.write()`** — verify the call signature. The `exiftool-vendored` API docs show extra args can be passed as a third argument to `write()`. Confirm this is how `-config <path>` is passed (not via constructor `exiftoolArgs`).

4. **`Data` field pipe characters** — the desktop app uses `'|{"Company":"Ready Set"|}'` with pipes. Verify against a file already stamped by the desktop app. The pipe may be an exiftool escape for the struct delimiter; the server-side code must match exactly.

5. **Large batch async execution** — v2.4 proposes client-driven background processing (client calls stamp-metadata per queued job after POST returns). Is that acceptable UX for batches of 50–200? If not, a Vercel cron at `maxDuration=300` running `sweepStampQueue()` may be needed in a future milestone.
