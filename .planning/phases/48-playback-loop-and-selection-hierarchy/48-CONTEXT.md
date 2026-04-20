# Phase 48: playback-loop-and-selection-hierarchy - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Capstone polish: (1) loop button in video player that loops the whole video OR the marked in/out range when set; (2) selection hierarchy redesign so nested selected/hovered/focused states read clearly across project → folder → asset → version nesting.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- Loop: per-session state, Repeat icon toggle in controls; when playing and loop=true + time reaches duration (or outPoint), seek back to 0 (or inPoint) and continue
- Selection hierarchy: use outline color intensity to indicate nesting depth; active selection = solid accent border; hover = accent/30; focus = ring-2 with offset; parent-of-selected = dashed accent border
- Respect existing sidebar tree styles and grid card styles

</decisions>

<code_context>
## Existing Code Insights

- src/components/viewer/VideoPlayer.tsx — controls row + in/out markers (from Phase 46)
- src/components/files/AssetCard.tsx — grid card
- src/components/files/FolderCard.tsx — folder card
- src/components/layout/Sidebar.tsx (if exists) — project tree
- src/components/projects/ProjectCard.tsx — project card

</code_context>

<specifics>
## Specific Ideas

Success criteria:
1. Loop toggle in player: when no in/out set → loops whole video; when in/out set → loops that range; state per session, resets when asset changes
2. Selection hierarchy: selected/hovered/focused states read clearly for nested levels

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
