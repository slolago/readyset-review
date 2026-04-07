'use client';

import { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { cn } from '@/lib/utils';

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  dividerBefore?: boolean;
  disabled?: boolean;
  danger?: boolean;
}

interface ContextMenuProps {
  items: MenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleScroll = () => onClose();

    // Defer listener registration to next tick so the opening mousedown
    // (which triggered this render) does not immediately fire onClose.
    const timerId = setTimeout(() => {
      document.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('blur', onClose);
    }, 0);

    return () => {
      clearTimeout(timerId);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  // Viewport-edge flip
  const MENU_W = 200;
  const MENU_H = items.length * 36 + items.filter(i => i.dividerBefore).length * 8 + 16;
  const x = position.x + MENU_W > window.innerWidth ? position.x - MENU_W : position.x;
  const y = position.y + MENU_H > window.innerHeight ? position.y - MENU_H : position.y;

  const menu = (
    <div
      ref={ref}
      style={{ position: 'fixed', left: x, top: y, zIndex: 9999 }}
      className="bg-frame-card border border-frame-border rounded-xl shadow-2xl py-1 min-w-[160px] animate-fade-in"
    >
      {items.map((item, i) => (
        <div key={i}>
          {item.dividerBefore && i > 0 && (
            <div className="my-1 border-t border-frame-border" />
          )}
          <button
            disabled={item.disabled}
            onClick={() => { item.onClick(); onClose(); }}
            className={cn(
              'w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left',
              item.danger
                ? 'text-red-400 hover:bg-red-500/10'
                : 'text-frame-textSecondary hover:text-white hover:bg-frame-cardHover',
              item.disabled && 'opacity-40 cursor-not-allowed'
            )}
          >
            {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );

  return ReactDOM.createPortal(menu, document.body);
}
