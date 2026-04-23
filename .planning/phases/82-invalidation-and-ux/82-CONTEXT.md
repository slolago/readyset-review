# Phase 82: invalidation-and-ux - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Close the v2.4 loop. Three deliverables, all surgical:

1. **STAMP-06** — Active stamp invalidation on rename (clear `stampedGcsPath`, `stampedAt`, and cached signed URL fields in `PUT /api/assets/[id]` when `result.trimmed !== asset.name`). Redundant with the `updatedAt > stampedAt` freshness check shipped in Phase 79+81, but matches the literal spec wording "stampedGcsPath cleared" and releases the stale cached signed URL so next re-stamp produces a clean cache.

2. **STAMP-07** — New-version invalidation. **No code change needed.** New version uploads create a NEW asset doc via upload/complete; the new doc has no prior `stampedGcsPath`, so the first review link including it naturally triggers a fresh stamp. Stack siblings are unaffected because `stampedGcsPath` is per-asset, never per-version-group.

3. **STAMP-08** — Stamp failure fallback. **No code change needed.** Phase 81's `decorate()` already falls back to the original `gcsPath` when `stampFresh === false` (catches both "never stamped" and "stamp job failed" via the `stampedAt` absence check).

4. **STAMP-12** — "Applying metadata…" status in `CreateReviewLinkModal`. One-line label swap on the submit button via `{loading ? 'Applying metadata…' : 'Create Link'}`. Button already shows a spinner via the existing `loading` prop.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

**STAMP-06 active-nulling approach:** only clear fields when the name actually changed (`result.trimmed !== asset.name`). Calling PUT with `{name: currentName}` is a no-op and shouldn't invalidate the stamp. Reduces unnecessary re-stamps when the UI sends a rename payload with the same name.

**No orphan GCS cleanup:** `stampedGcsPathFor` uses `path.extname(sourceGcsPath)` not the asset name's extension. Rename doesn't change the source GCS path, so the stamped path stays stable — the next stamp OVERWRITES the same GCS object. No orphaned blobs from rename.

**Extension-change edge case** (e.g. asset.mp4 renamed to asset.mov) would NOT rename the source GCS object (rename is metadata-only) — so `path.extname(sourceGcsPath)` still returns `.mp4`, and the stamp path stays `.mp4`. The new `.mov` extension in the asset name only affects the `downloadUrl`'s Content-Disposition filename. Non-issue.

**Spinner copy:** "Applying metadata…" (not "Creating link…") because the user's mental model maps "review link creation" to "metadata stamp delivery" in this product. Even though the actual exiftool jobs run async on the server after the POST returns, the label frames the user action correctly.

**No polling UI for stamp completion in v2.4.** The async flow is fire-and-forget; the copy-link view appears as soon as the token is returned. Guests who open the link before stamps complete see the original URL (fallback) — acceptable per STAMP-08. A future milestone can add a polling indicator if the UX feedback proves necessary.

**No UI for retrying failed stamps in v2.4.** The existing jobs retry endpoint (`POST /api/jobs/[jobId]/retry`) already works for `metadata-stamp` job rows via the generalized Job model. AssetCard's existing amber/red dot indicator will surface failed stamp jobs without any new code. Manual retry via the existing retry button reaches the stamp route via the same reentry path probe/sprite use.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FieldValue.delete()` pattern — already used throughout src/app/api/assets/[assetId]/route.ts for description/reviewStatus clearing
- Existing jobs collection + `AssetCard`'s job indicator already surfaces failed stamps with no new code
- `Button` component has built-in `loading` prop — no new UI primitives needed

### Established Patterns
- Conditional null-clearing on whitelisted fields via FieldValue.delete()
- Spinner label swap via `{loading ? 'X' : 'Y'}` ternary inside Button children

### Integration Points
- `src/app/api/assets/[assetId]/route.ts` — add 4 `FieldValue.delete()` calls in the rename branch (already has a `result.trimmed !== asset.name` natural gate)
- `src/components/review/CreateReviewLinkModal.tsx` — one Button children change

</code_context>

<specifics>
## Specific Ideas

None beyond the decisions.

</specifics>

<deferred>
## Deferred Ideas

- Polling UI for live stamp progress (e.g. "Stamping 2 of 5…") — v2.5+
- "Meta-stamped" badge on review-link guest page — STAMP-F1, explicitly deferred
- Stamp status in internal Info panel — STAMP-F2, explicitly deferred
- Manual "Re-apply metadata" button in viewer — STAMP-F3, explicitly deferred; covered by existing probe-style retry

</deferred>
