'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Link as LinkIcon } from 'lucide-react';
import { useProjectTree } from '@/hooks/useProjectTree';
import { cn } from '@/lib/utils';

/**
 * Tree-style sidebar nav (think VS Code / Figma file tree).
 *
 * Design rules:
 *  - No per-row borders — they made every project look like a separate card
 *    and the sidebar felt cramped. Selection is signaled via a left accent
 *    bar + subtle background tint, which is the tree-view convention.
 *  - Parent-of-selected (e.g. project containing the open folder) gets a
 *    muted accent bar so the path from root to current location is readable
 *    at a glance.
 */
export function ProjectTreeNav() {
  const { treeNodes, toggleProject } = useProjectTree();
  const pathname = usePathname();

  return (
    <div className="overflow-y-auto flex-1 px-1 pb-4">
      <p className="text-xs font-semibold text-frame-textMuted uppercase tracking-wider px-2 mb-1.5 mt-3">
        Projects
      </p>

      {treeNodes.map(({ project, folders, foldersLoaded, expanded }) => {
        const projectPath = `/projects/${project.id}`;
        const isProjectSelected = pathname === projectPath;
        const isProjectActive =
          pathname === projectPath || pathname.startsWith(`${projectPath}/`);
        const isProjectParentOfSelected = isProjectActive && !isProjectSelected;

        return (
          <div key={project.id} className="mb-0.5">
            {/* Project row */}
            <div
              className={cn(
                'group flex items-center gap-0.5 rounded relative',
                // Left accent bar for hierarchy signaling
                isProjectSelected &&
                  'before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-frame-accent before:rounded-r',
                isProjectParentOfSelected &&
                  'before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-frame-accent/40 before:rounded-r'
              )}
            >
              <button
                onClick={() => toggleProject(project.id)}
                className="flex-shrink-0 p-1 rounded hover:bg-white/5 transition-colors"
                aria-label={expanded ? 'Collapse project' : 'Expand project'}
              >
                <ChevronRight
                  className={cn(
                    'w-3.5 h-3.5 text-frame-textMuted transition-transform duration-150',
                    expanded && 'rotate-90'
                  )}
                />
              </button>

              <Link
                href={projectPath}
                className={cn(
                  'flex-1 py-1 px-1.5 rounded text-sm truncate transition-colors',
                  isProjectSelected
                    ? 'bg-frame-accent/15 text-white font-medium'
                    : isProjectParentOfSelected
                    ? 'text-white hover:bg-white/5'
                    : 'text-frame-textSecondary hover:bg-white/5 hover:text-white'
                )}
              >
                {project.name}
              </Link>
            </div>

            {/* Folder rows */}
            {expanded && (
              <div className="ml-3 border-l border-frame-border/40 pl-1 mt-0.5 space-y-0.5">
                {!foldersLoaded ? (
                  <div
                    className="w-3 h-3 border border-frame-accent/40 border-t-frame-accent rounded-full animate-spin ml-3 my-1"
                    aria-label="Loading folders"
                  />
                ) : folders.length === 0 ? (
                  <span className="pl-3 text-xs text-frame-textMuted/70 italic">
                    No folders
                  </span>
                ) : (
                  folders.map((folder) => {
                    const folderPath = `/projects/${project.id}/folders/${folder.id}`;
                    const isFolderActive = pathname === folderPath;
                    return (
                      <Link
                        key={folder.id}
                        href={folderPath}
                        className={cn(
                          'block pl-3 py-1 pr-1.5 text-sm rounded truncate transition-colors',
                          isFolderActive
                            ? 'bg-frame-accent/15 text-white font-medium'
                            : 'text-frame-textSecondary hover:bg-white/5 hover:text-white'
                        )}
                      >
                        {folder.name}
                      </Link>
                    );
                  })
                )}

                {foldersLoaded && (
                  <Link
                    href={`/projects/${project.id}/review-links`}
                    className={cn(
                      'flex items-center gap-1.5 pl-3 py-1 pr-1.5 text-xs rounded truncate transition-colors',
                      pathname.startsWith(`/projects/${project.id}/review-links`)
                        ? 'bg-frame-accent/15 text-white font-medium'
                        : 'text-frame-textMuted hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <LinkIcon className="w-3 h-3 flex-shrink-0" />
                    Review Links
                  </Link>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
