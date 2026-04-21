# Phase 66 Plan 01 — Verification

## Automated

| Check | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | clean (no output) |
| Unit tests | `npx vitest run` | 171 passed / 171 |
| Dead-field grep | `grep asset.url src/` | 0 matches |
| Old sprite field grep | `grep spriteStripUrl src/` | 0 matches |

Each command was re-run after every CLN commit; no regressions introduced.

## Per-CLN

### CLN-01
- `Asset.url` removed from `src/types/index.ts`.
- `url: publicUrl` write removed from `/api/upload/signed-url`.
- `getPublicUrl` import removed (no other use in that file).
- `VersionComparison.tsx` + `ImageViewer.tsx` no longer reference `asset.url`.

### CLN-02
- Both response-shape sites (cached + fresh) in `generate-sprite` return `spriteSignedUrl`.
- `AssetCard.ensureSprite` reads `data.spriteSignedUrl`.

### CLN-03
- `UploadCompleteRequest` gains `frameRate?`, `thumbnailGcsPath?`, `mimeType?`.
- Server-side destructure in `/api/upload/complete` already uses all documented fields.

### CLN-04
- `fetchAssets(signal?: AbortSignal)`.
- `useEffect` creates `AbortController`, aborts on cleanup.
- AbortError path swallowed; setLoading skipped when aborted.

### CLN-05
- `folderIsAccessible` performs ONE `folders.doc(id).get()` + in-memory `path[]` membership check.
- Project-scoped links still short-circuit to "any folder in project".

### CLN-06
- Size-exceeded branch: `writer.destroy() → reader.cancel() → once('close')` before 413 response.

### CLN-07
- Video branch in `/api/upload/complete` sets `updates.probed = false`.
- Image branch still sets `updates.probed = true`.

## Commits

| CLN | Hash |
|---|---|
| CLN-01 | 2c6e4ad5 |
| CLN-02 | afdb6386 |
| CLN-03 | 1d0b0dbe |
| CLN-04 | c4a07fbf |
| CLN-05 | 72986837 |
| CLN-06 | a08ae740 |
| CLN-07 | c36ab4a4 |

## Anti-scope adherence

- No changes to error response shapes.
- No new client-visible features.
- No pre-existing warnings addressed.
- No refactors of unrelated code.
