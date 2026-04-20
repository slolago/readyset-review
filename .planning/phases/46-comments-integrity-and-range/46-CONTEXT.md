# Phase 46: comments-integrity-and-range - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Comment subsystem polish: (1) in/out range comments with timeline highlight, (2) comment count badge integrity, (3) no orphan drawings. No export, no loop.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- Range comments: comment has optional inPoint + outPoint fields (Asset has duration). UI presents a "Mark range" button alongside existing timestamp pin; timeline renders highlighted region; clicking range seeks to inPoint.
- Count integrity: count must reflect user-visible comments (i.e., parentId-less top-level comments OR all including replies — pick consistent rule). Grid badge currently reads _commentCount — ensure the server populates it correctly.
- Orphan drawings: when a user starts annotating but cancels without attaching text, the drawing is discarded, not persisted. Save button disabled when comment text empty (even if drawing present).

</decisions>

<code_context>
## Existing Code Insights

Relevant files:
- src/components/viewer/CommentSidebar.tsx — comment list + composer
- src/components/viewer/CommentItem.tsx — individual comment render (already has "Completed" badge)
- src/components/viewer/AnnotationCanvas.tsx — Fabric.js drawing
- src/components/viewer/VideoPlayer.tsx — timeline rendering (timedComments, rangeComments arrays already declared; rangeComments uses inPoint/outPoint but no UI for setting them)
- src/types/index.ts — Comment interface has inPoint?, outPoint? already
- src/app/api/comments/route.ts — create comment endpoint
- src/app/api/assets/route.ts — returns _commentCount (how is it computed?)

Known partial state: Comment type already has inPoint/outPoint fields; VideoPlayer already renders range markers on timeline; missing: UI to SET range when composing a comment.

</code_context>

<specifics>
## Specific Ideas

Success criteria (from ROADMAP):
1. User can set inPoint + outPoint on a comment; timeline shows highlighted range; clicking a range comment seeks to inPoint
2. Comment count badge matches real visible count — no phantom drawings-as-comments
3. User cannot save annotation drawing without comment text — Save disabled OR drawing discarded; no orphan drawings persisted

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
