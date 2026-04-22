# Phase 78: data-layer-bundle-and-network - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Admin surfaces scale past 500+ records without freezing; remaining Firestore / network hotspots stop leaking latency; client bundle sheds font blocking, icon bloat, and unused library weight.

Requirements in scope: PERF-24, PERF-25, PERF-26, PERF-27.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion.

</decisions>

<code_context>
## Existing Code Insights

**PERF-24 — admin pagination**

Three routes need `limit(N)` + cursor-based pagination (`startAfter`):
- `src/app/api/admin/users/route.ts:12` — currently `db.collection('users').orderBy('createdAt', 'desc').get()` (unbounded)
- `src/app/api/admin/projects/route.ts:13` — currently `db.collection('projects').orderBy('createdAt', 'desc').get()` (unbounded)
- `src/app/api/review-links/all/route.ts:16–33` — full projects scan + all links unbounded

Pagination contract suggestion:
- Query params: `limit` (default 50, max 100) + `cursor` (the last doc's id/createdAt)
- Response: `{ items: [...], nextCursor: string | null }`
- Client admin page: fetch initial page, "Load more" button fetches with `?cursor=...`
- Scout the existing admin client (`src/app/(app)/admin/page.tsx`) to see what update is needed — the client must handle the new response shape

If the client-side change is too invasive for one task, keep the API paginated and have the client default to `?limit=100` (larger initial page) without full pagination UI. Document as deferred in SUMMARY.

**PERF-25 — Firestore index + batch reads + cache**

- Add composite index to `firestore.indexes.json`:
  ```json
  {
    "collectionGroup": "comments",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "assetId", "order": "ASCENDING" },
      { "fieldPath": "reviewLinkId", "order": "ASCENDING" }
    ]
  }
  ```
  Operator must run `firebase deploy --only firestore:indexes` after this lands. Deploy is a post-code step, not a code change — the SUMMARY must call this out.

- `src/app/api/review-links/[token]/contents/route.ts:54–56` — replace `Promise.all(folderIds.map(id => db.collection('folders').doc(id).get()))` with `db.getAll(...folderIds.map(id => db.collection('folders').doc(id)))`. 1 RPC vs N.
  
- Same file around lines 68–81 — the asset signed-URL fan-out `Promise.all(assetIds.map(...))` should chunk by 20 (or similar). Copy the chunk pattern from v2.1's `/api/stats` (which chunks review-link `in` queries by 10).

- `src/app/api/assets/route.ts` GET — add `Cache-Control: public, max-age=300, stale-while-revalidate=600` on the 200 response.

**PERF-26 — next/font + lucide-react modularizeImports**

- Remove `@import url('https://fonts.googleapis.com/...')` from `src/app/globals.css` (if present)
- Use `next/font/google` in `src/app/layout.tsx`:
  ```tsx
  import { Inter } from 'next/font/google';
  const inter = Inter({ subsets: ['latin'], display: 'swap' });
  // on <body className={inter.className}>
  ```
  Scout what font(s) are currently loaded — match that.
- `next.config.mjs` — add `modularizeImports`:
  ```js
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
      preventFullImport: true,
    },
  }
  ```

**PERF-27 — preconnect + img→Image + date-fns cleanup**

- `src/app/layout.tsx` — add `<link rel="preconnect" href="https://firestore.googleapis.com" />` + `<link rel="preconnect" href="https://storage.googleapis.com" />` in the `<head>`.
- Raw `<img>` tags in `Sidebar.tsx`, `ReviewHeader.tsx`, `AssetListView.tsx` — migrate to `next/image`. Verify the image dimensions are known or use `fill`/`sizes` appropriately. GCS domain should already be in `next.config.mjs` remotePatterns.
- `date-fns` duration formatting on the hot path — find where duration is formatted (likely in VideoPlayer or FileInfoPanel). Replace with a small helper function using `Math.floor`/`String.padStart` or `Intl.NumberFormat`. If date-fns is also used for other non-hot-path formatting, leave those alone — surgical rule.

## Codebase hints

- `src/app/globals.css` — check current font imports
- `src/app/layout.tsx` — current `<head>` content + body className
- `next.config.mjs` — current remotePatterns, compiler options
- `firestore.indexes.json` — existing composite indexes from v1.9/v2.0/v2.1
- Use `grep -rn "date-fns" src/` to find all date-fns imports

</code_context>

<specifics>
## Specific Ideas

- **4 REQs, likely 4 tasks**, all autonomous, single wave. They touch independent surfaces.
- PERF-24 is the riskiest (client-side pagination contract). If the full pagination UI is too invasive, ship API-side pagination + doubled default limit as a partial win; document in SUMMARY.
- PERF-25 has a post-deploy operational step (`firebase deploy --only firestore:indexes`). Flag it prominently.
- PERF-26 + PERF-27 are pure-config changes with low risk, high signal.
- date-fns replacement: 1 helper function is fine. Don't build a `@/lib/duration.ts` unless there's obvious reuse demand.

</specifics>

<deferred>
## Deferred Ideas

- Server-side cron jobs — deferred to v3
- Full search infrastructure / Algolia integration — out of scope
- Real-time Firestore onSnapshot for project list — would obsolete v2.1's fetch approach; future milestone

</deferred>
