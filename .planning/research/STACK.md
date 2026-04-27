# Technology Stack — v2.4 Meta XMP Stamping

**Project:** readyset-scope
**Researched:** 2026-04-23
**Scope:** Server-side XMP embedding addendum only. Existing stack (Next.js 14, Firebase, GCS, ffmpeg pipeline) is validated and not re-examined except where XMP stamping integrates with it.

---

## Verdict: One New npm Package Required

`exiftool-vendored@35.18.0` — the only addition. Everything else (GCS download/upload, job lifecycle, signed-URL cache, route structure) reuses existing code verbatim.

---

## New Dependency

### exiftool-vendored

| Attribute | Value |
|-----------|-------|
| Package | `exiftool-vendored` |
| Version (pin) | `35.18.0` |
| Published | 2026-04-17 (6 days before research date) |
| License | MIT |
| npm page | https://www.npmjs.com/package/exiftool-vendored |

**What it provides:** Node.js wrapper around Phil Harvey's ExifTool CLI. Spawns a subprocess using the perl-based ExifTool script bundled in `exiftool-vendored.pl` (selected at install time via npm optional dependencies). Exposes `ExifTool.write(filePath, tags, [args])` which is the exact call the reference `scf-metadata` Electron app uses.

**Why this over alternatives:**

| Option | Decision | Reason |
|--------|----------|--------|
| `exiftool-vendored` | USE | Direct 1:1 match to the reference implementation. Same package the `scf-metadata` Electron app uses. Supports custom XMP namespaces via `-config` flag. Writes MP4 `uuid` atom (Adobe XMP) and image XMP transparently by format. |
| `exiftool-vendored.pl` (direct) | REJECT | This is the optional sub-package installed automatically on Linux. No value in depending on it directly — `exiftool-vendored` selects it via `optionalDependencies`. |
| `exiv2` / `node-exiv2` | REJECT | No npm-installable Linux binary; requires system library. No support for the custom `http://ns.attribution.com/ads/1.0/` XMP namespace without C++ plugin development. |
| Raw MP4 atom injection (pure JS) | REJECT | Requires parsing the MP4 container box structure, locating or creating the `uuid` box (be7acfcb97a942e89c71999491e3afac), serializing XMP XML, and handling the 10+ image format cases manually. Several hundred lines of brittle binary parsing code. Eliminates format transparency — images would need separate handling. |
| `node-exiftool` (older wrapper) | REJECT | Unmaintained. Does not support `-config` for custom namespaces. |

---

## Bundle Size Analysis

npm reports `dist.unpackedSize` (uncompressed bytes on disk):

| Package | Unpacked Size | Notes |
|---------|--------------|-------|
| `exiftool-vendored` (JS wrapper) | **2.6 MB** | TypeScript → JS, types, deps (batch-cluster, luxon, he) |
| `exiftool-vendored.pl` (Linux binary) | **21.7 MB** | Perl ExifTool script — installed only on non-Windows via `optionalDependencies` |
| `exiftool-vendored.exe` (Windows binary) | 34.6 MB | NOT installed on Linux/Vercel |
| **Total on Vercel (Linux)** | **~24.3 MB** | Well within the 250 MB uncompressed serverless limit |

**Confidence:** HIGH — exact numbers from `npm view exiftool-vendored dist.unpackedSize` and `npm view exiftool-vendored.pl dist.unpackedSize` at time of research.

**Context:** The existing ffmpeg stack already contributes ~100–150 MB to the bundle. Adding 24 MB for exiftool stays well inside the 250 MB ceiling.

---

## Vercel Serverless Compatibility

### How npm optional dependencies work on Linux

`exiftool-vendored` declares in its `package.json`:

```json
"optionalDependencies": {
  "exiftool-vendored.exe": "13.57.0",
  "exiftool-vendored.pl": "13.57.0"
}
```

npm on Linux installs `exiftool-vendored.pl` and skips `exiftool-vendored.exe`. The JS wrapper resolves the binary path at runtime to `node_modules/exiftool-vendored.pl/bin/exiftool` (a perl script). The Windows `.exe` is never downloaded.

### Binary tracing (outputFileTracingIncludes)

Next.js uses `@vercel/nft` (static analysis) to determine which files to bundle. Dynamically resolved binary paths are invisible to `nft`. The existing pattern in `next.config.mjs` for ffmpeg packages must be extended:

