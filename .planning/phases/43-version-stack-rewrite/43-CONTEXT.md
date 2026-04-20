# Phase 43: version-stack-rewrite - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Any-version-anywhere stacking/unstacking without silent data loss. Users can stack any asset onto any other (even when either is already a member of a version group), detach any version from a stack (not just the topmost), reorder versions within a stack, and trust that comments/annotations/review-link references/review status survive the operation or are explicitly warned about.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key principles to follow:
- Atomic Firestore batch for any multi-document mutation (established v1.3)
- Existing VersionStackModal + SmartCopyModal patterns (extracted in v1.4)
- Preserve comments/annotations/review-link associations unconditionally
- Never renumber versions non-atomically — use batch write

</decisions>

<code_context>
## Existing Code Insights

Known relevant files:
- src/components/assets/VersionStackModal.tsx — version stack management UI
- src/components/assets/SmartCopyModal.tsx — sibling pattern for asset operations
- src/app/api/assets/merge-version/route.ts — existing stack/merge API (v1.3)
- src/app/api/assets/unstack-version/route.ts — existing unstack API (v1.4, Phase 31-01)
- src/app/api/assets/reorder-versions/route.ts — existing reorder API (v1.4, Phase 31-01)
- src/types/index.ts — Asset + versionGroupId + version fields

</code_context>

<specifics>
## Specific Ideas

Success criteria (from ROADMAP):
1. Stack any asset onto any asset — including when source or target already in a version group — produces one merged group with stable numbering
2. Detach any version (not just topmost) into a standalone asset; comments/annotations/review-link refs preserved
3. Reorder versions within a stack; version numbers renumber atomically
4. No silent data loss — preserved or warned-about

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
