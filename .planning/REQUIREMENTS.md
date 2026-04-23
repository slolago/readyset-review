# Requirements: readyset-review

**Defined:** 2026-04-23 (v2.4 — Meta XMP stamping on delivery)
**Core Value:** Fast, accurate video review — frame-level precision, rich metadata, and fluid version management without leaving the browser.

## v2.4 Requirements

Automatic Meta XMP attribution stamping (`http://ns.attribution.com/ads/1.0/`) on every asset delivered through a review link. Replicates 1:1 the behavior of the `scf-metadata` desktop app via server-side `exiftool-vendored`. Stamped file is cached on the asset, invalidated on rename / new version, and served only to review-link guests. Internal viewer keeps the original for consistency with comments, versioning, and annotations. Hardcoded constants (FbId=2955517117817270, Data='{"Company":"Ready Set"}') — same as the desktop app.

### Stamp Pipeline

Core stamping behavior — what "the stamp" means from the user's perspective.

- [ ] **STAMP-01**: Every asset included in a review link is XMP-stamped with the four Meta attribution fields (`Attrib:FbId` = 2955517117817270, `Attrib:Data` = `'{"Company":"Ready Set"}'`, `Attrib:ExtId` = filename without extension, `Attrib:Created` = today's date `YYYY:MM:DD`) before the guest can preview or download it.
- [ ] **STAMP-02**: Stamping preserves any existing `Attrib:Ads` entries on the asset (re-stamps their `Data` and appends one new entry) — never clobbers prior stamp history. Same append semantics as the reference `scf-metadata` Electron app.
- [ ] **STAMP-03**: Stamp works identically for video (MP4) and image (JPEG / PNG / WebP / etc.) assets — no format-specific branching. `exiftool-vendored` writes XMP into every supported container through the same API.
- [ ] **STAMP-04**: Stamped file is cached on the asset Firestore doc (`stampedGcsPath`, `stampedAt`) so multiple review links for the same asset share one stamped GCS copy — no redundant exiftool runs, no per-link duplication.
- [ ] **STAMP-05**: Guests always receive the stamped version (`signedUrl`, `downloadUrl`, thumbnail preview); the authenticated internal viewer (`/api/assets`) always receives the original — never the stamped file. Comments, annotations, and version comparison continue operating on the original.

### Invalidation

When the stamped file goes stale, the system re-stamps on next delivery.

- [ ] **STAMP-06**: Renaming an asset invalidates its stamp (`stampedGcsPath` cleared); the next review link creation that includes the asset re-stamps with the new `ExtId`.
- [ ] **STAMP-07**: Uploading a new version into a stack invalidates the prior stamp on the new version's asset doc; the next review link creation that includes the new version stamps it fresh. Other versions in the stack are unaffected.

### Reliability

Graceful behavior under failure, concurrency, and load.

- [ ] **STAMP-08**: Stamp failure on one asset never blocks review link creation — the link is created immediately; the guest's `decorate()` falls back to the original URL for any asset without a ready stamp. UI surfaces stamp status via the existing jobs collection.
- [ ] **STAMP-09**: Review link creation does not block on stamping — the POST response returns as soon as the link row is written; stamp jobs run asynchronously via the existing `jobs` collection. Fully async regardless of asset count (no arbitrary sync/async split threshold that risks the Vercel 60s timeout).
- [ ] **STAMP-10**: Concurrent review-link creation for the same asset triggers exactly one stamp job — the second request finds the in-flight `metadata-stamp` job on that `assetId` and skips rather than racing (Firestore-transaction-backed pre-flight check inside the stamp route).
- [ ] **STAMP-11**: The `Created` field reflects the configured project timezone (or a documented fallback like America/Los_Angeles), not Lambda UTC — so an evening delivery doesn't produce a date one day ahead of the user's local day.

### UX

User-visible feedback during the async stamp process.

- [ ] **STAMP-12**: The user sees an "Applying metadata…" status in `CreateReviewLinkModal` while stamp jobs are running; the modal transitions to the copy-link view once the link is created (stamps continue in the background; the guest experience gracefully falls back to the original URL until stamps complete).

### Deployment

Platform-level risks confirmed resolved before v2.4 ships.

- [ ] **STAMP-13**: Platform spike items resolved (all three must pass before the core stamp pipeline is declared complete): (a) `exiftool-vendored@35.18.0` runs on Vercel Pro Lambda — perl binary resolves, binary trace in `next.config.mjs` works end-to-end verified via a real deploy; (b) `updatedAt: FieldValue.serverTimestamp()` is written on both the rename handler (`PUT /api/assets/[assetId]`) and the new-version-upload handler (`/api/upload/complete`) — verified by code read + integration test; (c) the reference app's `Data` field literal value (pipe-wrapped `'|{"Company":"Ready Set"|}'` vs plain `'{"Company":"Ready Set"}'`) confirmed against a stamped output file.

## Future Requirements (Deferred from v2.4)

Not in this milestone. Add to the next requirements milestone if the team needs them.

- [ ] **STAMP-F1**: "Meta-stamped" badge per asset on the review-link guest page — visual confirmation for clients (D-01 in research). Deferred — easy to add later as a pure read-side change.
- [ ] **STAMP-F2**: Stamp status ("Meta stamp: Applied YYYY-MM-DD" / "Not stamped") in the asset viewer's Info panel — internal QA aid (D-02). Deferred — same rationale.
- [ ] **STAMP-F3**: Manual "Re-apply metadata" button in the asset viewer — force a fresh stamp without going through review link creation (D-03). Deferred — covered by invalidation triggers (rename, new version) for the common cases.
- [ ] **STAMP-F4**: Per-project `metaConfig` override of FbId + Company (currently hardcoded constants). Deferred — explicitly called out as a v2.5+ scope decision. Needs `project.metaConfig` schema, form UI, validation, and migration.

## Out of Scope

Explicit exclusions with reasoning.

- **Inline sync stamping in the review-link POST request (any batch size)** — research flagged this as the #1 way to hit Vercel's 60s timeout even on small batches; a single large video plus network round-trip can exceed the budget. Always-async is the robust architecture. See STAMP-09.
- **Stamping the original GCS object in-place** — breaks the internal-viewer-sees-original contract (STAMP-05) and makes the stamp non-reversible. Separate `stampedGcsPath` is the correct pattern. See AF-02 in research.
- **Client-side XMP injection (browser-based)** — `exiftool-vendored` is a Node + perl binary with no WASM port; exposing FbId / Company constants client-side is also a security concern. Server-side only.
- **Per-review-link-per-asset stamp (one stamped file per delivery)** — all four stamp fields are either constants or asset-level properties; no review-link-specific data. Per-link stamping would waste GCS storage and exiftool compute linearly with delivery count. See AF-04.
- **Re-encoding video to inject metadata** — Meta's schema is XMP (file-header sidecar), not a container flag. Re-encoding would change quality, hash, and take 10-60× longer. exiftool XMP write only.
- **Separate stamp audit log collection** — the existing `jobs` collection already records every `metadata-stamp` run with `createdAt`, `status`, `assetId`, `userId`. Filtered query is the audit log. See AF-08.
- **Mobile app support** — web-first project stance; no mobile-specific stamp UX considered.

## Traceability

Maps REQ-IDs to phases. Filled by roadmapper.

| REQ | Phase | Notes |
|-----|-------|-------|
| STAMP-01..03 | TBD | Core stamping |
| STAMP-04..05 | TBD | Asset caching + delivery isolation |
| STAMP-06..07 | TBD | Invalidation |
| STAMP-08..11 | TBD | Reliability |
| STAMP-12 | TBD | UX |
| STAMP-13 | TBD | Deployment spike |