```js
// next.config.mjs — add to existing outputFileTracingIncludes
'/api/assets/*/stamp-metadata': [
  './node_modules/exiftool-vendored.pl/**',
  './node_modules/exiftool-vendored/**',
  './src/lib/exiftool-config/.config',   // the XMP namespace config file
],
```

Without this, Vercel will bundle the route JavaScript but omit the perl script and `.config` file, causing a runtime `ENOENT` spawn error.

**Confidence:** HIGH — identical pattern already used in the project for `@ffmpeg-installer/ffmpeg` and `ffmpeg-static` (confirmed in `next.config.mjs`).

### serverComponentsExternalPackages

`exiftool-vendored` spawns child processes and uses Node.js-specific APIs — it must not be bundled by webpack. Add it to the existing list:

```js
// next.config.mjs — add to existing serverComponentsExternalPackages array
'exiftool-vendored',
'exiftool-vendored.pl',
```

**Note:** In Next.js 14, the config key is `experimental.serverComponentsExternalPackages`. This was renamed to `serverExternalPackages` (top-level, no `experimental`) in Next.js 15. This project is on 14.2.5 — keep the `experimental` prefix.

### Subprocess lifecycle in serverless

`exiftool-vendored` keeps a long-running subprocess via `-stay_open True -@ -`. In serverless this means:

- **Cold start:** The subprocess is spawned on first `ExifTool` instantiation (~50–200 ms on Linux per exiftool-vendored docs).
- **Request scope:** The stamp route creates a new `ExifTool` instance per invocation, uses it for one write, then calls `et.end()`. Since Vercel functions are single-request per container (no HTTP keep-alive to the same function instance in the general case), there is no benefit to a module-level singleton.
- **v35+ behavior:** As of v35.0.0, stdio streams are unreferenced by default. "Node.js will exit naturally without calling `.end()`" — child processes clean up automatically when the parent exits. Calling `et.end()` explicitly in a `finally` block is still correct practice and has no downside.
- **Pattern:**

```typescript
const et = new ExifTool({ exiftoolArgs: ['-config', CONFIG_PATH] });
try {
  await et.write(localPath, { Attrib: [...] }, ['-overwrite_original']);
} finally {
  await et.end();
}
```

**Confidence:** HIGH — sourced from exiftool-vendored CHANGELOG v35.0.0 (confirmed via WebFetch of CHANGELOG.md).

### Perl availability on Vercel Lambda

Vercel's Node.js functions run on Amazon Linux 2023. The build image is documented as Amazon Linux 2023 base. AL2023 minimal containers typically do NOT include perl in the runtime image (distinct from the build image which may have it for build scripts).

**The `ignoreShebang` auto-detection handles this case.** Since exiftool-vendored v8.17.0:

> "Automagick workaround for AWS Lambda. The new `ExifToolOption.ignoreShebang` option should automatically be set to `true` on non-Windows platforms that don't have `/usr/bin/perl` installed."

What this means: if `/usr/bin/perl` is absent, exiftool-vendored calls `which perl` to find perl elsewhere on `$PATH`, then invokes `perl /path/to/exiftool` directly bypassing the shebang. The `exiftool-vendored.pl` package ships the perl ExifTool script, not a compiled binary — perl itself must be present in the runtime.

**Known risk:** If the Vercel Lambda runtime has no perl at all on `$PATH`, the spawn will fail. There is no publicly confirmed test of exiftool-vendored on Vercel's production Node.js Lambda runtime. However:

1. The reference implementation (scf-metadata Electron app) runs on the local machine, not the Lambda.
2. AWS Lambda Node.js runtimes on AL2023 minimal images have been documented to lack perl.
3. Mitigation: **test a one-off Vercel deployment before committing to this approach.** The stamp route should return a clear error message when exiftool spawn fails rather than hanging.

**LOW confidence on perl availability in the Vercel Lambda runtime.** The route must include a health-check/version call and fail fast with a clear error if exiftool is unavailable.

---

## Date Formatting

**Requirement:** Write `Attrib:Created` as `YYYY:MM:DD` (ExifTool date format, same as the reference app uses with `dayjs().format('YYYY:MM:DD')`).

**Decision: Use native JavaScript — no library needed.**

```typescript
const now = new Date();
const Created = `${now.getFullYear()}:${String(now.getMonth() + 1).padStart(2, '0')}:${String(now.getDate()).padStart(2, '0')}`;
```

