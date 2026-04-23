# Pitfalls Research: v2.4 XMP Stamping Pipeline

**Domain:** Server-side exiftool XMP metadata injection on Vercel serverless / Firebase / GCS
**Researched:** 2026-04-23
**Confidence:** HIGH (grounded in codebase read + exiftool-vendored source + ffmpeg/exiftool runtime knowledge from existing generate-sprite + exports routes)

---

## Critical Pitfalls [HIGH] — Data corruption / production outage

---

### Pitfall 1: exiftool-vendored Linux Binary Missing at Runtime — Silent 500

**Severity:** [HIGH]

**What goes wrong:**
`exiftool-vendored` resolves to one of two platform packages: `exiftool-vendored.exe` (Windows) or `exiftool-vendored.pl` (Linux). On a Windows dev machine, npm may install the `.exe` variant. Vercel Lambdas run Linux x64; the Windows binary is either absent or non-executable. The route handler fails with `ENOENT` or `spawn error` at the first `exiftool.write()` call. Because exiftool-vendored lazy-starts the `-stay_open` process on first use, this error surfaces deep inside the job, after the job is already marked `running`, leaving it permanently stuck without the `sweepStaleJobs` watermark triggering (it only fires at 2 min, but the error throws immediately).

**Why it happens:**
`exiftool-vendored` is a meta-package that uses `optionalDependencies` to pull platform-specific sub-packages. If the developer's lockfile was committed on Windows, the Linux optional dependency (`exiftool-vendored.pl`) may be missing from `node_modules` in the Vercel build. Even if both exist, `outputFileTracingIncludes` in `next.config.mjs` must explicitly include the `.pl` Perl binary path so Next.js traces it into the Lambda bundle. The existing config (lines 26–46 of `next.config.mjs`) only covers `ffmpeg-static` and `@ffmpeg-installer` — exiftool is not in the list yet.

**How to avoid:**
1. Add to `next.config.mjs` `outputFileTracingIncludes` for the stamp route: `'./node_modules/exiftool-vendored.pl/**'`.
2. Add `exiftool-vendored` to `serverComponentsExternalPackages` (already done for firebase-admin, ffmpeg-static — same pattern applies).
3. In the stamp route, verify the exiftool binary path via `existsSync` immediately on cold start (mirror the `resolveFfmpeg()` pattern from `generate-sprite/route.ts`) and fail-fast with a clear error before creating the job.
4. In CI/CD, add a test that `require('exiftool-vendored')` resolves correctly on Linux (GitHub Actions uses Ubuntu).

**Warning signs:**
- `spawn error: ENOENT` in Vercel function logs for the stamp route.
- Job stuck in `running` state beyond 2 min sweep watermark with `error: 'function likely SIGKILL\'d or crashed'` (misleading — it actually crashed on binary lookup).
- Works perfectly in local dev on Windows, fails on first Vercel deploy.

**Phase to address:** stamp-pipeline (Phase 1 of v2.4)

---

### Pitfall 2: `-stay_open True` ExifTool Process Leaked Across Lambda Invocations

**Severity:** [HIGH]

**What goes wrong:**
The reference desktop app (`scf-metadata/exiftool.js`) creates a single `ExifTool` instance with `exiftoolArgs: ['-config', CONFIG, '-stay_open', 'True', '-@', '-']` and holds it alive for the entire Electron process lifetime. Serverless functions do not have a persistent process lifetime — each Lambda invocation may reuse a warm container or spin a fresh one. If the ExifTool instance is stored in module scope (e.g., `const et = new ExifTool(...)` at the top of the module), it persists across warm invocations but is abandoned when the container is frozen or recycled. The `-stay_open True` child process accumulates without `et.end()` being called, consuming Perl interpreter memory. On a warm container serving multiple stamp requests, this compounds until OOM.

**Why it happens:**
`-stay_open True` is optimal for Electron (one long-lived app, many files). In a serverless function, each warm container reuse re-enters the module without reinitializing — the existing `ExifTool` instance is reused (which is fine) but `end()` is never called when the container is recycled (there is no guaranteed shutdown hook on Vercel). Unlike `ffmpeg` which is a one-shot spawn, exiftool-vendored keeps a Perl process open via stdin pipe.

**How to avoid:**
Do NOT use `-stay_open True` in the serverless stamp route. Instead:
- Create a fresh `new ExifTool({ maxProcs: 1 })` per request (exiftool-vendored starts the process on first call and ends it in the same request lifecycle).
- Call `await et.end()` in a `finally` block — always, even on error.
- Do NOT replicate the `this.args = ['-stay_open', 'True', ...]` constructor pattern from the desktop reference.
- The custom `-config` flag should still be passed via `exiftoolArgs: ['-config', configPath]` without `-stay_open`.

**Warning signs:**
- Vercel function memory climbing over multiple warm invocations.
- `et.end()` never appearing in the stamp route implementation.
- OOM kills showing in Vercel logs (`SIGKILL` reason: memory limit).

**Phase to address:** stamp-pipeline

---

### Pitfall 3: `et.end()` Not Awaited — Zombie Perl Process Holds /tmp File Descriptor

**Severity:** [HIGH]

**What goes wrong:**
`exiftool.end()` returns a Promise. If called without `await` (e.g., `et.end()` in a `finally` block), the Perl process may not have flushed its last write before the Lambda function returns. The `/tmp` file the stamped output was written to may still have an open file descriptor from the Perl process, causing `EBUSY` errors on the `fs.rm(tmpDir, { recursive: true })` cleanup call. Worse: if the stamped bytes are still being flushed by Perl when the Lambda freezes, the GCS upload that happened before `et.end()` may contain a partially-written file.

