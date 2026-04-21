'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';

interface InlineRenameProps {
  value: string;
  onCommit: (next: string) => void | Promise<void>;
  onCancel: () => void;
  placeholder?: string;
  /** Select-all on mount. Default true. */
  selectOnMount?: boolean;
}

/**
 * Shared inline-rename controlled input. Enter commits, Escape cancels.
 * Blur does NOT commit (matches the fix from Phase 53). Clicks on the
 * check/X buttons have stopPropagation so row/card click handlers don't
 * navigate.
 *
 * Phase 72 (EDIT-01): a document-level `pointerdown` listener cancels when
 * the click lands outside the container. `pointerdown` (not `click`) fires
 * before click handlers on other cards, so the revert happens before any
 * sibling-card click ever runs. Blur/focusout still do NOT commit — Enter
 * and the check button remain the only commit paths.
 */
export function InlineRename({
  value,
  onCommit,
  onCancel,
  placeholder,
  selectOnMount = true,
}: InlineRenameProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Keep onCancel stable for the effect so the listener isn't re-attached
  // on every parent render; callers pass inline arrow fns.
  const onCancelRef = useRef(onCancel);
  useEffect(() => { onCancelRef.current = onCancel; }, [onCancel]);

  useEffect(() => {
    inputRef.current?.focus();
    if (selectOnMount) inputRef.current?.select();
  }, [selectOnMount]);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      const container = containerRef.current;
      if (!container) return;
      if (container.contains(e.target as Node)) return;
      onCancelRef.current();
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value) {
      onCancel();
      return;
    }
    void onCommit(trimmed);
  };

  return (
    <div ref={containerRef} className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        className="flex-1 bg-frame-bg border border-frame-accent rounded px-1.5 py-0.5 text-sm font-medium text-white outline-none focus:ring-1 focus:ring-frame-accent"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <button
        type="button"
        title="Confirm"
        onClick={commit}
        className="p-1 rounded hover:bg-frame-accent/20 text-frame-accent"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        title="Cancel"
        onClick={onCancel}
        className="p-1 rounded hover:bg-frame-border text-frame-textMuted"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