- `dayjs` is NOT in the project's `package.json` — do not add it.
- `luxon` is pulled in transitively by `exiftool-vendored` but should not be imported directly in application code.
- The format `YYYY:MM:DD` is 10 characters of simple math — no date library justifies the dependency for this use case.

**Confidence:** HIGH — `package.json` confirmed, format confirmed from reference `exiftool.js`.

---

## XMP Config File

The `.config` file defining the `Attrib` namespace must be bundled with the deployment. It is 13 lines of Perl defining the `http://ns.attribution.com/ads/1.0/` XMP schema.

**Decision: Copy the reference app's `.config` verbatim into the repo.**

Suggested location: `src/lib/exiftool-config/.config`

This path is referenced via `path.join(__dirname, ...)` or `path.resolve(process.cwd(), 'src/lib/exiftool-config/.config')` in the route handler. It must be included in `outputFileTracingIncludes` (see above).

**Why not inline the namespace:** ExifTool requires a config file on disk — the `-config` flag takes a file path, not inline Perl code. There is no way to pass the namespace definition as a command-line argument.

---

## GCS Download / Upload Pattern

The stamp job follows the identical pattern already established by `generate-sprite`:

1. `generateReadSignedUrl(asset.gcsPath, 60)` — get a short-lived read URL
2. Stream-download via `fetch(url)` → `fs.createWriteStream(localPath)` — same streaming pattern in `generate-sprite/route.ts` lines 180–212
3. Run exiftool write on the local file (modifies in-place with `-overwrite_original`)
4. `uploadBuffer(stampedGcsPath, await fs.readFile(localPath), asset.contentType)` — reuse existing `gcs.ts` helper
5. `await fs.rm(tmpDir, { recursive: true, force: true })` in `finally` — same cleanup pattern

**No new GCS helpers needed.** `downloadToFile(gcsPath, localPath)` in `gcs.ts` line 115 can be used directly (simpler than the streaming approach — appropriate here since the stamp job is not upload-size-sensitive in the same way as sprite generation).

**Confidence:** HIGH — confirmed by reading `gcs.ts` and `generate-sprite/route.ts`.

---

## Job Infrastructure Integration

The `metadata-stamp` job type slots directly into the existing `jobs` collection via `src/lib/jobs.ts`:

```typescript
jobId = await createJob({
  type: 'metadata-stamp',   // new JobType enum value
  assetId,
  projectId: asset.projectId,
  userId: user.id,
});
```

Add `'metadata-stamp'` to the `JobType` union in `src/types/index.ts`. No other changes to `jobs.ts` are needed.

**Confidence:** HIGH — `jobs.ts` interface is generic (`CreateJobInput` has no type-specific fields beyond `format`).

---

## Signed-URL Cache Integration

The stamped file needs its own cached signed URL, parallel to the existing `signedUrl` / `signedUrlExpiresAt` on the asset document:

```typescript
// New fields on Asset:
stampedGcsPath?: string;
stampedSignedUrl?: string;
stampedSignedUrlExpiresAt?: Timestamp;
stampedAt?: Timestamp;
```

`getOrCreateSignedUrl` in `signed-url-cache.ts` is format-agnostic — call it with `stampedGcsPath` and the result becomes `stampedSignedUrl`. The existing 120-minute TTL with 30-minute refresh threshold is appropriate.

**Confidence:** HIGH — `signed-url-cache.ts` interface confirmed; takes any `gcsPath`, not format-specific.

---

## next.config.mjs — Full Required Changes

```js
const nextConfig = {
  // ... existing config unchanged ...
  experimental: {
    serverComponentsExternalPackages: [
      'firebase-admin',
      '@google-cloud/storage',
      'fluent-ffmpeg',
      'ffmpeg-static',
      '@ffmpeg-installer/ffmpeg',
      '@ffprobe-installer/ffprobe',
      'exiftool-vendored',        // ADD
      'exiftool-vendored.pl',     // ADD
    ],
    outputFileTracingIncludes: {
      // ... existing entries unchanged ...
      '/api/assets/*/stamp-metadata': [  // ADD this entry
        './node_modules/exiftool-vendored.pl/**',
        './node_modules/exiftool-vendored/**',
        './src/lib/exiftool-config/**',   // the .config file
      ],
    },
  },
};
```

---

## What NOT to Add

