# Feature Research — v2.4 Meta XMP Attribution Stamping

**Domain:** Ad-delivery / creative-review platform — server-side metadata stamping on delivery
**Researched:** 2026-04-23
**Confidence:** HIGH (codebase verified + reference app read) / MEDIUM (Meta XMP spec + ad-delivery industry patterns)

---

## Context

v2.4 adds one pipeline capability: when a review link is created, every asset it includes gets
stamped with the Meta-required XMP attribution schema
(`http://ns.attribution.com/ads/1.0/`) using the same exiftool `.config` and field values
that the `scf-metadata` Electron desktop app uses. The stamped file is stored separately in GCS
and served only to review-link guests via the existing `decorate()` pipeline. Internal viewers
keep the original.

Reference source confirmed at
`C:\Users\Lola\AppData\Local\scf-meta\app-0.11.9\resources\app\src\backend\exiftool.js`:
- Reads existing `Attrib` tags, re-stamps `Data` on each, then **appends** one new entry
- Fields per entry: `ExtId` (filename sans extension), `Created` (YYYY:MM:DD), `Data`
  (`|{"Company":"Ready Set"|}` — pipe-wrapped JSON), `FbId` (2955517117817270)
- Uses `-overwrite_original` (in-place write, no temp file side copy)
- `.config` defines namespace `Attrib` → `http://ns.attribution.com/ads/1.0/`, struct `Ads`
  as a `Seq` (ordered array). Fields: `FbId` (integer), `ExtId` (string), `Data` (string),
  `Created` (date), `TouchType` (integer), `Mark` (string)

---

## Table Stakes (Users Expect These)

Features a platform like this must have for Meta ad-delivery stamping to be production-usable.
Missing any of these makes the stamp unreliable or the workflow broken.

| # | Feature | Why Expected | Complexity | Dependencies | Justification |
|---|---------|--------------|------------|--------------|---------------|
| TS-01 | **XMP namespace correctness** — stamp uses the exact `.config` that defines `Attrib → http://ns.attribution.com/ads/1.0/` with the `Ads` Seq struct | Meta's validator reads the namespace URI literally; a wrong prefix or URI causes silent attribution failure | S | exiftool-vendored + `.config` file vendored into project | Without this the stamp is syntactically invalid for Meta's ad delivery system |
| TS-02 | **Four required fields per entry** — every stamped `Attrib` struct contains `FbId`, `ExtId`, `Data`, `Created`; no missing fields | The desktop app always writes all four; Meta requires all four to credit the ad | S | Reads from hardcoded constants + asset filename + today's date | The `.config` marks `TouchType` and `Mark` as writable but the reference app never sets them; match the reference exactly |
| TS-03 | **Per-asset `stampedGcsPath` + `stampedAt` on Firestore doc** — stamped file stored at a distinct GCS path (e.g. `stamped/{assetId}/{filename}`); timestamp recorded | Without a separate path, the stamp would overwrite the original, breaking internal viewer comments/versioning that reference the original | S | GCS upload; Firestore Asset doc update | Core isolation requirement: internal viewer = original, guest delivery = stamped |
| TS-04 | **`decorate()` prefers stamped URL for guests** — review-link GET reads `stampedGcsPath` when present and substitutes it as `signedUrl` + `downloadUrl`; falls back to original if absent | Guests must always receive the stamped version, never the unprocessed original | S | Existing `decorate()` in `/api/review-links/[token]/route.ts` | Single-point integration; the decorate pipeline is the only place guest URLs are constructed |
| TS-05 | **Internal `/api/assets` path keeps original** — the authenticated asset endpoint never returns `stampedGcsPath` as the primary URL | If internal users saw the stamped file, annotation coordinates and version-diff comparisons could drift | S | Existing `/api/assets/route.ts` | No change to internal path; stamp is guest-delivery-only |
| TS-06 | **Atomic file write + GCS upload** — exiftool writes to a temp copy, then the stamped file is uploaded to GCS; the original GCS object is never mutated | `-overwrite_original` is safe only on local disk; GCS objects are immutable blobs. Download → stamp locally → upload stamped → delete temp | M | GCS download + upload; `os.tmpdir()` temp file lifecycle | Failure mid-write must leave the original untouched; no partial-stamp state in GCS |
| TS-07 | **`POST /api/assets/[id]/stamp-metadata` route** following the probe/sprite pattern — creates a `metadata-stamp` job, runs sync, updates Firestore | Consistent with the existing jobs infrastructure; gives UI + retry the same hooks as probe/sprite | M | `src/lib/jobs.ts`; `JobType` extended to include `'metadata-stamp'` | Reuses sweepStaleJobs, retry, observability — no new infra needed |
| TS-08 | **`POST /api/review-links` triggers stamps for included assets** — sync for ≤3 assets (awaited before 201 response), async polling for 4+ | Small links (1-3 assets, the common case) feel instant; large links don't time out the HTTP request | M | `stamp-metadata` route; Vercel 60s function timeout | Matches the probe/sprite trigger pattern from upload/complete |
| TS-09 | **Image support (JPEG, PNG, etc.) via same pipeline** — exiftool writes XMP sidecar-style into JPEG/PNG containers natively; same `.config` applies | Meta requires the same attribution schema on static image ads as on video; the reference app handles images and videos identically | S | exiftool-vendored handles all common formats; no format branching needed | exiftool is format-agnostic for XMP writes; the stamp route does not need to special-case images vs videos |
| TS-10 | **Stamp invalidation on rename** — when an asset is renamed, `stampedGcsPath` and `stampedAt` are cleared so the next review-link delivery re-stamps with the new `ExtId` | `ExtId` is the filename sans extension; a renamed file produces a stale stamp with the wrong identifier | S | `PATCH /api/assets/[id]` rename path | One-liner: clear the two fields on rename; next review-link create re-stamps |
| TS-11 | **Stamp invalidation on new version upload** — when a new version is uploaded into a stack, the version group's cached stamp is cleared | A new version has a new `gcsPath`; serving the old stamped file for the new version would be wrong | S | `upload/complete` or `merge-version` paths | Same pattern as `signedUrlExpiresAt` cache invalidation already in the codebase |
| TS-12 | **`"Applying metadata..."` UX in `CreateReviewLinkModal`** — the modal shows a progress indication while stamps are running (sync path ≤3), then shows the copy-link view | Without feedback, users assume the button is broken during the ~2-4s exiftool run | S | Existing `loading` state in `CreateReviewLinkModal` | Extend the existing `loading` spinner with a status string; no new component needed |

