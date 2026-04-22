'use client';

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
  divider?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export function Dropdown({ trigger, items, align = 'right', className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number }>({ top: 0 });
  const [measured, setMeasured] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const wasOpenRef = useRef(false);

  // Compute trigger position when opening + reset active index
  useEffect(() => {
    if (open && triggerRef.current) {
      setRect(triggerRef.current.getBoundingClientRect());
      setActiveIndex(0);
      setMeasured(false);
    } else if (!open) {
      setActiveIndex(-1);
    }
  }, [open]);

  // Same pattern as the right-click ContextMenu: measure the panel's
  // natural content height with useLayoutEffect (synchronous, before paint)
  // and compute a pixel `top` that keeps the panel inside the viewport.
  // No maxHeight/overflow applied during measurement — that would clamp
  // the measured height and defeat the flip check. Clamp is done AFTER
  // deciding flip direction.
  useLayoutEffect(() => {
    if (!open || !rect || !panelRef.current) return;
    const pad = 8;
    const panelEl = panelRef.current;
    const panelRect = panelEl.getBoundingClientRect();
    // Natural content height (in case overflow shrunk the box to fit below).
    const naturalHeight = Math.max(panelRect.height, panelEl.scrollHeight);
    const spaceBelow = window.innerHeight - rect.bottom - 6 - pad;
    const spaceAbove = rect.top - 6 - pad;

    let top: number;
    if (naturalHeight <= spaceBelow) {
      // Fits below — standard drop-down.
      top = rect.bottom + 6;
    } else if (naturalHeight <= spaceAbove) {
      // Doesn't fit below but fits above — flip up, bottom edge at trigger top.
      top = rect.top - 6 - naturalHeight;
    } else {
      // Doesn't fit either way — pick the side with more room and clamp.
      if (spaceAbove > spaceBelow) {
        top = pad;
      } else {
        top = rect.bottom + 6;
      }
    }
    // Final clamp so we never render above 0 or below viewport bottom.
    top = Math.max(pad, Math.min(top, window.innerHeight - naturalHeight - pad));

    const horizontal: { left?: number; right?: number } =
      align === 'right'
        ? { right: window.innerWidth - rect.right }
        : { left: rect.left };

    setPos({ top, ...horizontal });
    setMeasured(true);
  }, [open, rect, items.length, align]);

  // Focus active item when it changes (roving tabindex)
  useEffect(() => {
    if (open && activeIndex >= 0) {
      itemRefs.current[activeIndex]?.focus();
    }
  }, [open, activeIndex]);

  // Return focus to trigger when closing (but not on initial mount)
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      return;
    }
    if (wasOpenRef.current) {
      triggerRef.current?.focus();
    }
  }, [open]);

  // Outside-click and scroll/resize handling
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = triggerRef.current?.contains(target) ?? false;
      const insidePanel = panelRef.current?.contains(target) ?? false;
      if (!insideTrigger && !insidePanel) {
        setOpen(false);
      }
    };
    const handleClose = () => setOpen(false);
    const handleScroll = (e: Event) => {
      const target = e.target as Node;
      const insidePanel = panelRef.current?.contains(target) ?? false;
      if (!insidePanel) setOpen(false);
    };

    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('scroll', handleScroll, { capture: true });
    window.addEventListener('resize', handleClose);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('scroll', handleScroll, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', handleClose);
    };
  }, []);

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const handlePanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (items.length === 0) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % items.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + items.length) % items.length);
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(items.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < items.length) {
          items[activeIndex].onClick();
          setOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      default:
        break;
    }
  };

  const panel =
    open && rect && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            role="menu"
            onKeyDown={handlePanelKeyDown}
            style={{
              position: 'fixed',
              // First paint: anchor to trigger bottom + invisible so we can
              // measure the NATURAL panel height before deciding the final
              // position. useLayoutEffect above fires synchronously before
              // paint, so the user never sees the pre-flip position.
              top: measured ? pos.top : rect.bottom + 6,
              ...(measured
                ? ('left' in pos && pos.left !== undefined
                    ? { left: pos.left }
                    : 'right' in pos && pos.right !== undefined
                      ? { right: pos.right }
                      : {})
                : align === 'right'
                  ? { right: window.innerWidth - rect.right }
                  : { left: rect.left }),
              // maxHeight kicks in only AFTER measuring — if the menu
              // doesn't fit either above or below (very short viewport),
              // cap + scroll. Keeping it off during measurement is critical,
              // otherwise the measured height is capped and the flip logic
              // can't see the real overflow.
              ...(measured
                ? { maxHeight: `${window.innerHeight - 16}px`, overflowY: 'auto' as const }
                : {}),
              zIndex: 9999,
              visibility: measured ? 'visible' : 'hidden',
            }}
            className="bg-frame-card border border-frame-border rounded-xl shadow-2xl py-1 min-w-[160px] animate-fade-in"
          >
            {items.map((item, i) => (
              <React.Fragment key={i}>
                {item.divider && i > 0 && (
                  <div className="my-1 border-t border-frame-border" />
                )}
                <button
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => {
                    item.onClick();
                    setOpen(false);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left outline-none',
                    item.danger
                      ? 'text-red-400 hover:bg-red-500/10 focus:bg-red-500/10'
                      : 'text-frame-textSecondary hover:text-white hover:bg-frame-cardHover focus:text-white focus:bg-frame-cardHover'
                  )}
                >
                  {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                  {item.label}
                </button>
              </React.Fragment>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn('relative inline-block', className)}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleTriggerKeyDown}
      >
        {trigger}
      </button>
      {panel}
    </>
  );
}