| Package | Why Not |
|---------|---------|
| `dayjs` | Project has no date library; the `YYYY:MM:DD` format is 3 lines of native JS. Adds 7 KB for zero benefit. |
| `exiv2` / `node-exiv2` | No npm binary for Linux; requires system library; no custom XMP namespace support without C++ work. |
| `sharp` | Image-format-specific metadata embedding; cannot handle MP4 at all; cannot write custom XMP namespaces. No benefit over exiftool. |
| `fluent-ffmpeg` (for metadata) | ffmpeg's `-metadata` flag cannot write arbitrary XMP namespaces. Only writes ID3-style tags into containers. Not an alternative. |
| `exiftool-vendored.pl` (direct dep) | It is an optional dep of `exiftool-vendored`. The wrapper auto-selects it. Depending on it directly adds version drift risk. |
| `luxon` | Pulled in transitively by exiftool-vendored. Do not add as a direct dep or import in application code. |

---

## Installation

```bash
npm install exiftool-vendored@35.18.0
```

The `exiftool-vendored.pl` package installs automatically as an optional dependency on Linux (Vercel build environment).

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Package selection (exiftool-vendored) | HIGH | Direct match to reference implementation; only tool that supports custom XMP namespace via `-config` |
| Bundle size (24.3 MB on Linux) | HIGH | npm `dist.unpackedSize` values from registry at research time |
| Within Vercel 250 MB limit | HIGH | 24.3 MB + existing ~100–150 MB ffmpeg stack well under ceiling |
| `outputFileTracingIncludes` required | HIGH | Same pattern confirmed working in production for ffmpeg packages |
| `serverComponentsExternalPackages` required | HIGH | Package spawns child processes; confirmed by library architecture |
| Subprocess per-request pattern | HIGH | CHANGELOG v35.0.0 confirms unreferenced stdio; `end()` in finally is correct |
| Date formatting (native JS, no library) | HIGH | Package.json confirmed; format is trivial |
| GCS download/upload pattern reuse | HIGH | Existing `gcs.ts` helpers confirmed compatible |
| Job infrastructure integration | HIGH | `jobs.ts` interface is generic |
| Perl availability in Vercel Lambda runtime | LOW | No public confirmation; `ignoreShebang` auto-detection mitigates but does not eliminate risk |

---

## Sources

- `npm view exiftool-vendored` — version, size, dependencies (verified 2026-04-23)
- `npm view exiftool-vendored.pl` — size 21.7 MB (verified 2026-04-23)
- `npm view exiftool-vendored.exe` — size 34.6 MB, confirms Windows exclusion on Linux
- exiftool-vendored CHANGELOG.md v35.0.0: unreferenced stdio, natural process exit
- exiftool-vendored CHANGELOG.md v8.17.0: `ignoreShebang` auto-detection for Lambda
- https://vercel.com/kb/guide/troubleshooting-function-250mb-limit — 250 MB uncompressed limit confirmed
- https://vercel.com/docs/deployments/build-image/build-image — Amazon Linux 2023 confirmed
- https://nextjs.org/docs/14/app/api-reference/next-config-js/serverComponentsExternalPackages — Next.js 14 config key confirmed
- `C:\Users\Lola\Documents\frame\next.config.mjs` — existing `outputFileTracingIncludes` and `serverComponentsExternalPackages` pattern
- `C:\Users\Lola\Documents\frame\src\app\api\assets\[assetId]\generate-sprite\route.ts` — GCS download/upload/cleanup pattern
- `C:\Users\Lola\Documents\frame\src\lib\gcs.ts` — `downloadToFile`, `uploadBuffer` helpers
- `C:\Users\Lola\Documents\frame\src\lib\jobs.ts` — `createJob`/`updateJob` interface
- `C:\Users\Lola\Documents\frame\src\lib\signed-url-cache.ts` — `getOrCreateSignedUrl` interface
- `C:\Users\Lola\AppData\Local\scf-meta\app-0.11.9\resources\app\src\backend\exiftool.js` — reference implementation
- `C:\Users\Lola\AppData\Local\scf-meta\app-0.11.9\resources\app\public\exiftool\.config` — XMP namespace config
- github.com/photostructure/exiftool-vendored.js/issues/101 — Lambda compatibility discussion
- github.com/photostructure/exiftool-vendored.js/issues/163 — ignoreShebang behavior
