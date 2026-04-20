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
 *   idle               → neutral frame-border
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
        'border-frame-accent',
        level === 'version' || level === 'asset'
          ? 'ring-1 ring-frame-accent bg-frame-accent/10'
          : 'bg-frame-accent/5',
      ].join(' ');
    case 'hovered':
      return `${base} border-frame-accent/30`;
    case 'focused':
      return `${base} border-frame-border ring-2 ring-frame-accent ring-offset-2 ring-offset-frame-bg`;
    case 'parent-of-selected':
      return `${base} border-dashed border-frame-accent/60`;
    case 'idle':
    default:
      return `${base} border-frame-border hover:border-frame-borderLight`;
  }
}
