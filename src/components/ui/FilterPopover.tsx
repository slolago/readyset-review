'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterPopoverProps {
  label: string;
  /** Non-zero renders a count badge on the trigger. */
  activeCount?: number;
  children: ReactNode;
  /** Panel width in px. Default 280. */
  panelWidth?: number;
  className?: string;
}

/**
 * Trigger button + floating panel with viewport-aware positioning — same flip
 * pattern as ContextMenu / Dropdown. Used by the /assets filter toolbar to
 * host per-filter controls (checkbox list, range input, etc.) without
 * cluttering the page with stacked state.
 */
export function FilterPopover({
  label,
  activeCount = 0,
  children,
  panelWidth = 280,
  className,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [measured, setMeasured] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && triggerRef.current) {
      setRect(triggerRef.current.getBoundingClientRect());
      setMeasured(false);
    }
  }, [open]);

  // Measure natural panel height + clamp to viewport so the panel always
  // renders fully visible regardless of where the trigger sits on the page.
  useLayoutEffect(() => {
    if (!open || !rect || !panelRef.current) return;
    const pad = 8;
    const panelEl = panelRef.current;
    const naturalHeight = Math.max(
      panelEl.getBoundingClientRect().height,
      panelEl.scrollHeight,
    );

    const spaceBelow = window.innerHeight - rect.bottom - 6 - pad;
    const spaceAbove = rect.top - 6 - pad;

    let top: number;
    if (naturalHeight <= spaceBelow) {
      top = rect.bottom + 6;
    } else if (naturalHeight <= spaceAbove) {
      top = rect.top - 6 - naturalHeight;
    } else {
      top = spaceAbove > spaceBelow ? pad : rect.bottom + 6;
    }
    top = Math.max(pad, Math.min(top, window.innerHeight - naturalHeight - pad));

    // Horizontal: align the panel's left with the trigger's left, but clamp
    // so it never pokes past the right viewport edge.
    let left = rect.left;
    if (left + panelWidth + pad > window.innerWidth) {
      left = window.innerWidth - panelWidth - pad;
    }
    left = Math.max(pad, left);

    setPos({ top, left });
    setMeasured(true);
  }, [open, rect, panelWidth]);

  // Click-away + Escape to close.
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const active = activeCount > 0;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
          active
            ? 'bg-scope-accent/15 text-scope-accent border border-scope-accent/40'
            : 'bg-scope-card border border-scope-border text-scope-textSecondary hover:text-white hover:border-scope-borderLight',
          className,
        )}
      >
        <span>{label}</span>
        {active && (
          <span className="px-1.5 py-0.5 rounded-full bg-scope-accent text-white text-[10px] font-semibold leading-none">
            {activeCount}
          </span>
        )}
        <ChevronDown
          className={cn('w-3 h-3 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && rect && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            style={{
              position: 'fixed',
              top: measured ? pos.top : rect.bottom + 6,
              left: measured ? pos.left : rect.left,
              width: panelWidth,
              maxHeight: measured ? `${window.innerHeight - 16}px` : undefined,
              zIndex: 9999,
              visibility: measured ? 'visible' : 'hidden',
            }}
            className="bg-scope-card border border-scope-border rounded-xl shadow-2xl overflow-hidden animate-fade-in"
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
