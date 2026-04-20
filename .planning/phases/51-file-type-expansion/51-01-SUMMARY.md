---
phase: 51-file-type-expansion
plan: 01
subsystem: upload-pipeline, asset-viewer
tags: [file-types, upload, viewer, pdf, html]
requires:
  - Existing signed-url upload flow
  - generateReadSignedUrl (inline, no content-disposition)
provides:
  - Central file-type classifier (src/lib/file-types.ts)
  - Widened AssetType union (document | archive | font | design)
  - Asset.subtype field (pdf, html, zip, ttf, psd, ...)
  - Inline PDF viewer + sandboxed HTML viewer + FileTypeCard fallback
affects:
  - All upload call sites (dropzone + hidden file inputs)
  - Signed-url server allow-list
  - Grid + list asset cards
  - Asset viewer page type-routing cascade
key-files:
  created:
    - src/lib/file-types.ts
    - src/components/viewer/DocumentViewer.tsx
    - src/components/viewer/HtmlViewer.tsx
    - src/components/viewer/FileTypeCard.tsx
  modified:
    - src/types/index.ts
    - src/lib/utils.ts
    - src/app/api/upload/signed-url/route.ts
    - src/components/files/UploadZone.tsx
    - src/components/files/FolderBrowser.tsx
    - src/components/files/AssetCard.tsx
    - src/components/files/AssetListView.tsx
    - src/app/(app)/projects/[projectId]/assets/[assetId]/page.tsx
decisions:
  - "AssetType widened to 6-member union (not 'other + subtype' variant) for clearer filter/grouping semantics later"
  - "iconName kept as string in file-types.ts; React binding lives in consumer components (keeps module framework-agnostic)"
  - "HtmlViewer sandbox = allow-scripts allow-same-origin (GCS origin, not app origin — parent is safe)"
  - "Server trusts extension-derived classification when MIME is application/octet-stream (unavoidable for .psd/.ai/.fig/.aep)"
metrics:
  tasks_completed: 5
  files_created: 4
  files_modified: 8
  tests: "138 passed (no regressions)"
  completed: 2026-04-20
---

# Phase 51 Plan 01: file-type-expansion Summary

Expanded the upload surface from video/image only to video, image, document (PDF, HTML), archive (ZIP), font (TTF/OTF/WOFF/WOFF2), and design (AI/PSD/AEP/FIG). PDFs and HTML render inline; non-previewable types fall through to a clean FileTypeCard with metadata + download.

## Final AssetType union

```ts
export type AssetType = 'video' | 'image' | 'document' | 'archive' | 'font' | 'design';

export interface Asset {
  // ...
  type: AssetType;
  subtype?: string; // 'pdf' | 'html' | 'zip' | 'ttf' | 'otf' | 'woff' | 'woff2' | 'ai' | 'psd' | 'aep' | 'fig' | ...
}
```

Additive — existing `'video'` / `'image'` records continue to work. `subtype` is absent on pre-Phase-51 assets and optional everywhere.

## file-types.ts public surface

```ts
export type ViewerKind = 'video' | 'image' | 'pdf' | 'html' | 'card';
export type IconName = 'Film' | 'Image' | 'FileText' | 'FileCode' | 'FileArchive' | 'Type' | 'Palette';
export interface FileTypeMeta { type, subtype, viewer, label, iconName }

export function classify(mime: string, extension: string): FileTypeMeta | null;
export function extFromName(name: string): string;

export const ACCEPTED_MIME: string[];
export const ACCEPTED_EXTENSIONS: string[];
export const DROPZONE_ACCEPT: Record<string, string[]>;   // react-dropzone shape
export const FILE_INPUT_ACCEPT: string;                   // comma-joined for <input accept>
export const TYPE_META: Record<AssetType, { label, iconName }>;
```

Single source of truth — server route, dropzone, all three hidden file inputs, AssetCard, AssetListView, and FileTypeCard derive from it.

## Viewer routing cascade

`src/app/(app)/projects/[projectId]/assets/[assetId]/page.tsx` main content area:

1. `compareMode && versions.length >= 2` → `VersionComparison`
2. `type === 'video'` → `VideoPlayer`
3. `type === 'image'` → `ImageViewer`
4. `subtype === 'pdf'` → `DocumentViewer` (iframe to signed URL — browser-native PDF)
5. `subtype === 'html'` → `HtmlViewer` (sandboxed iframe)
6. else (archive, font, design, unknown document subtype) → `FileTypeCard`

`CommentSidebar` still mounts for all non-video/image types — comment threading works uniformly. Annotation mode is only wired for video/image (handlers are no-ops for others since the refs are null).

`ExportModal` stays guarded by `type === 'video'`.

## Grid + list card behavior

- **AssetCard thumbnail slot** — new branch for `type !== 'video' && type !== 'image'` renders `TYPE_META[type].iconName` (via local `ICON_COMPONENTS` map) at `w-12 h-12` with a `.SUBTYPE` extension pill below. Image/video paths unchanged (sprite scrub, play overlay, duration badge all still work).
- **Type badge (top-left pill)** — now `TYPE_META[asset.type].label.toLowerCase()` + correct icon for all 6 types.
- **AssetListView thumbnail cell** — same icon lookup at `w-5 h-5` for list-row size.

## HtmlViewer sandbox security note

Sandbox flags: `allow-scripts allow-same-origin`.

- `allow-scripts` — prototypes typically need JS; without it, uploads are useless.
- `allow-same-origin` — required so relative asset refs (`<img src="./hero.png">`) resolve against the GCS bucket's host. Because the sandboxed frame's origin is the GCS bucket and not the app's origin, script execution cannot touch parent cookies, localStorage, or DOM.

Explicitly NOT granted: `allow-forms`, `allow-popups`, `allow-top-navigation`, `allow-modals`, `allow-downloads`. Anything beyond this (server-side scanning, CSP hardening) is deferred per REQUIREMENTS out-of-scope list. Documented inline in `HtmlViewer.tsx`.

## Server classification change

`signed-url/route.ts` now:

```ts
const ext = extFromName(filename);
const meta = classify(contentType, ext);
if (!meta) return 400 'Unsupported file type';
// ...
type: meta.type,
subtype: meta.subtype,
```

The classifier is extension-tolerant — when MIME is `application/octet-stream` (common for .psd/.ai/.fig/.aep, which have no standardized MIME), the extension wins. This is intentional; design files are never executed server-side and the residual risk is bounded to storage size abuse, which is already rate-limited elsewhere.

## Commits

- `88a5a4d7` Task 1 — extend AssetType + central file-type classifier
- `7fdc7c27` Task 2 — unify client + server allow-lists on central file-type map
- `c48cf0de` Task 3 — add DocumentViewer, HtmlViewer, FileTypeCard
- `bb20e90c` Task 4 — route asset viewer page by type
- `f467c359` Task 5 — render file-type icon on grid + list cards

## Deviations from Plan

None — plan executed as written.

## Self-Check: PASSED

- `src/lib/file-types.ts` — FOUND
- `src/components/viewer/DocumentViewer.tsx` — FOUND
- `src/components/viewer/HtmlViewer.tsx` — FOUND
- `src/components/viewer/FileTypeCard.tsx` — FOUND
- All 5 commits present in git log
- `npx tsc --noEmit` — clean after every task
- `npx vitest run` — 138/138 passed (no regressions)
