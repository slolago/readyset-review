export type SelectionLevel = 'project' | 'folder' | 'asset' | 'version';
export type SelectionState =
  | 'idle'
  | 'hovered'
  | 'focused'
  | 'selected'
  | 'parent-of-selected';

/**
 * Returns a Tailwind class string for the given hierarchy level + state.
 * Applied on the outer container of grid cards and sidebar tree rows.
 *
 * Design (per Phase 48 CONTEXT):
 *   selected           → solid accent border + subtle bg tint
 *   hovered            → accent/30 border
 *   focused            → ring-2 with offset
 *   parent-of-selected → dashed accent border (lower intensity)
 *   idle               → neutral scope-border
 *
 * Nesting intensity: project ≤ folder ≤ asset ≤ version (deeper = brighter).
 */
export function selectionStyle(
  level: SelectionLevel,
  state: SelectionState
): string {
  // Base border is always present so layouts don't shift.
  const base = 'border transition-colors';

  switch (state) {
    case 'selected':
      // Deeper levels get a slightly stronger tint so a selected version
      // inside a selected asset still reads as "more selected".
      return [
        base,
        'border-scope-accent',
        level === 'version' || level === 'asset'
          ? 'ring-1 ring-scope-accent bg-scope-accent/10'
          : 'bg-scope-accent/5',
      ].join(' ');
    case 'hovered':
      return `${base} border-scope-accent/30`;
    case 'focused':
      return `${base} border-scope-border ring-2 ring-scope-accent ring-offset-2 ring-offset-scope-bg`;
    case 'parent-of-selected':
      return `${base} border-dashed border-scope-accent/60`;
    case 'idle':
    default:
      return `${base} border-scope-border hover:border-scope-borderLight`;
  }
}