---

## Differentiators (Nice-to-Have, Not Required)

Features that improve the workflow or observability but are not needed for correct stamping.

| # | Feature | Value Proposition | Complexity | Dependencies | Justification |
|---|---------|-------------------|------------|--------------|---------------|
| D-01 | **"Meta-stamped" badge per asset on review-link page** — small indicator on `AssetCard` in the guest view showing the stamp was applied | Gives clients confidence the deliverable is attribution-ready; differentiates from a raw file share | S | `stampedAt` field on asset; review page `AssetCard` | Purely additive; `decorate()` already knows which assets have stamps |
| D-02 | **Stamp status visible in internal asset Info tab** — `FileInfoPanel` shows "Meta stamp: Applied YYYY-MM-DD" or "Not stamped" | Internal team can confirm stamp state without creating a test review link | S | `stampedAt` on Asset type; `FileInfoPanel.tsx` | Useful for QA; low implementation cost |
| D-03 | **Manual re-stamp trigger** — a "Re-apply metadata" button in the asset viewer or context menu that calls `POST /api/assets/[id]/stamp-metadata` directly | Lets the team force a fresh stamp after a rename without waiting for the next review link creation | S | `stamp-metadata` route; existing job-retry UI pattern | Same pattern as the existing "Probe" button in `FileInfoPanel` |
| D-04 | **Async stamp with polling for large links (4+ assets)** — `POST /api/review-links` fires stamp jobs without awaiting, returns the link immediately; UI polls job status and shows "Stamping X of N assets…" with a count | Large review links (10-50 assets) would otherwise hit Vercel's 60s function timeout on the sync path | M | Job polling (exists via `GET /api/assets/[id]/jobs`); UI polling loop | Already designed into the v2.4 spec; critical for links with many assets |
| D-05 | **Per-asset stamp deduplication via `stampedAt` freshness check** — `stamp-metadata` route checks whether the asset already has a valid stamp (same filename, same day) before running exiftool; skips if fresh | Prevents re-stamping the same asset when it appears in multiple review links created close together | S | `stampedAt` + `name` fields on Asset doc | Simple freshness gate in the route handler; saves ~2-4s per already-stamped asset |
| D-06 | **Concurrent review-link stamp deduplication** — if two review links are created simultaneously for the same asset, the second stamp job checks for an in-flight job on the same asset and skips rather than racing | Two exiftool processes writing to the same GCS path simultaneously would corrupt the output | M | `jobs` collection query for in-flight `metadata-stamp` on same `assetId`; optimistic skip | Query `jobs` where `assetId == X AND type == 'metadata-stamp' AND status == 'running'`; if found, skip and poll instead |

---

## Anti-Features (Avoid These)

