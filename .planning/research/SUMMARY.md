# Project Research Summary

**Project:** readyset-scope
**Milestone:** v2.4 -- Meta XMP Stamping on Delivery
**Domain:** Server-side XMP metadata injection for Meta ad-delivery attribution
**Researched:** 2026-04-23
**Confidence:** HIGH (core pipeline, GCS/Firestore integration, feature set) / LOW (Perl on Vercel Lambda runtime)

---

## Executive Summary

v2.4 adds one new capability: every asset in a review link is stamped with Meta's XMP attribution
schema (http://ns.attribution.com/ads/1.0/) before it is delivered to guests. The stamp is
asset-scoped -- one stamped GCS copy per asset, cached on the asset Firestore doc, shared across
all review links. Guests receive the stamped file via a one-line change in the existing decorate()
pipeline. Internal viewers always see the original. One new npm package is required:
exiftool-vendored@35.18.0, which mirrors the reference scf-metadata Electron app exactly.
Everything else -- GCS download/upload, job lifecycle, signed-URL cache, route structure -- reuses
existing patterns from the probe and generate-sprite routes verbatim.

The recommended implementation order is inside-out: build and validate the stamp pipeline as a
standalone route first (POST /api/assets/[assetId]/stamp-metadata), then wire it into review-link
creation, then add UI feedback. The stamp pipeline is entirely asset-level -- it is not triggered
per review-link or per download. Invalidation is automatic: stampedAt < updatedAt on the asset
doc triggers a re-stamp on the next review-link creation, without any explicit boolean flag that
could be missed on a write path.

The single highest-risk unknown is Perl availability in the Vercel Lambda runtime. The
exiftool-vendored.pl package ships a Perl ExifTool script, not a compiled binary -- system Perl
must be present at runtime. exiftool-vendored v8.17+ auto-detects missing /usr/bin/perl and
calls which-perl as a fallback (ignoreShebang), but if Perl is entirely absent from the Lambda
container, the spawn will fail with an ENOENT. A test deploy that calls the stamp route against a
real asset on Vercel **must happen before Phase A is declared done**. Every other confidence area
is HIGH.

---

## Key Findings

### Recommended Stack

One new dependency: exiftool-vendored@35.18.0. It is the only tool that supports custom XMP
namespaces via a -config file, writes XMP into both video (MP4 uuid atom) and image (JPEG/PNG)
containers without format branching, and is a direct match to the reference implementation.
exiftool-vendored.pl (the Linux Perl binary) installs automatically as an optional dependency on
the Vercel build environment. Both packages must be added to serverComponentsExternalPackages and
outputFileTracingIncludes in next.config.mjs, following the identical pattern already established
for ffmpeg-static and @ffmpeg-installer/ffmpeg.

**Core technologies (additions only):**
- exiftool-vendored@35.18.0: XMP write via Perl ExifTool -- only tool supporting custom namespace via -config; direct match to reference app
- exiftool-vendored.pl: Linux Perl binary, auto-installed as optional dep on Vercel build environment
- public/exiftool/.config: vendored XMP namespace definition -- 13-line Perl file from the reference app, must be included in outputFileTracingIncludes

**What NOT to add:** dayjs (use 3 lines of native JS for YYYY:MM:DD), sharp, exiv2,
fluent-ffmpeg for metadata -- all either inadequate for custom XMP namespaces or redundant.

### Expected Features

**Must have (table stakes) -- all 12 are in scope for v2.4:**
- TS-07: POST /api/assets/[id]/stamp-metadata route -- root of the entire feature tree
- TS-06: Atomic download -> stamp locally -> upload stamped (original GCS object never mutated)
- TS-03: stampedGcsPath + stampedAt on Asset Firestore doc
- TS-04: decorate() prefers stamped URL for guests, falls back to original
- TS-05: Internal /api/assets path unchanged -- stamp is guest-delivery-only
- TS-08: POST /api/review-links triggers stamps (sync <=3 assets, async 4+)
- TS-01/02: Exact .config namespace + all four required fields (FbId, ExtId, Created, Data)
- TS-09: Image support (JPEG/PNG) -- free, no format branching in exiftool
- TS-10: Stamp invalidation on rename (ExtId = filename sans extension, stale after rename)
- TS-11: Stamp invalidation on new version upload
- TS-12: "Applying metadata..." spinner in CreateReviewLinkModal

**Should have (add inside Phase A with negligible cost):**
- D-05: Freshness check dedup -- check isStampStale(asset) at route entry; 30 min inside TS-07
- D-02: Stamp status in FileInfoPanel -- stampedAt field already on doc; 1h of UI work

**Defer to v2.4.x / v2.5+:**
- D-04: Full async polling UI for large links (>3 assets) -- defer unless >3-asset links observed
- D-06: Concurrent stamp dedup via in-flight job check -- optimistic skip sufficient for now
- Per-project metaConfig (FbId, Company override) -- deferred by spec; add a TODO v2.5 comment

**Anti-features (explicitly avoid):**
- AF-02: Stamping the original GCS object in-place -- breaks internal/guest URL separation
- AF-04: Per-review-link stamp -- stamp content is deterministic from asset name + hardcoded constants
- AF-07: Video re-encoding to inject metadata -- exiftool writes XMP as a header operation only

### Architecture Approach

XMP stamping is structurally identical to the probe and generate-sprite jobs: download to /tmp,
spawn a binary, upload result, update asset doc, manage job lifecycle. The stamp result is
asset-scoped (projects/{projectId}/assets/{assetId}/stamped{ext}) -- one file shared across all
review links. decorate() in the review-link GET handler is the single integration point for guest
delivery: a two-line change routes guests to stampedGcsPath when fresh. The sync/async split
(<=3 inline, 4+ queued) is a named constant SYNC_STAMP_THRESHOLD = 3. Stamp invalidation uses
the stampedAt < updatedAt timestamp comparison -- self-healing, no explicit flag needed.

**Major components:**
1. src/app/api/assets/[assetId]/stamp-metadata/route.ts (NEW) -- download -> exiftool write -> upload -> update asset doc; ExifTool instance per request, et.end() in finally
2. src/lib/stamp-helpers.ts (NEW) -- isStampStale(asset) and buildStampedGcsPath(pid, aid, ext) -- pure helpers shared between route and decorate()
3. public/exiftool/.config (NEW) -- vendored XMP namespace definition; must appear in outputFileTracingIncludes
4. src/app/api/review-links/route.ts (MODIFIED) -- POST triggers stamp jobs after link doc is written; sync <= SYNC_STAMP_THRESHOLD, remainder queued
5. src/app/api/review-links/[token]/route.ts decorate() (MODIFIED) -- two-line stamp-aware path selection before existing GCS block
6. src/lib/jobs.ts (MODIFIED) -- add findOrCreateStampJob() and SYNC_STAMP_THRESHOLD = 3
7. src/types/index.ts (MODIFIED) -- add metadata-stamp to JobType; add stampedGcsPath?, stampedAt?, stampedSignedUrl?, stampedSignedUrlExpiresAt?, updatedAt? to Asset

### Critical Pitfalls

1. **exiftool binary missing at Vercel runtime** -- exiftool-vendored.pl is not auto-traced by @vercel/nft; add to outputFileTracingIncludes. Add both packages to serverComponentsExternalPackages. Verify vendored binary path resolves on cold start via existsSync() -- fail fast rather than hanging.

2. **-stay_open True / no et.end() in serverless** -- the reference desktop app keeps a persistent ExifTool process. In serverless, create a fresh ExifTool({ maxProcs: 1, maxTasksPerProcess: 1 }) per request and always await et.end() in finally. Skipping await causes zombie Perl processes and potential GCS upload corruption (Perl has not flushed the file before upload begins).

3. **uploadBuffer() causes OOM on large files** -- gcs.ts uploadBuffer() reads the full file into memory. For 500MB source videos, use streaming GCS upload. Add an uploadStream(gcsPath, localFilePath, contentType) helper to gcs.ts.

4. **Attrib array append semantics** -- always read existing Attrib before writing, normalize to array, spread existing entries with refreshed Data, then append the new entry. Writing only the new entry clobbers attribution history. Unit test: double-stamp same file -> Attrib.length === 2.

5. **Timestamp type mismatch in invalidation check** -- stampedAt is a Firestore Timestamp; updatedAt may be an ISO string. Use coerceToDate() from src/lib/format-date.ts at every comparison site. Direct < / > comparison silently produces wrong booleans.

6. **MP4 faststart destroyed by exiftool atom rewrite** -- exiftool in-place MP4 XMP write can move moov after mdat, breaking browser progressive playback. Run ffmpeg -c copy -movflags +faststart as a post-stamp pass on MP4/MOV files before GCS upload.

7. **Perl availability on Vercel Lambda** -- ignoreShebang auto-detection handles missing /usr/bin/perl via which perl, but if Perl is entirely absent, the spawn fails. Test a real Vercel deploy before Phase A is complete.

---

## Implications for Roadmap

Based on combined research, the feature has a clear four-phase dependency chain. Every later phase
depends on the stamp pipeline being correct and independently testable first.

### Phase A: Stamp Pipeline Standalone

**Rationale:** TS-07 is the root of the dependency tree. Building it standalone lets you verify XMP
correctness, GCS round-trip, and Perl availability on Vercel before touching any existing routes.
Failure here is cheap; failure discovered in Phase B costs a full review-link rewrite.

**Delivers:** POST /api/assets/[id]/stamp-metadata works end-to-end. Verifies Perl on Vercel.
Validates XMP output against a file already stamped by the desktop reference app.

**Addresses:** TS-07, TS-06, TS-03, TS-01, TS-02, TS-09, D-05 (freshness check, trivially added here)

**Avoids:** Pitfalls 1 (binary missing), 2 (-stay_open), 3 (et.end() not awaited), 4 (Attrib append), 6 (MP4 faststart), 8 (config namespace mismatch), 9 (/tmp exhaustion)

**Must resolve before starting:** Is updatedAt reliably written on rename and upload-complete?
Check PUT /api/assets/[assetId] and /api/upload/complete -- add FieldValue.serverTimestamp() if absent.

### Phase B: Review-Link Integration

**Rationale:** Phase A's stampedGcsPath field is the prerequisite. The decorate() change is two
lines once the field exists. The review-link POST trigger is where the sync/async split matters.

**Delivers:** Creating a review link stamps included assets. Guests receive stamped URLs.
decorate() falls back gracefully if stamp is missing or stale.

**Addresses:** TS-04, TS-05, TS-08, TS-12

**Avoids:** Pitfall 5 (concurrent stamp race -- findOrCreateStampJob lives here), Pitfall 15 (blocking POST)

**Conflict to resolve:** ARCHITECTURE recommends SYNC_STAMP_THRESHOLD = 3 inline. PITFALLS argues
even 1 large-file stamp can block for 30s+. **Recommended resolution: implement fully async for all
counts in Phase B (post-201 return with pendingStampJobIds). Raise the threshold for sync only
after real Vercel timing data is available.**

### Phase C: UI Feedback

**Rationale:** Depends on Phase B's pendingStampJobIds in the 201 response. UI changes are purely
additive -- no API changes required.

**Delivers:** CreateReviewLinkModal shows "Applying metadata..." and transitions cleanly. Guest
download button disabled while stamp is pending. "Meta-stamped" badge on review-link page.

**Addresses:** TS-12, D-01, D-02

**Avoids:** Pitfall 16 (download before stamp -- disable button while stampingStatus pending),
Pitfall 17 (spinner lies after failure -- must handle status:failed transition to error state
with fallback download enabled)

### Phase D: Invalidation + Cleanup

**Rationale:** Can run in parallel with Phase C. Rename and version-upload invalidation are
one-liner writes. Old stamped GCS file cleanup depends on Phase A's buildStampedGcsPath.

**Delivers:** Stale stamps auto-invalidate on rename and version upload. Old stamped GCS objects
deleted on re-stamp. Asset hard-delete removes stampedGcsPath GCS object.

**Addresses:** TS-10, TS-11

**Avoids:** Pitfall 13 (orphaned GCS files on rename), Pitfall 14 (timestamp type mismatch --
coerceToDate() at every comparison site)

### Phase Ordering Rationale

- Phase A before B: stamp route is the only integration point decorate() depends on. Cannot modify decorate() safely until the upstream data model is proven.
- Phase B before C: UI polling requires pendingStampJobIds in the POST response, which Phase B defines.
- Phase D parallel with C: invalidation writes are independent of UI; shares updatedAt verification work from Phase A.
- Sync threshold: start fully async; do not bake N=3 into logic before measuring real Vercel execution times.

### Research Flags

Phases needing pre-build verification spikes (not full research sprints):

- **Phase A -- Perl on Vercel:** Deploy a one-route spike (et.version() call) before writing stamp logic. Gate Phase A completion on a passing result. If Perl is absent, requires a different runtime strategy (Cloud Run, custom Vercel builder with pre-compiled exiftool).
- **Phase A -- updatedAt field coverage:** Read rename and upload-complete handlers; confirms or fixes the prerequisite for Phase D.
- **Phase A -- et.write() -config as extra arg:** Verify et.write(path, tags, ['-overwrite_original', '-config', configPath]) with a live test.
- **Phase A -- Data field pipe characters:** Confirm exact value against a file already stamped by the desktop app using exiftool -Attrib:all.

Phases with standard patterns (skip research-phase):
- **Phase B decorate() change:** Two lines against an already-proven field; standard signed-URL cache pattern.
- **Phase C UI spinner:** Existing loading state in CreateReviewLinkModal; same polling pattern as probe/sprite job status.
- **Phase D invalidation writes:** One-liner FieldValue.serverTimestamp() writes on existing paths.

---

## Cross-Cutting Findings (Every Phase Must Know)

These conclusions recur across all four research files and apply to every phase:

1. **Stamp is asset-level, not link-level.** One stamped GCS file per asset. decorate() reads stampedGcsPath from the asset doc -- not the review link doc. Avoid any design that stores stamp state per review link.

2. **ExifTool is per-request, et.end() always awaited.** new ExifTool({ maxProcs: 1, maxTasksPerProcess: 1 }) inside the route handler. await et.end() in finally. Never a module-scope singleton. Never -stay_open True in serverless.

3. **Streaming GCS I/O for large files.** Download: downloadToFile() already streams to /tmp. Upload: must use a new uploadStream() helper -- uploadBuffer() will OOM on 500MB+ source files.

4. **updatedAt is the invalidation clock.** If not reliably written on all asset mutation paths today, fix that first. The entire stamp invalidation model depends on it.

5. **Attrib array: read first, normalize, spread, append.** Never write a single-entry Attrib array without reading the existing one first.

6. **coerceToDate() at every timestamp comparison.** Always use coerceToDate() from src/lib/format-date.ts -- raw < / > between Firestore Timestamps and ISO strings silently produces wrong booleans.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack (exiftool-vendored) | HIGH | Direct match to reference; version and bundle size verified from npm registry |
| next.config.mjs changes | HIGH | Identical pattern working in production for ffmpeg packages |
| Subprocess lifecycle (et.end()) | HIGH | CHANGELOG v35.0.0 confirms unreferenced stdio; per-request pattern confirmed |
| GCS download/upload pattern | HIGH | downloadToFile confirmed; upload streaming gap identified and documented |
| Job infrastructure fit | HIGH | jobs.ts interface is generic; JobType extension is one line |
| Signed-URL cache integration | HIGH | getOrCreateSignedUrl is format-agnostic; confirmed with thumbnail and sprite |
| XMP schema correctness | HIGH | .config and exiftool.js read directly from scf-meta install |
| Attrib append logic | HIGH | Reference exiftool.js read in full; spread pattern confirmed |
| decorate() integration point | HIGH | review-links/[token]/route.ts read in full; change is two lines |
| Feature scope | HIGH | Codebase-verified; anti-features backed by concrete failure modes |
| Sync/async threshold (N=3) | MEDIUM | Architecture says 3; pitfalls says 0 -- resolve by measuring on Vercel |
| MP4 faststart preservation | MEDIUM | Documented exiftool behavior; version-dependent; needs post-stamp ffprobe check |
| et.write() -config as extra arg | MEDIUM | Inferred from API shape; needs live verification |
| Data field pipe characters | MEDIUM | Value seen in source; needs verification against an already-stamped file |
| updatedAt field reliability | LOW | Not verified on rename and upload-complete paths |
| Perl on Vercel Lambda | LOW | ignoreShebang mitigates but does not eliminate risk; requires deploy test |

**Overall confidence:** HIGH for the pipeline design; LOW on two runtime environment questions that
must be verified before Phase A is complete.

### Gaps to Address

- **Perl on Vercel:** Deploy a minimal spike (et.version()) before writing stamp logic. If Perl is absent, requires a different runtime strategy (Cloud Run, custom Vercel builder with pre-compiled exiftool).
- **updatedAt field coverage:** Read PUT /api/assets/[assetId] (rename) and POST /api/upload/complete. This is a Phase A gate, not a Phase D concern.
- **Sync vs. async threshold:** Implement fully async in Phase B; measure actual Vercel stamp times before raising threshold from 0.
- **Data field format:** Run exiftool -Attrib:all on a file stamped by the desktop app to confirm whether pipe characters in the Data value are literal or an exiftool struct delimiter.

---

## Sources

### Primary (HIGH confidence)
- scf-meta app-0.11.9 src/backend/exiftool.js -- reference Attrib append logic, field constants, -config, ExtId computation
- scf-meta app-0.11.9 public/exiftool/.config -- XMP namespace URI, struct definition, field types
- src/app/api/assets/[assetId]/generate-sprite/route.ts -- streaming GCS download, binary resolution, tmp cleanup, job pattern
- src/app/api/review-links/[token]/route.ts -- decorate() function, signed-URL cache, flushUrlWrites pattern
- src/lib/gcs.ts -- downloadToFile, uploadBuffer (OOM limitation confirmed), generateReadSignedUrl
- src/lib/jobs.ts -- createJob/updateJob/sweepStaleJobs; JobType union
- src/lib/signed-url-cache.ts -- getOrCreateSignedUrl interface
- src/lib/format-date.ts -- coerceToDate (Timestamp vs ISO string)
- next.config.mjs -- existing outputFileTracingIncludes and serverComponentsExternalPackages patterns
- src/types/index.ts -- Asset, Job, JobType, ReviewLink types
- npm view exiftool-vendored / npm view exiftool-vendored.pl -- version, size, platform packaging (verified 2026-04-23)
- exiftool-vendored CHANGELOG v35.0.0 -- unreferenced stdio, natural process exit
- exiftool-vendored CHANGELOG v8.17.0 -- ignoreShebang auto-detection for Lambda

### Secondary (MEDIUM confidence)
- Vercel KB: 250MB uncompressed Lambda bundle limit
- Vercel docs: Amazon Linux 2023 build image
- exiftool documentation: MP4 atom rewriting behavior, faststart impact
- exiftool FAQ: JPEG APP1 segment XMP/EXIF interleaving
- github.com/photostructure/exiftool-vendored.js/issues/101 -- Lambda compatibility discussion

### Tertiary (LOW confidence -- needs verification)
- Perl availability in Vercel Pro Node.js Lambda runtime -- no confirmed test
- SYNC_STAMP_THRESHOLD = 3 timing assumption -- based on estimated benchmarks, not measured on Vercel

---

*Research completed: 2026-04-23*
*Ready for roadmap: yes*