**Why it happens:**
The existing codebase learned this lesson with ffmpeg — `generate-sprite/route.ts` lines 208–211 explicitly `await` the writer's `close` event before proceeding to GCS upload. The same discipline applies to exiftool. `et.end()` has the same flush-then-close semantics.

**How to avoid:**
- Always `await et.end()` in `finally`.
- Upload the stamped file to GCS only AFTER `et.end()` has resolved.
- Mirror the sprite route pattern: GCS upload → mark job ready → `finally { await et.end(); await fs.rm(tmpDir) }`.

**Warning signs:**
- Corrupted stamped files in GCS (XMP partially written, file truncated).
- `EBUSY` errors in cleanup logs.
- `et.end()` present but without `await`.

**Phase to address:** stamp-pipeline

---

### Pitfall 4: MP4 faststart Flag Destroyed by exiftool XMP Write

**Severity:** [HIGH]

**What goes wrong:**
Web-playable MP4s have `moov` atom at the start of the file (faststart / web-optimized). exiftool writes XMP into a `uuid` atom. When the metadata it needs to update is located between `mdat` and `moov`, exiftool must rewrite atom offsets. In some cases this reordering moves `moov` back to the end of the file, breaking browser progressive download (the video cannot start playing until fully downloaded). The failure is silent — the file is not corrupt, it plays correctly, but it's no longer faststart-optimized.

**Why it happens:**
exiftool's MP4 XMP writing appends or relocates atoms. The `-overwrite_original` flag (used in the desktop app) writes back in-place. Whether this preserves `moov` positioning depends on the specific MP4 structure. Videos encoded by Premiere, After Effects, or Compressor may have varying atom layouts.

**How to avoid:**
After exiftool writes the XMP, run a verification step: check if the stamped file still has `moov` at offset < `mdat`. The simplest approach: run `ffmpeg -i stamped.mp4 -c copy -movflags +faststart stamped-fs.mp4` as a post-processing step after exiftool stamps the file but before uploading to GCS. This adds ~1–2s to the pipeline for a typical review clip but guarantees faststart preservation. Alternatively, verify `moov` position using a minimal MP4 atom parser before deciding if the post-pass is needed.

**Warning signs:**
- Stamped video plays in desktop players but shows long loading time in the browser before first frame.
- `ffprobe` on the stamped file shows `moov` offset > file midpoint.
- Users report slow review-link video loading specifically for stamped assets.

**Phase to address:** stamp-pipeline

---

### Pitfall 5: Concurrent Stamp Jobs Race on `asset.stampedGcsPath` Write

**Severity:** [HIGH]

**What goes wrong:**
Two review links for the same asset are created simultaneously (or a retry + new request overlap). Both trigger stamp jobs. Both read the asset, see `stampedGcsPath` is empty, and proceed to stamp independently. Both write different GCS objects. The second Firestore write of `stampedGcsPath` wins, but the first GCS object is an orphan (never cleaned up, never referenced). If the two jobs write different `stampedAt` timestamps, the cache-busting logic becomes unreliable — the `stampedAt` on the asset may not correspond to the GCS object currently at `stampedGcsPath`.

**Why it happens:**
The jobs collection exists, but there is no deduplication transaction that says "if a `metadata-stamp` job already exists in `queued` or `running` state for assetId X, do not create a new one." The existing `createJob` helper in `src/lib/jobs.ts` always creates a new document — there is no idempotency guard.

**How to avoid:**
In the stamp route (`POST /api/assets/[id]/stamp-metadata`), wrap job creation in a Firestore transaction:
1. Read the asset doc inside the transaction.
2. Query for any existing `metadata-stamp` job for this assetId with status `queued` or `running`.
3. If one exists, return its jobId (do not create a new job).
4. If none exists, create the job and write `stampingJobId` onto the asset doc atomically.
This mirrors the "dedupe duplicate sprite triggers" pattern noted in the v2.0 milestone (Phase 60 OBS-03).

**Warning signs:**
- Two `metadata-stamp` jobs with the same `assetId` both showing `running` simultaneously in the jobs collection.
- GCS accumulating `stamped-*.mp4` files for the same assetId.
- `stampedAt` and `stampedGcsPath` out of sync (one is from job A, the other from job B).

**Phase to address:** stamp-pipeline

---

### Pitfall 6: Large Video Buffered in Memory During GCS Upload-Back

**Severity:** [HIGH]

**What goes wrong:**
`uploadBuffer()` in `src/lib/gcs.ts` (line 104–112) calls `file.save(buffer, ...)` — it requires the entire file as a `Buffer` in memory. For a 500MB video, this means holding 500MB in Lambda memory at upload time. Vercel Lambdas on Hobby have 1GB memory. A 500MB source download + 500MB stamped buffer in memory simultaneously = 1GB peak, hitting the ceiling and causing OOM kills.

**Why it happens:**
`uploadBuffer` works perfectly for small files (sprite JPEGs, thumbnails, exports bounded to 45s clips). The stamp pipeline operates on the full original file — potentially 500MB+. The existing `generate-sprite` route streams the download to `/tmp` first (for precisely this reason, documented at lines 140–145 of `route.ts`), but uses `uploadBuffer` for the much smaller sprite JPEG. Stamping requires the same streaming discipline for the upload path.

**How to avoid:**
Do not use `uploadBuffer()` for the stamped output. Instead, use the GCS streaming upload API: `file.createWriteStream({ contentType, resumable: true })` and pipe the local file into it via `fs.createReadStream(stampedPath).pipe(gcsStream)`. Add a streaming counterpart to `gcs.ts`: `uploadStream(gcsPath, localFilePath, contentType)`. This keeps memory usage bounded to buffered chunks (~64KB at a time) rather than the full file.

