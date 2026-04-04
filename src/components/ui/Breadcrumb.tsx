'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbProps {
  items: Array<{ id: string | null; name: string }>;
  projectId: string;
  projectColor?: string;
}

export function Breadcrumb({ items, projectId, projectColor = '#7a00df' }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const isRoot = i === 0;
        const href = item.id
          ? `/projects/${projectId}/folders/${item.id}`
          : `/projects/${projectId}`;

        return (
          <span key={item.id ?? 'root'} className="flex items-center gap-1 flex-shrink-0">
            {i > 0 && <ChevronRight className="w-4 h-4 text-frame-textMuted" />}
            {isLast ? (
              <span className="flex items-center gap-1.5 text-white font-medium">
                {isRoot && (
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center"
                    style={{ backgroundColor: projectColor + '20', color: projectColor }}
                  >
                    <Home className="w-3 h-3" />
                  </div>
                )}
                {item.name}
              </span>
            ) : (
              <Link
                href={href}
                className="flex items-center gap-1.5 text-frame-textSecondary hover:text-white transition-colors"
              >
                {isRoot && (
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center"
                    style={{ backgroundColor: projectColor + '20', color: projectColor }}
                  >
                    <Home className="w-3 h-3" />
                  </div>
                )}
                {item.name}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