Features that seem appealing but create real problems for this milestone.

| # | Anti-Feature | Why Requested | Why Problematic | Correct Alternative |
|---|--------------|---------------|-----------------|---------------------|
| AF-01 | **Inline exiftool in the `POST /api/review-links` request body (blocking UX)** | "Just stamp before saving the link" — simple mental model | The exiftool run takes 2-4s per asset; a 10-asset link blocks the HTTP response for 20-40s, guaranteed Vercel timeout. The user sees a spinner then a 504. | Sync only for ≤3 assets; async job queue for 4+ (TS-08 + D-04). The link is created immediately; stamps run in background. |
| AF-02 | **Stamping the original GCS object in-place** | "Only one file to track" | GCS objects are effectively immutable; overwriting requires delete + re-upload which can race with in-flight signed URLs. More critically, the internal viewer must see the unstamped original — the stamp is a guest-delivery concern only. Overwriting breaks that separation. | Write stamped file to a distinct `stampedGcsPath` (TS-03). Original is never touched. |
| AF-03 | **Client-side stamping (in the browser)** | "No server needed; Web Workers can run WASM" | exiftool-vendored is a 30MB Node.js binary with a Perl runtime; there is no WASM port. Even if there were, exposing the Facebook Business ID + Company constants client-side is a security concern. | Server-side only via the `stamp-metadata` route (TS-07). |
| AF-04 | **Per-review-link per-asset stamp (new stamped file per link)** | "Each link could have different metadata someday" | The stamp fields (`FbId`, `Data`, `Created`, `ExtId`) are all constants or asset-level properties — none are review-link-specific. Creating N stamped files for N review links wastes GCS storage and stamping time proportionally. | One stamped file per asset, shared across all review links. Invalidated only when the asset-level inputs change (rename, new version). |
| AF-05 | **Re-stamping after every download** | "Ensures Created is always today's date" | `Created` is the stamp date, not the download date. The reference app stamps once at delivery prep time, not per-download. Re-stamping per download is the per-review-link pattern (AF-04) in a worse form — it would fire exiftool on every guest click of "Download." | Stamp once per asset (or once per rename/version). `Created` reflects when the stamp was applied, which is correct. |
| AF-06 | **FbId / Company override UI per-project or per-asset in v2.4** | "Different clients might have different Facebook IDs" | The v2.4 spec explicitly hardcodes `FB_ID=2955517117817270` and `DATA='{"Company":"Ready Set"}'`. Building a per-project config UI requires a `project.metaConfig` schema, form UI, validation, and migration. This is a v2.5+ concern. | Hardcode in v2.4 as documented. Add a `// TODO v2.5: move to project.metaConfig` comment in the stamp route. |
| AF-07 | **Video re-encoding to inject metadata** | "Some platforms require metadata in the container, not XMP sidecar" | Meta's attribution schema is XMP — a sidecar embedded in the file header, not a container-level flag. exiftool writes XMP without touching the video stream. Re-encoding would change quality, take 10-60x longer, change the file hash, and break the identical-to-original guarantee. | exiftool XMP write only. No ffmpeg in the stamp pipeline (TS-01). |
| AF-08 | **Stamp audit log (separate Firestore collection)** | "Compliance requires a record of every stamp event" | The existing `jobs` collection already records every `metadata-stamp` job with `createdAt`, `status`, `assetId`, `userId`. A separate audit log duplicates this. | The `jobs` collection IS the audit log. If a human-readable stamp history is needed, query `jobs` filtered by `type == 'metadata-stamp'`. |

---

## Feature Dependencies

```
TS-07 (stamp-metadata route)
    └──required by──> TS-08 (review-link trigger)
    └──required by──> D-03 (manual re-stamp button)
    └──required by──> D-04 (async polling for large links)

TS-03 (stampedGcsPath on Asset)
    └──required by──> TS-04 (decorate() prefers stamp)
    └──required by──> D-01 (Meta-stamped badge)
    └──required by──> D-02 (stamp status in Info tab)
    └──required by──> D-05 (freshness check dedup)

TS-06 (atomic file write)
    └──required by──> TS-07 (stamp route implementation detail)

TS-08 (review-link trigger)
    └──required by──> TS-12 (UX spinner in CreateReviewLinkModal)

D-05 (freshness check dedup)
    └──enhances──> D-06 (concurrent dedup — D-05 handles the "already done" case, D-06 handles the "in progress" case)

TS-10 (invalidation on rename) ──independent──> TS-03
TS-11 (invalidation on new version) ──independent──> TS-03
```

### Dependency Notes