**Warning signs:**
- OOM kills in Vercel logs for large video stamp requests.
- `uploadBuffer` called with a file path larger than ~50MB in the stamp route.
- Memory usage spike visible in Vercel function metrics during stamp phase.

**Phase to address:** stamp-pipeline

---

### Pitfall 7: Attrib Array Append Semantics Broken — History Clobbered or Duplicated

**Severity:** [HIGH]

**What goes wrong:**
The desktop reference app (`exiftool.js` lines 46–58) reads the existing `Attrib` array from the file, maps over it to refresh the `Data` field on each entry, then appends a new entry. The exact logic is:
```js
const oldAttrib = [...(tags?.Attrib || [])].map((tag) => ({ ...tag, Data: this.Data }))
const Attrib = !opts.clear ? [...oldAttrib, { ExtId, Created, Data, FbId }] : null
```
A server-side implementation that does NOT read the existing `Attrib` before writing will clobber all prior attribution history. An implementation that reads but does not spread `oldAttrib` first will only write the new entry, losing all prior entries. An implementation that does not destructure correctly (e.g., treating `tags.Attrib` as a single object instead of an array when only one entry exists) will either throw or produce a 1-entry array that looks correct but drops history.

**Why it happens:**
exiftool-vendored returns XMP arrays as JavaScript arrays, but single-value XMP arrays may come back as a plain object rather than a `[object]` array depending on the exiftool version and the XMP namespace definition. If the `.config` file defines `Attrib` as a bag (unordered) vs. seq (ordered), the deserialization differs.

**How to avoid:**
- Always normalize: `const oldAttrib = Array.isArray(tags.Attrib) ? tags.Attrib : tags.Attrib ? [tags.Attrib] : []`
- Copy the exact spread pattern from the reference: `[...oldAttrib.map(tag => ({ ...tag, Data: this.Data })), newEntry]`
- Write a unit test that: (1) stamps a file once, (2) stamps the same file again, (3) asserts `tags.Attrib.length === 2` and both entries are present.
- Never call `exiftool.write(path, { Attrib: [newEntryOnly] })` — always read first, build the full array, then write.

**Warning signs:**
- `Attrib` array length is always 1 regardless of how many times a file has been stamped.
- Prior `ExtId` / `Created` values disappear after re-stamp.
- Meta audit reports missing attribution history.

**Phase to address:** stamp-pipeline (the read-before-write pattern must be in the core implementation, not discovered in QA)

---

### Pitfall 8: XMP Namespace String Must Exactly Match `.config` File Definition

**Severity:** [HIGH]

**What goes wrong:**
The exiftool `.config` file defines a custom namespace with a specific URI (e.g., `http://ns.attribution.com/ads/1.0/`). When exiftool-vendored writes to this namespace, the tag names must be prefixed exactly as defined in the config. If the config file is not provided at runtime (wrong path, not bundled in the Lambda), exiftool silently writes tags under an unknown namespace with the correct tag name but a different URI. The XMP data appears to be written (no error), but Meta's validation tool rejects it because the namespace URI does not match.

**Why it happens:**
The `-config` flag in the desktop app points to `resolve(__dirname, '../public/exiftool/.config')`. In the server-side Lambda, `__dirname` does not exist (ES modules) and the `public/` directory is not automatically bundled into the Lambda's function directory. The config file path must be explicitly included in `outputFileTracingIncludes` and resolved via `path.join(process.cwd(), 'public/exiftool/.config')` or equivalent at runtime.

**How to avoid:**
- Add the config file to `outputFileTracingIncludes` for the stamp route.
- On Lambda cold start, verify the config path exists via `existsSync()` and fail-fast if not.
- Pass the verified path as `exiftoolArgs: ['-config', resolvedConfigPath]` when constructing ExifTool.
- After every stamp, do a verification read: `const verify = await et.read(stampedPath); assert(verify.Attrib)` — this will catch silent namespace mismatches.

**Warning signs:**
- exiftool write succeeds with no error but the `Attrib` field reads back as undefined after verification.
- Meta audit tool reports "unknown namespace" or "tag not recognized."
- Works in local dev (config file present), fails on Vercel (config file not bundled).

**Phase to address:** stamp-pipeline

---

### Pitfall 9: /tmp Disk Exhaustion Under Parallel Stamp Requests

**Severity:** [HIGH]

