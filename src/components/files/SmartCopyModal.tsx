'use client';

import { useState } from 'react';
import { Home, Folder as FolderIcon, X, Info } from 'lucide-react';
import type { Folder } from '@/types';

interface SmartCopyModalProps {
  folders: Folder[];
  versionCount: number;
  onPick: (folderId: string | null, latestVersionOnly: boolean) => void;
  onClose: () => void;
}

export function SmartCopyModal({ folders, versionCount, onPick, onClose }: SmartCopyModalProps) {
  const [latestVersionOnly, setLatestVersionOnly] = useState(versionCount > 1);

  const buildTree = (parentId: string | null, depth: number): { folder: Folder; depth: number }[] => {
    const children = folders.filter((f) => (f.parentId ?? null) === parentId);
    const result: { folder: Folder; depth: number }[] = [];
    for (const child of children) {
      result.push({ folder: child, depth });
      result.push(...buildTree(child.id, depth + 1));
    }
    return result;
  };
  const tree = buildTree(null, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-scope-card border border-scope-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-scope-border">
          <h3 className="text-sm font-semibold text-white">Copy to folder</h3>
          <button onClick={onClose} className="text-scope-textMuted hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {versionCount > 1 && (
          <div className="px-5 py-3 border-b border-scope-border flex items-center justify-between">
            <span className="text-sm text-white">Latest version only</span>
            <button
              role="switch"
              aria-checked={latestVersionOnly}
              aria-label="Copy latest version only"
              onClick={() => setLatestVersionOnly(!latestVersionOnly)}
              className={`w-9 h-5 rounded-full transition-colors relative ${latestVersionOnly ? 'bg-scope-accent' : 'bg-scope-border'}`}
            >
              <span
                className={`block w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                  latestVersionOnly ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        )}

        <div className="max-h-56 overflow-y-auto py-2">
          <button
            onClick={() => onPick(null, latestVersionOnly)}
            className="w-full flex items-center gap-2 px-5 py-2.5 text-sm text-scope-textSecondary hover:text-white hover:bg-scope-border/50 transition-colors text-left"
          >
            <Home className="w-4 h-4 flex-shrink-0" />
            <span>Project root</span>
          </button>
          {tree.map(({ folder, depth }) => (
            <button
              key={folder.id}
              onClick={() => onPick(folder.id, latestVersionOnly)}
              className="w-full flex items-center gap-2 px-5 py-2.5 text-sm text-scope-textSecondary hover:text-white hover:bg-scope-border/50 transition-colors text-left"
              style={{ paddingLeft: `${20 + depth * 16}px` }}
            >
              <FolderIcon className="w-4 h-4 flex-shrink-0 text-scope-accent" />
              <span className="truncate">{folder.name}</span>
            </button>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-scope-border">
          <p className="text-xs text-scope-textMuted flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Comments are not copied to the destination folder.
          </p>
        </div>
      </div>
    </div>
  );
}