- **TS-07 is the root of the tree.** Everything else builds on the `stamp-metadata` route.
- **TS-03 and TS-04 are tightly coupled** — the GCS path field on the asset doc is what `decorate()` reads to decide which URL to serve guests.
- **TS-06 must be implemented inside TS-07** — it is not a separate feature but a correctness property of the route implementation.
- **D-05 and D-06 are both optional** but D-05 (freshness check) is trivially cheap to add inside TS-07 and prevents redundant work from the first day.

---

## Caching Strategy (answers Q2)

**Stamp once per asset, cache on the asset doc, serve from cache.**

The stamp is deterministic given: (filename, FbId, Data, date-of-first-stamp). `ExtId` = filename sans extension — stable until rename. `Created` = date of stamping, not date of download. `FbId` and `Data` are hardcoded constants. Therefore:

- Stamp on first review-link creation that includes the asset
- Cache `stampedGcsPath` and `stampedAt` on the asset Firestore doc
- Subsequent review links for the same asset skip the exiftool run — `decorate()` just signs the cached `stampedGcsPath`
- Invalidate (clear `stampedGcsPath` + `stampedAt`) only on: rename (ExtId changes), new version upload (new file), or explicit manual re-stamp (D-03)

**Do NOT stamp per review-link, per delivery, or per download** — see AF-04 and AF-05.

---

## UX During Stamping (answers Q4)

**Pattern established by probe/sprite pipeline (same approach):**

- Sync path (≤3 assets): `CreateReviewLinkModal` enters `loading=true`, button shows spinner. The POST awaits stamp completion before returning 201. After success, the modal transitions to the copy-link view. Label during loading: "Applying metadata…" (or "Creating link…" with a count like "Stamping 2 of 3"). Total time: ~4-10s for 3 assets.
- Async path (4+ assets): POST returns 201 immediately after creating the link. Modal shows copy-link view with a banner "Metadata is being applied to X assets in the background." No email notification — the link is already usable (it will serve original URLs until stamps complete; decorate() falls back gracefully).
- Guest experience: guest loads the review link after stamps complete and receives stamped URLs. If stamps are still running (rare edge case for very large links), they receive original URLs — the fallback in decorate() is correct.

**Silent fire-and-forget is an anti-pattern here** because the team needs to know stamps were applied before sharing the link, especially for the 1-3 asset case.

---

## Image vs Video (answers Q7)

**Same schema, same pipeline, no branching required.**

- Meta's XMP attribution schema (`http://ns.attribution.com/ads/1.0/`) applies to both static image ads and video ads. The `.config` defines an XMP struct — XMP is a container-agnostic standard that exiftool writes into JPEG, PNG, MP4, MOV, and other formats identically.
- The reference Electron app (`exiftool.js`) does not check `mimeType` or file type before calling `this.exiftool.write()` — it operates on any file.
- exiftool-vendored handles JPEG, PNG, WebP, TIFF, MP4, MOV, MXF natively without format-specific code.
- The `stamp-metadata` route should not branch on `asset.type`. The same code path works for video and image.
- **One known image-specific consideration:** JPEG/PNG files produced by the stamp have no audio stream to worry about, so there is no risk of accidentally re-encoding audio. The stamp is purely a header operation for both formats.

---

## Concurrent Review Links (answers Q8)

**Optimistic skip with job-in-flight check (D-06).**

If two review links are created simultaneously for the same asset:

1. Both `POST /api/review-links` handlers attempt to trigger `stamp-metadata` for the same `assetId`.
2. The `stamp-metadata` route, before starting, queries the `jobs` collection for any `{type: 'metadata-stamp', assetId: X, status: 'running'}` doc.
3. If one is found, the second call skips the exiftool run and returns a "already in progress" response. The review link creation still succeeds — it polls the existing job.
4. When the first job completes and writes `stampedGcsPath`, both review links benefit from the same cached result on next `decorate()`.

**No distributed lock is needed.** The `jobs` collection + a pre-flight query is sufficient for the concurrency level expected (at most a handful of simultaneous review-link creates for the same asset). Firestore is the coordination point; no Redis or Cloud Tasks required.

---

## MVP Definition

### Launch With (v2.4)

All Table Stakes items. These are the minimum for the feature to be correct and usable:

- [x] TS-01 XMP namespace correctness (`.config` vendored)
- [x] TS-02 Four required fields per stamp entry
- [x] TS-03 `stampedGcsPath` + `stampedAt` on Asset doc
- [x] TS-04 `decorate()` prefers stamped URL for guests
- [x] TS-05 Internal `/api/assets` path unaffected
- [x] TS-06 Atomic download → stamp locally → upload to GCS
- [x] TS-07 `POST /api/assets/[id]/stamp-metadata` route
- [x] TS-08 `POST /api/review-links` triggers stamps (sync ≤3, async 4+)
- [x] TS-09 Image support (JPEG/PNG) — no extra work, just don't exclude non-video types
- [x] TS-10 Invalidation on rename
- [x] TS-11 Invalidation on new version upload
- [x] TS-12 "Applying metadata…" spinner in `CreateReviewLinkModal`

### Add After Validation (v2.4 bonus or v2.4.x)

- [ ] D-01 "Meta-stamped" badge on review page — 1-2h; confirm team wants it before adding
- [ ] D-02 Stamp status in Info tab — 1h; useful for internal QA
- [ ] D-03 Manual re-stamp button — 1h; useful if rename-then-reshare is common
- [ ] D-05 Freshness check dedup — 30min; add inside TS-07 from day one to prevent redundant work

### Future Consideration (v2.5+)

- [ ] D-04 Full async polling UI for large links — defer unless test shows >3-asset links are common in practice
- [ ] D-06 Concurrent dedup via in-flight job check — defer unless concurrent link creation is observed in practice
- [ ] Per-project `metaConfig` (FbId, Company) override — deferred by spec; add a code comment marking the hardcoded constants

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| TS-07 stamp-metadata route | HIGH | MEDIUM | P1 |
| TS-08 review-link trigger | HIGH | MEDIUM | P1 |
| TS-03 stampedGcsPath on doc | HIGH | LOW | P1 |
| TS-04 decorate() stamp preference | HIGH | LOW | P1 |
| TS-06 atomic file write | HIGH | MEDIUM | P1 |
| TS-10 rename invalidation | HIGH | LOW | P1 |
| TS-11 version invalidation | HIGH | LOW | P1 |
| TS-12 spinner UX | MEDIUM | LOW | P1 |
| TS-01/02/09 namespace + fields + images | HIGH | LOW | P1 (correctness) |
| TS-05 internal path unchanged | HIGH | LOW | P1 (correctness by omission) |
| D-05 freshness check dedup | MEDIUM | LOW | P2 (add inside TS-07) |
| D-01 Meta-stamped badge | LOW | LOW | P2 |
| D-02 stamp status in Info tab | LOW | LOW | P2 |
| D-03 manual re-stamp button | LOW | LOW | P2 |
| D-04 async polling for large links | MEDIUM | MEDIUM | P3 |
| D-06 concurrent dedup | LOW | MEDIUM | P3 |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| XMP schema correctness | HIGH | Read `.config` directly from reference app; confirmed namespace, struct name, field names, types |
| exiftool write behavior | HIGH | Read `exiftool.js` from reference app; confirmed append-not-replace logic, `-overwrite_original`, field population |
| GCS isolation pattern | HIGH | Codebase read — `stampedGcsPath` pattern mirrors `spriteStripGcsPath`; decorate() pipeline verified |
| Job infrastructure fit | HIGH | Read `src/lib/jobs.ts`; `JobType` union; `createJob`/`updateJob`/`sweepStaleJobs` all confirmed |
| Meta image vs video parity | MEDIUM | exiftool format-agnosticism is well-documented; Meta's XMP requirement for images is inferred from their ad spec (not directly verified against their current developer docs) |
| Concurrency handling | MEDIUM | Firestore-as-coordinator is a sound pattern; actual concurrency frequency in this app is low, reducing risk |
| Vercel timeout math | MEDIUM | 60s limit confirmed; 2-4s per exiftool call estimated from exiftool-vendored benchmarks (not measured on Vercel) |

---

## Sources

- Reference app source: `C:\Users\Lola\AppData\Local\scf-meta\app-0.11.9\resources\app\src\backend\exiftool.js` — write logic, field names, constants
- Reference app config: `C:\Users\Lola\AppData\Local\scf-meta\app-0.11.9\resources\app\public\exiftool\.config` — XMP namespace, struct definition
- Codebase: `src/lib/jobs.ts` — job lifecycle, JobType union, sweepStaleJobs
- Codebase: `src/app/api/review-links/[token]/route.ts` — decorate() pipeline, signed URL cache, pendingUrlWrites pattern
- Codebase: `src/app/api/review-links/route.ts` — POST create flow, assetIds handling
- Codebase: `src/types/index.ts` — Asset, ReviewLink, JobType types
- Codebase: `src/app/api/assets/[assetId]/probe/route.ts` — reference for route structure (job create → run → update)
- Codebase: `.planning/PROJECT.md` — v2.4 spec, constants, Vercel bundle ceiling, GCS signed-URL cache pattern
