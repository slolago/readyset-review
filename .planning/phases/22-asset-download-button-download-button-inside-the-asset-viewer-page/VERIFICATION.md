---
phase: 22-asset-download-button
verified: 2026-04-07T20:45:00Z
status: passed
score: 4/4 must-haves verified
---

# Phase 22: Asset Download Button — Verification Report

**Phase Goal:** Add a Download button to the asset viewer page header that triggers a forced-to-disk download of the currently displayed asset (or active version).
**Verified:** 2026-04-07T20:45:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Download button visible in asset viewer header for ready assets | VERIFIED | `page.tsx` line 181: `{displayAsset?.status === 'ready' && (<button ... >Download</button>)}` |
| 2 | Clicking Download triggers a file-save-to-disk (not browser tab open) | VERIFIED | `forceDownload` imported from `@/lib/utils`; implementation uses `fetch → blob → createObjectURL → anchor.download` — no `window.open` |
| 3 | Download works after switching versions | VERIFIED | `displayAsset = activeVersion \|\| asset` (line 28); button uses `displayAsset` directly, so version switch automatically updates the target |
| 4 | Download button hidden for uploading/pending assets | VERIFIED | Entire button block guarded by `displayAsset?.status === 'ready'` (line 181) |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/assets/[assetId]/route.ts` | downloadUrl generation for asset and all versions | VERIFIED | `generateDownloadSignedUrl` imported (line 4); root asset block generates both URLs in `Promise.all` (lines 24-29); versions map also generates both URLs per version (lines 54-59) |
| `src/app/(app)/projects/[projectId]/assets/[assetId]/page.tsx` | Download button in viewer header using forceDownload | VERIFIED | `Download` icon + `forceDownload` imported (lines 12-13); button rendered with status guard and `forceDownload` call (lines 181-193) |

---

### Verification Criteria Checklist

| Criterion | Result | Evidence |
|-----------|--------|----------|
| downloadUrl generated for root asset in API route | PASS | Lines 23-30: `Promise.all([generateReadSignedUrl, generateDownloadSignedUrl])` on root asset |
| downloadUrl generated for all versions in API route | PASS | Lines 50-64: same `Promise.all` pattern applied inside `versionDocs.map` |
| Download button present in viewer header with ghost/secondary styling | PASS | Lines 182-193: `text-frame-textSecondary hover:text-white ... hover:bg-frame-cardHover` — matches ghost style of back link, not accent style of Share |
| Button guarded by `status === 'ready'` | PASS | Line 181: `{displayAsset?.status === 'ready' && (` |
| Uses `forceDownload` (not `window.open` or plain anchor href) | PASS | Line 185: `forceDownload(url, displayAsset.name)` — `forceDownload` in `utils.ts` uses fetch+blob+anchor.download pattern |
| TypeScript clean per SUMMARY.md | PASS | `as any` casts are the same pattern used elsewhere in the codebase (AssetCard pattern); no new type violations introduced |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `route.ts` | `src/lib/gcs.ts` | `generateDownloadSignedUrl` import | VERIFIED | Line 4: `import { deleteFile, generateReadSignedUrl, generateDownloadSignedUrl } from '@/lib/gcs'`; function exists at `gcs.ts:56` |
| `page.tsx` | `src/lib/utils.ts` | `forceDownload` import | VERIFIED | Line 13: `import { forceDownload } from '@/lib/utils'`; function exists at `utils.ts:114` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `page.tsx` (Download button) | `displayAsset.downloadUrl` | API response from `/api/assets/[assetId]` GET | Yes — GCS signed URL generated from `asset.gcsPath` via `generateDownloadSignedUrl` | FLOWING |
| `route.ts` (downloadUrl field) | `downloadUrl` on `asset` / `v` | `generateDownloadSignedUrl(gcsPath, name, 120)` | Yes — real GCS signed URL with `Content-Disposition: attachment` | FLOWING |

---

### Anti-Patterns Found

None. No TODOs, placeholders, empty returns, or hardcoded empty data in the modified files. The `as any` casts on `downloadUrl` access are intentional and match the existing codebase pattern (documented in SUMMARY decisions).

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires running GCS-connected server. The wiring is fully verifiable statically; functional correctness of the signed URL generation depends on live GCS credentials.

---

### Human Verification Required

**1. Download triggers file-save dialog**

**Test:** Navigate to any ready video or image asset in the viewer. Click the "Download" button in the header.
**Expected:** Browser shows a file-save dialog (or the file downloads automatically to the Downloads folder), not a new browser tab opening.
**Why human:** `forceDownload` uses `fetch → blob → createObjectURL → anchor.download`. This is correct code, but the actual browser behavior (especially the CORS fallback path) can only be confirmed with a live GCS-signed URL.

**2. Version-aware download**

**Test:** Open an asset that has multiple versions. Switch to version 2 using the VersionSwitcher. Click Download.
**Expected:** The file that downloads is the version 2 file, not the original.
**Why human:** The wiring through `displayAsset` is correct, but verifying the correct binary is delivered requires a running app with real version data.

---

## Gaps Summary

No gaps. All four observable truths verified. Both artifacts are substantive, wired, and have real data flowing through them. Both key links confirmed (imports and implementations exist). No anti-patterns detected. Phase goal is achieved.

---

_Verified: 2026-04-07T20:45:00Z_
_Verifier: Claude (gsd-verifier)_
