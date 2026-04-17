'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { ChevronRight, Home, MoreHorizontal } from 'lucide-react';

interface BreadcrumbProps {
  items: Array<{ id: string | null; name: string }>;
  projectId: string;
  projectColor?: string;
}

// When the path has more than COLLAPSE_THRESHOLD items, middle items
// collapse behind a ⋯ dropdown. Always shows: root, [...], parent, current.
const COLLAPSE_THRESHOLD = 5;

export function Breadcrumb({ items, projectId, projectColor = '#7a00df' }: BreadcrumbProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Compute which items are visible vs collapsed
  const useCollapsed = items.length > COLLAPSE_THRESHOLD;
  const visibleItems = useCollapsed
    ? [items[0], ...items.slice(-2)] // root + parent + current
    : items;
  const collapsedItems = useCollapsed ? items.slice(1, -2) : [];

  const renderItem = (item: { id: string | null; name: string }, isLast: boolean, isRoot: boolean) => {
    const href = item.id
      ? `/projects/${projectId}/folders/${item.id}`
      : `/projects/${projectId}`;

    const homeIcon = isRoot && (
      <div
        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: projectColor + '20', color: projectColor }}
      >
        <Home className="w-3 h-3" />
      </div>
    );

    if (isLast) {
      return (
        <span className="flex items-center gap-1.5 text-white font-medium max-w-[200px] truncate" title={item.name}>
          {homeIcon}
          <span className="truncate">{item.name}</span>
        </span>
      );
    }
    return (
      <Link
        href={href}
        title={item.name}
        className="flex items-center gap-1.5 text-frame-textSecondary hover:text-white transition-colors max-w-[200px] truncate"
      >
        {homeIcon}
        <span className="truncate">{item.name}</span>
      </Link>
    );
  };

  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto">
      {visibleItems.map((item, visibleIdx) => {
        const originalIdx = useCollapsed
          ? (visibleIdx === 0 ? 0 : items.length - (visibleItems.length - visibleIdx))
          : visibleIdx;
        const isLast = originalIdx === items.length - 1;
        const isRoot = originalIdx === 0;
        const showCollapsedDropdown = useCollapsed && visibleIdx === 1;

        return (
          <span key={`${item.id ?? 'root'}-${visibleIdx}`} className="flex items-center gap-1 flex-shrink-0">
            {visibleIdx > 0 && <ChevronRight className="w-4 h-4 text-frame-textMuted" />}

            {/* Collapsed dropdown sits between root and the last two items */}
            {showCollapsedDropdown && collapsedItems.length > 0 && (
              <>
                <div ref={menuRef} className="relative">
                  <button
                    onClick={() => setOpen((v) => !v)}
                    title={`${collapsedItems.length} hidden folders`}
                    className="flex items-center justify-center w-6 h-6 rounded hover:bg-frame-border text-frame-textMuted hover:text-white transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {open && (
                    <div className="absolute top-full left-0 mt-1 min-w-[180px] max-w-[280px] bg-frame-card border border-frame-border rounded-lg shadow-xl overflow-hidden z-30">
                      {collapsedItems.map((c) => (
                        <Link
                          key={c.id ?? 'hidden-root'}
                          href={c.id ? `/projects/${projectId}/folders/${c.id}` : `/projects/${projectId}`}
                          onClick={() => setOpen(false)}
                          title={c.name}
                          className="block px-3 py-2 text-xs text-frame-textSecondary hover:text-white hover:bg-frame-cardHover transition-colors truncate"
                        >
                          {c.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-frame-textMuted" />
              </>
            )}

            {renderItem(item, isLast, isRoot)}
          </span>
        );
      })}
    </nav>
  );
}