**What goes wrong:**
Vercel Lambda `/tmp` is 512MB total for the container, shared across all requests hitting the same warm container. A stamp job downloads the source video (up to 500MB), writes the stamped copy (same size), then cleans up. If two stamp requests hit the same warm Lambda simultaneously (or a previous request's cleanup failed), `/tmp` can hit 512MB and writes fail with `ENOSPC`. The source download write to `/tmp` throws, the exiftool write has no space to produce output, and the job is left `failed` with a disk-space error that is hard to interpret.

**Why it happens:**
Vercel's `/tmp` limit is 512MB total per container (not per invocation). The sprite route (generate-sprite) addressed this by checking `asset.size` before download and refusing files >1.5GB. But stamp jobs operate on the same large files. If cleanup in the `finally` block fails (e.g., due to an open file descriptor from exiftool), the tmp directory accumulates across warm reuses.

**How to avoid:**
- Follow the sprite route pattern exactly: check `asset.size` at the top; define a hard ceiling (e.g., 500MB for stamps given the 512MB `/tmp` budget).
- Use `mkdtemp` with a unique prefix per request (already the pattern in the sprite route, line 152).
- In the `finally` block: `await et.end()` first (flushes the Perl process and closes file descriptors), then `await fs.rm(tmpDir, { recursive: true, force: true })`.
- Log cleanup failures as errors but do not throw from `finally` (matches the sprite route pattern at lines 302–305).
- For assets larger than the `/tmp` ceiling, fail the job immediately with a clear `stampedGcsPath: null` and error: "asset too large for server-side stamping."

**Warning signs:**
- `ENOSPC` errors in stamp job logs.
- `/tmp` cleanup errors (`EBUSY`) cascading across requests on the same warm container.
- Stamp failures correlating with large source files.

**Phase to address:** stamp-pipeline

---

## Moderate Pitfalls [MEDIUM] — UX degradation, silent wrong behavior

---

### Pitfall 10: JPEG XMP APP1 Segment Conflicts With EXIF APP1 Segment

**Severity:** [MEDIUM]

**What goes wrong:**
JPEG files store both EXIF metadata and XMP metadata in `APP1` segments, but they are distinguished by a magic byte string at the start of each segment (`Exif\0\0` vs `http://ns.adobe.com/xap/1.0/\0`). exiftool handles this correctly in isolation. However, if the source JPEG was processed by a tool that wrote a malformed or duplicate APP1 segment, exiftool may fail to locate the XMP segment and write a second XMP block. The file then has two XMP APP1 segments. Most parsers use the first one; some use the second. Meta's validator uses the first. The stamped data is in the second — the stamp appears to succeed but the validation fails.

**Why it happens:**
iPhone photos, camera-to-computer imports, and web-scraped images frequently have malformed EXIF/XMP interleaving. exiftool's behavior on corrupt JPEG metadata is to log a warning and proceed — warnings go to stderr but exiftool exits 0.

**How to avoid:**
- Capture exiftool's stderr during write operations and log it.
- After stamping, do a verification read and check that `Attrib` is present — this catches XMP-not-found silently succeeding.
- For JPEGs sourced from user upload (not studio-controlled), add a pre-stamp validation step: `exiftool -validate -warning filename.jpg` to detect malformed segments before writing.

**Warning signs:**
- exiftool exits 0 but stderr contains "Warning: [minor] JFIF APP0 before EXIF."
- Post-stamp read shows `Attrib: undefined`.
- Only affects JPEGs; MP4s and PNGs stamp correctly.

**Phase to address:** stamp-pipeline (image format handling)

---

### Pitfall 11: PNG XMP Writes Not Universally Supported — HEIC/AVIF May Be Silent No-Op

**Severity:** [MEDIUM]

**What goes wrong:**
exiftool can write XMP to PNG (via the `iTXt` chunk) and to many image formats. However, for HEIC and AVIF, the XMP support depends on exiftool version and the specific subformat. If the asset is an HEIC file (common from iPhones) and the bundled exiftool version does not support XMP writing for that container, `exiftool.write()` exits 0 but no metadata is written. The stamped file is identical to the source, but `stampedGcsPath` is set and the UI shows "Meta-stamped." The actual XMP is absent.

**Why it happens:**
exiftool-vendored ships a specific exiftool version. HEIC/AVIF XMP write support was added in exiftool 12.x but has had regressions. The `image-metadata.ts` fallback already uses ffprobe for HEIC/AVIF (Phase 64 note), acknowledging that these formats need special treatment.

**How to avoid:**
- After every stamp operation, regardless of format, do a verification read: `const verify = await et.read(stampedPath); if (!verify.Attrib) throw new Error('XMP write verification failed')`.
- For HEIC/AVIF, add format detection before stamping; if the format is known-unsupported, mark the job as `failed` with `error: 'XMP stamping not supported for HEIC/AVIF — use exported MP4'` and do NOT set `stampedGcsPath`.
- Document in the UI: "Meta-stamped" badge only appears when stamp succeeded AND verification passed.

**Warning signs:**
- `stampedGcsPath` set on HEIC assets but the file is binary-identical to the original.
- exiftool returns exit 0 with no warnings for HEIC write.
- Post-stamp read of `Attrib` returns undefined.

**Phase to address:** stamp-pipeline

---

### Pitfall 12: Timezone Mismatch — `Created` Field Uses UTC Server Clock, Meta Expects Local Date

**Severity:** [MEDIUM]

**What goes wrong:**
The reference app uses `dayjs().format('YYYY:MM:DD')` — `dayjs()` uses the local system clock (US Pacific on the designer's Mac). A Vercel Lambda runs in UTC. At 11:00 PM Pacific on April 22, the Lambda produces `2026-04-23` (UTC), while the desktop app would produce `2026-04-22`. If Meta's audit requires the `Created` date to match the campaign date (the date the file was delivered to the reviewer), a UTC-based server date is 8 hours ahead of Pacific and will show the wrong date for evening-delivery stamping.

**Why it happens:**
`new Date()` and `dayjs()` on a server without timezone configuration use UTC. The desktop reference app is user-local. The v2.4 `Created` field is not just decorative — it feeds Meta's attribution audit trail.

**How to avoid:**
- Accept a `timezone` parameter in the stamp request (e.g., `America/Los_Angeles`), or infer it from the project's configured timezone (store on the `project` doc).
- Use `dayjs().tz(timezone).format('YYYY:MM:DD')` (requires `dayjs/plugin/timezone` and `dayjs-timezone`).
- Default to `America/Los_Angeles` if not configured (matches the reference app's environment).
- Add a unit test that stamps a file at 11:30 PM UTC / 3:30 PM Pacific and asserts the `Created` date is the Pacific date.

**Warning signs:**
- `Created` date in stamped files is one day ahead of the expected delivery date for evening stamps.
- Meta audit reports date mismatches for assets delivered in the second half of the day.

**Phase to address:** stamp-pipeline

---

### Pitfall 13: Old Stamped File Orphaned in GCS When Asset Is Renamed

**Severity:** [MEDIUM]

**What goes wrong:**
When an asset is renamed, the `stampedGcsPath` is invalidated (the stamp embeds `ExtId = basename(filename, ext)` from the filename). The v2.4 plan calls for lazy re-stamp on rename. The new stamp creates a new GCS object at a different path. The old GCS object (old stamped file, potentially 500MB) remains in GCS indefinitely. There is no cleanup step. At scale, with many renames and re-stamps, this creates significant storage waste.

**Why it happens:**
The existing `deleteFile()` in `gcs.ts` is only called explicitly during hard-delete operations. There is no "delete old stamped file before writing new one" step in the stamp pipeline.

**How to avoid:**
- In the stamp route, read `asset.stampedGcsPath` before writing the new stamped file.
- If a prior `stampedGcsPath` exists, call `deleteFile(asset.stampedGcsPath)` after the new stamp is confirmed uploaded to GCS.
- Order matters: new upload first → Firestore update of `stampedGcsPath` → delete old file. Never delete first (leaves a window where the asset has no stamped file).
- Also delete `stampedGcsPath` file during asset hard-delete (add to `hardDeleteAsset` in `src/lib/trash.ts`).

**Warning signs:**
- GCS bucket accumulating multiple `stamped-*.mp4` files per assetId.
- Storage costs creeping up after a period of heavy renaming.

**Phase to address:** invalidation phase

---

### Pitfall 14: Stale `stampedAt` vs `stampedGcsPath` — Timestamp Field Type Mismatch

**Severity:** [MEDIUM]

**What goes wrong:**
The cache-busting logic compares `asset.stampedAt` against `asset.updatedAt` to determine whether a re-stamp is needed. If `stampedAt` is a Firestore `Timestamp` object (from `FieldValue.serverTimestamp()`) and `updatedAt` is stored as an ISO string (from a client-side PATCH), the comparison `stampedAt > updatedAt` always produces a wrong result because JavaScript cannot directly compare a Firestore Timestamp object against a string. The `coerceToDate` utility in `src/lib/format-date.ts` handles this, but only if the invalidation check passes through it.

**Why it happens:**
The existing codebase has this exact problem solved in `src/lib/format-date.ts` (Phase 49 fix), but the stamp invalidation logic is new code that must explicitly use `coerceToDate`. A developer writing the invalidation check inline (`asset.stampedAt < asset.updatedAt`) will hit the type mismatch silently — the comparison returns `false` or `true` unpredictably depending on the Timestamp shape.

**How to avoid:**
- The invalidation check in `decorate()` and `POST /api/review-links` must use: `coerceToDate(asset.stampedAt) < coerceToDate(asset.updatedAt)`.
- Add a unit test with a Firestore Timestamp `stampedAt` and ISO string `updatedAt` asserting the comparison returns the correct boolean.
- Standardize: all new timestamp fields written by server routes use `FieldValue.serverTimestamp()` (Firestore Timestamp). All fields that may come from the client use ISO strings. Never mix at the comparison site.

**Warning signs:**
- Re-stamp never triggered on rename (always shows as current).
- Re-stamp always triggered even when `stampedAt` is more recent than `updatedAt`.
- Type errors only visible in TypeScript strict mode, not at runtime.

**Phase to address:** invalidation phase

---

### Pitfall 15: Review-Link POST Blocking for 30s+ When Stamping Sync

**Severity:** [MEDIUM]

**What goes wrong:**
The plan says "sync stamping for ≤3 assets." A 3-asset review link with 500MB videos will block the POST for 3 × (download + exiftool + upload) time. Each stamp operation for a large file could take 15–30s. Three in sequence = 45–90s, exceeding `maxDuration=60`. Even if the videos are small, 3 sequential stamp operations + GCS uploads can easily hit 30s, making the review link creation feel broken.

**Why it happens:**
Sync stamping is simpler to implement and the plan caps it at 3. But the 60s maxDuration budget is shared with the review link creation logic itself, GCS signed URL generation, and Firestore writes.

**How to avoid:**
- Make stamping async even for 1–3 assets. Return the review link token immediately with a `stampingStatus: 'pending'` flag.
- The client polls the stamp job status via the existing `GET /api/assets/[id]/jobs` endpoint.
- The `decorate()` function in the review link response falls back to the original `signedUrl` if `stampedGcsPath` is not yet available.
- Define a clear time budget: if the stamp queue has not resolved within the review link's `maxDuration`, fail the stamp job (not the review link creation).
- Never block the POST for stamp processing regardless of asset count.

**Warning signs:**
- `CreateReviewLinkModal` spinner running for >15s.
- Vercel function timeout errors on review link creation for large assets.
- Users clicking "Create Review Link" multiple times (thinking it didn't work).

**Phase to address:** review-link integration phase

---

### Pitfall 16: Guest Clicks Download Before Stamp Finishes — Gets Original (Not Stamped) File

**Severity:** [MEDIUM]

**What goes wrong:**
A guest opens a review link immediately after the creator shares it. The stamp job is still `running`. The `decorate()` function checks for `stampedGcsPath` — it's not set yet. It falls back to the original `signedUrl` and `downloadUrl`. The guest downloads the un-stamped original. This is functionally fine but defeats the entire purpose of the feature. If the guest downloads during the ~10–30s stamping window, they get the wrong file.

**Why it happens:**
Async stamping is correct, but without a UI gate that prevents guest download until stamp completes, there is a window where the wrong file is served.

**How to avoid:**
- In the review link guest page, if `asset.stampingStatus === 'pending'`, disable the Download button and show "Preparing file..." with a progress indicator.
- Poll `GET /api/assets/[id]/jobs` (guest-accessible, filtered to the stamp job) until the job is `ready`, then enable the button.
- If the stamp job fails, enable the Download button anyway (fall back to original) — do not permanently block download on stamp failure.
- The `decorate()` function must include `stampingStatus` in the response so the client knows to poll.

**Warning signs:**
- Guests downloading un-stamped files.
- No "preparing file" UI while stamp is in progress on the review link page.
- Download button immediately available even when stamp job is `queued`.

**Phase to address:** UI-feedback phase

---

### Pitfall 17: "Stamping in Progress" UI Lies After Stamp Job Fails

**Severity:** [MEDIUM]

**What goes wrong:**
The stamp job transitions `queued → running → failed`. If the client is polling for the job status and the poll interval is 5s, the UI shows "Applying metadata..." for up to 5s after the job has already failed. If the polling stops when the component unmounts (guest navigates away and back), the `stampingStatus` is never re-read from the latest job state, and the UI shows "Applying metadata..." indefinitely.

**Why it happens:**
The polling logic in `useAssetJobs` may stop on unmount. The `sweepStaleJobs` at 2 min will eventually flip the job to `failed`, but the client UI won't know unless it's actively polling.

**How to avoid:**
- Poll on a fixed interval while the job is `queued` or `running`.
- When the poll response shows `status: 'failed'`, transition the UI to: enable Download button (fall back to original), show a dismissible "Metadata could not be applied" toast. Do not leave the spinner running.
- On remount (guest navigates back), re-check job status immediately (no stale UI from a previous session).
- Cap polling at 60s — if the job is still `running` after 60s, assume it will be swept and treat as failed in the UI.

**Warning signs:**
- "Applying metadata..." spinner visible on a review link page after 5+ minutes.
- No error indication after stamp job failure.
- UI does not update after page revisit.

**Phase to address:** UI-feedback phase

---

### Pitfall 18: Stamped GCS File Publicly Guessable Via Path Pattern

**Severity:** [MEDIUM]

**What goes wrong:**
If the stamped GCS path follows a predictable pattern like `projects/{projectId}/assets/{assetId}/stamped.mp4`, any user who knows a project ID and asset ID can construct the path and attempt to access the file. Since the GCS bucket is private (requiring signed URLs), a direct path is not accessible. But if the bucket ever has a misconfigured IAM rule granting `allUsers` read, all stamped files become publicly accessible. More practically: the path pattern leaking into browser dev tools (via signed URL parameters) exposes the underlying asset structure to guests.

**Why it happens:**
The pattern follows the existing GCS path scheme (e.g., `projects/{id}/assets/{id}/sprite-v2.jpg`). The concern is that stamped files contain internal metadata (project ID, potentially internal asset IDs embedded in XMP).

**How to avoid:**
- Use a non-guessable path component: `projects/{projectId}/assets/{assetId}/stamped-{hash}.mp4` where `hash = sha256(assetId + stampedAt)`.
- Or store under a separate GCS prefix: `stamped/{jobId}/{originalFilename}` — decoupled from the asset path, harder to enumerate.
- Verify GCS bucket IAM never has `allUsers` or `allAuthenticatedUsers` read access (this should already be enforced; double-check before shipping).
- Do NOT include the internal `projectId` or `assetId` in the XMP data written by the stamp (the `ExtId` field should be the filename, not internal IDs per the reference app).

**Warning signs:**
- Signed URLs exposing `stamped.mp4` at the predictable path.
- A guest's browser network inspector showing the asset's internal structure.

**Phase to address:** stamp-pipeline, auth & authorization

---

## Minor Pitfalls [LOW] — Developer confusion, subtle bugs

---

### Pitfall 19: `ExtId` Should Be Filename Without Extension, Not Asset ID

**Severity:** [LOW]

**What goes wrong:**
The reference app computes `ExtId = basename(tags.FileName, extension)` — the filename without its extension. A server-side implementation that uses `asset.id` (the Firestore document ID) or `asset.gcsPath` instead will write a different `ExtId`. Meta's audit tool uses `ExtId` to identify the creative. A mismatch between what the desktop app produces and what the server produces will cause attribution discrepancies in the audit trail.

**Why it happens:**
The server has easy access to `asset.id` but needs to explicitly look up `asset.name` (the filename) and strip the extension.

**How to avoid:**
- Compute `ExtId = path.basename(asset.name, path.extname(asset.name))` exactly as the desktop app does.
- The `asset.name` field in Firestore is the user-facing filename.
- Write a unit test asserting `ExtId` for `"campaign-video-v1.mp4"` is `"campaign-video-v1"`.

**Phase to address:** stamp-pipeline

---

### Pitfall 20: `FbId` Stored as JavaScript Number — Precision Loss for Large Integers

**Severity:** [LOW]

**What goes wrong:**
`FbId = 2955517117817270` is a 64-bit integer. JavaScript's `Number` type can represent integers exactly up to `Number.MAX_SAFE_INTEGER = 9007199254740991`. `2955517117817270 < 9007199254740991`, so this specific value is safe. However, if `FbId` is ever read from Firestore (where it would be stored as a `number` in the document) and compared or passed to exiftool, JavaScript number representation is sufficient. This is low risk for the specific hardcoded value but worth noting if `FbId` is later made configurable and a user enters a larger ID.

**How to avoid:**
- Keep `FbId` hardcoded as a constant — do not read it from user input.
- If making it configurable (deferred per v2.4 scope), store as a Firestore `string` and pass as a string to exiftool.

**Phase to address:** stamp-pipeline

---

### Pitfall 21: `sweepStaleJobs` 2-Minute Watermark Too Long for Failed Stamp Jobs

**Severity:** [LOW]

**What goes wrong:**
The existing sweep (`src/lib/jobs.ts` line 73) marks jobs stuck in `running` for >2 min as failed. A stamp job that crashes immediately (e.g., binary not found, /tmp full) transitions to `failed` on its own via the catch block. But if `updateJob` in the catch block also fails (Firestore write error), the job stays `running` with no error. The 2-minute sweep will eventually fix it, but the `CreateReviewLinkModal` UI shows "Applying metadata..." for the full 2 minutes before showing the error state.

**How to avoid:**
- Add a `stampingTimeout` of 90s to the stamp route itself: use `Promise.race([stampProcess, timeout(90000)])` and if the stamp times out, mark the job failed explicitly before the Lambda deadline.
- The 2-minute sweep is a last-resort safety net; the route should self-report failure before the Lambda is SIGKILL'd at 60s.

**Phase to address:** stamp-pipeline

---

### Pitfall 22: Local Dev Works Without Exiftool Because Fallback to System Perl

**Severity:** [LOW]

**What goes wrong:**
On a developer's machine, exiftool may be installed system-wide (`/usr/bin/exiftool` or Homebrew). If the `node_modules/exiftool-vendored.pl` binary is missing (e.g., wrong lockfile), exiftool-vendored may fall back to the system Perl + system exiftool. Everything works locally. The Vercel Lambda has neither — it fails at runtime. The mismatch means local dev gives false confidence.

**How to avoid:**
- Add a startup check to the stamp route: log which exiftool binary path is being used. If it is not the vendored path, fail loudly in development with a console warning.
- Add an integration test that explicitly asserts the vendored binary path is used, not a system fallback.
- In package.json, add `exiftool-vendored.pl` explicitly to `dependencies` (not just `exiftool-vendored`), so npm always installs the Linux binary.

**Phase to address:** stamp-pipeline (deployment verification)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Sync stamping for ≤3 assets | Simpler code, no polling UI for small links | Blocks review link creation for large files, can hit 60s timeout | Never — async is correct from day one |
| `uploadBuffer()` for stamped video | Reuses existing helper | OOM on files >250MB | Never for stamp pipeline — use streaming upload |
| Skip verification read after exiftool write | Faster per-stamp | Silent XMP failures undetected until Meta audit | Never — always verify |
| `-stay_open True` in serverless | Faster repeated stamps (process reuse) | Zombie Perl processes, OOM across warm invocations | Never in serverless |
| Hardcode config path as `public/exiftool/.config` | Works in dev | Missing in Lambda if not traced | Acceptable in dev only; always verify in prod |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| exiftool-vendored on Vercel | Install meta-package only; Linux binary missing from bundle | Add `exiftool-vendored.pl` to deps + `outputFileTracingIncludes` |
| GCS upload for large files | Use `uploadBuffer()` for all files | Use streaming upload for files >50MB |
| Firestore Timestamp vs ISO string | Direct comparison `stampedAt < updatedAt` | Always route through `coerceToDate()` from `src/lib/format-date.ts` |
| Job dedup for stamp | Call `createJob()` unconditionally | Wrap in transaction that checks for existing queued/running stamp job |
| exiftool config file | Omit from bundle; works locally via system exiftool | Add to `outputFileTracingIncludes`; verify path on cold start |
| GCS cleanup after re-stamp | Write new file, update Firestore, forget old file | Delete old `stampedGcsPath` after new upload confirmed |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Sequential stamp for N assets in review link POST | 30s+ review link creation | Always async stamp; return link immediately with `stampingStatus: pending` | At 2 assets × large files |
| Not streaming GCS download to /tmp | OOM on Lambda for files >256MB | Stream to /tmp (same as sprite route pattern) | At ~256MB source files |
| Not streaming GCS upload from /tmp | OOM on Lambda for files >250MB | Stream from local file to GCS write stream | At ~250MB stamped files |
| Polling with no timeout cap | "Applying metadata..." hangs forever on failed job | Cap poll at 60s; fall back to original on timeout | Immediately on stamp failure |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Stamped GCS path follows predictable pattern | Path enumeration exposes asset structure | Add a hash or jobId component to the stamped path |
| Internal project/asset IDs written into XMP Attrib | Leaks internal structure to external reviewers | Only write `ExtId` (filename), `Created`, `Data`, `FbId` — no internal IDs |
| Stamp route accessible without auth | Any caller can trigger expensive stamp operation | Require authenticated user (not guest token) to POST stamp; guests only trigger via review-link creation |
| Stamped file signed URL cached past expiry | Guest downloads fail silently | Apply same `getOrCreateSignedUrl` cache logic from `src/lib/signed-url-cache.ts` to stamped URLs |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Blocking review link creation for stamp | Creator waits 30s+, thinks it failed | Async stamp; return link immediately; show "Preparing files..." on guest page |
| Download available before stamp done | Guest gets un-stamped original | Disable download button while `stampingStatus: pending`; poll and enable on ready |
| Spinner forever after stamp failure | Guest confused, cannot download | Detect failed job state; fall back to original; show "Metadata could not be applied" toast |
| "Meta-stamped" badge on failed stamp | Incorrect compliance signal | Badge only shown when stamp verified (post-write read confirms `Attrib` present) |
| No distinction between "stamping in progress" and "stamp failed" | User cannot tell if they should wait or act | Two distinct UI states: amber spinner for in-progress, red warning + fallback download for failed |

---

## "Looks Done But Isn't" Checklist

- [ ] **Exiftool binary:** Bundled in Lambda for Linux x64 — verify `existsSync(exiftoolBinPath)` on cold start returns true in Vercel logs.
- [ ] **Config file bundled:** `.config` file for custom namespace included in `outputFileTracingIncludes` — verify path resolves in Lambda.
- [ ] **Attrib append:** Second stamp of same file produces `Attrib.length === 2`, not 1 — unit test covers this.
- [ ] **et.end() awaited:** `finally` block has `await et.end()` not `et.end()` — review every stamp code path.
- [ ] **Faststart preserved:** Stamped MP4 passes `ffprobe -v quiet -show_entries format_tags=major_brand` and `moov` is before `mdat` — automated check in stamp pipeline.
- [ ] **Streaming upload:** Stamp route uses streaming GCS upload, not `uploadBuffer()` — code review gate.
- [ ] **Orphan cleanup:** Old `stampedGcsPath` deleted before/after new stamp on rename — trace the rename → invalidate → re-stamp → delete-old flow in tests.
- [ ] **Timezone:** `Created` field shows the Pacific date for an evening-UTC stamp — unit test with fixed UTC timestamp.
- [ ] **Verification read:** Post-stamp `et.read()` on stamped file asserts `Attrib` is present — every stamp code path.
- [ ] **Guest UI:** Download button disabled while `stampingStatus: pending` — manual QA on review link page.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Binary missing on deploy | LOW | Add to `outputFileTracingIncludes`, redeploy. No data loss. |
| et.end() not awaited → corrupt GCS files | HIGH | Delete corrupt stamped GCS objects; re-run stamp jobs; audit `stampedGcsPath` files for truncation. |
| Attrib history clobbered | HIGH | Cannot recover prior attribution entries. Re-stamp from source files only adds current entry, not history. Require re-delivery to Meta. |
| MP4 faststart destroyed | MEDIUM | Re-run stamp with post-processing faststart step. Delete old stamped file, upload corrected one. |
| Orphaned GCS files from renames | LOW | One-time GCS lifecycle policy to delete objects older than N days under the `stamped/` prefix if not referenced by any asset doc. |
| Timezone wrong date in Created | MEDIUM | Re-stamp affected files with corrected timezone. Identify affected stamps via `Created` date mismatch in audit. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Linux binary missing (P1) | stamp-pipeline | Cold-start log shows vendored binary path; Vercel deploy test |
| `-stay_open True` in serverless (P2) | stamp-pipeline | Code review: ExifTool constructor has no `-stay_open` |
| `et.end()` not awaited (P3) | stamp-pipeline | Code review + integration test: stamp + verify + cleanup completes without EBUSY |
| MP4 faststart destroyed (P4) | stamp-pipeline | Automated `ffprobe moov offset` check post-stamp |
| Concurrent stamp race (P5) | stamp-pipeline | Load test: 2 simultaneous stamp requests for same asset → 1 GCS object |
| Large file OOM on upload (P6) | stamp-pipeline | Integration test with 250MB file: memory stays below 512MB |
| Attrib append broken (P7) | stamp-pipeline | Unit test: double-stamp → `Attrib.length === 2` |
| Config file not bundled (P8) | stamp-pipeline | Post-deploy smoke test: stamp a file, read back `Attrib` |
| /tmp disk exhaustion (P9) | stamp-pipeline | Stress test: 3 concurrent stamps on same container |
| JPEG XMP conflict (P10) | stamp-pipeline | Test with known malformed JPEG; check stderr capture |
| HEIC/AVIF no-op (P11) | stamp-pipeline | Unit test: stamp HEIC → verify read returns Attrib or job fails cleanly |
| Timezone mismatch (P12) | stamp-pipeline | Unit test with fixed UTC time; assert Pacific date |
| Orphaned GCS on rename (P13) | invalidation phase | Integration test: rename → re-stamp → assert old GCS path deleted |
| Timestamp type mismatch (P14) | invalidation phase | Unit test: `coerceToDate(Timestamp) < coerceToDate(ISOString)` correct |
| Blocking review link POST (P15) | review-link integration | Load test: 3-asset review link creation completes in <3s |
| Guest downloads before stamp (P16) | UI-feedback phase | Manual QA: open review link during stamp window; download disabled |
| Spinner lies after failure (P17) | UI-feedback phase | Manual QA: trigger stamp failure; confirm spinner → error state transition |
| Guessable GCS path (P18) | stamp-pipeline | Code review: stamped path includes non-predictable component |

---

## Sources

- Codebase analysis (2026-04-23): `src/app/api/assets/[assetId]/generate-sprite/route.ts` (streaming download pattern, binary resolution, tmp cleanup), `src/app/api/exports/route.ts` (inline ffmpeg pattern, upload-back via `uploadBuffer`), `src/lib/jobs.ts` (job state machine, `sweepStaleJobs`), `src/lib/gcs.ts` (`uploadBuffer` signature, `downloadToFile`, streaming absence), `next.config.mjs` (existing `outputFileTracingIncludes` pattern), `src/lib/format-date.ts` (Timestamp coercion), `scf-metadata/src/backend/exiftool.js` (reference Attrib append logic, `-stay_open`, `-config`, `ExtId`, `FbId`, `dayjs` usage). HIGH confidence (first-hand source).
- exiftool-vendored platform packaging: `exiftool-vendored` npm README — uses `optionalDependencies` for `.exe` vs `.pl` sub-packages. HIGH confidence.
- Vercel Lambda `/tmp` limit: 512MB per container (Vercel docs). HIGH confidence.
- Vercel Lambda memory: 1024MB on Hobby plan. HIGH confidence.
- `exiftool -stay_open` behavior in serverless: known anti-pattern in the exiftool community; process persists until `et.end()` called. HIGH confidence.
- MP4 faststart and exiftool atom rewriting: exiftool documentation on MP4 writing; known issue that `-overwrite_original` can change `moov` position. MEDIUM confidence (documented but version-dependent).
- JPEG APP1 segment conflict: exiftool FAQ on JPEG XMP writing. HIGH confidence.
- dayjs timezone behavior: dayjs documentation. HIGH confidence.

---
*Pitfalls research for: v2.4 XMP Stamping Pipeline — Vercel + Firebase + GCS + exiftool-vendored*
*Researched: 2026-04-23*
