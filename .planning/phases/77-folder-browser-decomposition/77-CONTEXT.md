# Phase 77: folder-browser-decomposition - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Project root + folder drill-down stop paying the full waterfall cost; FolderBrowser stops cascading re-renders across 200+ cards on every rename state change.

Requirements in scope: PERF-22, PERF-23.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion.

</decisions>

<code_context>
## Existing Code Insights

**PERF-22 — parallel useProject fetches**

- `src/hooks/useProject.ts` currently fires `fetchProject()` then `fetchFolders(null)` sequentially (audit: lines 14–32 then 34–51).
- Fix: `Promise.all([fetchProject(), fetchFolders(null)])` in the mount effect. Both requests go out simultaneously; the first response doesn't block the second.
- Verify existing error handling still works — if `fetchProject` throws, does the code still try to render? Match current behavior.

**PERF-23 — FolderBrowser decomposition**

The file `src/components/files/FolderBrowser.tsx` is 2,291 LOC (Phase 71 + Phase 72 added ~200 LOC; v1.x original was ~1,800). Audit said rename-state changes cause all 200+ asset cards to re-render because `RenameProvider` wraps the entire inner component.

**Strategy (conservative — this is a big file):**
1. Extract `AssetGrid` (the grid of `AssetCard`s) into its own file: `src/components/files/AssetGrid.tsx`. It receives `assets`, `selection state`, and callbacks as props. Wrap with `React.memo` using a stable comparison.
2. Extract `AssetListView` — already a named export, but scout: is it currently rendered inside FolderBrowser without memoization? Wrap with `React.memo` at export.
3. Narrow `RenameProvider`: move it from wrapping the whole `FolderBrowserInner` to wrap only the grid + list surface (the part that actually contains rename-capable cards). Breadcrumb + header render outside, so rename state changes don't invalidate them.
4. Breadcrumb + header — if already memoized or pure, leave them alone. If not, wrap with React.memo.

**Risk:** FolderBrowser is a hot, critical component. Avoid bundling many extractions in one task. Prefer:
- Task 1: AssetGrid extraction + memo
- Task 2: AssetListView memo (narrow change)
- Task 3: RenameProvider scope narrowing + breadcrumb/header memo

Keep each task compile-green + tests-green.

**Additional hygiene:** if any inline callbacks are re-created on every render (e.g., `onClick={() => handleFoo(asset)}`), wrap in `useCallback` with stable deps so React.memo comparison actually works. But don't go overboard — only touch callbacks that feed memoized children.

</code_context>

<specifics>
## Specific Ideas

- Keep FolderBrowser.tsx LOC as low as possible after the decomposition. Every extracted chunk should actually disappear from the main file, not just get renamed.
- `React.memo` with a custom comparator is over-engineering for this phase. Default shallow comparison is fine — just ensure props are stable (useCallback, useMemo for arrays/objects).
- Run `npm test` frequently during the refactor — a 2,291-LOC file rewrite has many ways to regress silently.
- Verification grep: `grep -c "^"` on FolderBrowser.tsx should drop meaningfully after the extractions.

</specifics>

<deferred>
## Deferred Ideas

- Full virtualization of large asset grids (react-window / react-virtual) — out of v2.3 scope
- Real-time project list via Firestore onSnapshot — future milestone
- Further FolderBrowser surgical refactor (splitting into 5+ files) — conservative scope here; can revisit after measuring real perf impact

</deferred>
