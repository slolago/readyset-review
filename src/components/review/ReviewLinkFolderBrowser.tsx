'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutGrid, LayoutList, ChevronRight, Folder as FolderIcon, Home } from 'lucide-react';
import { AssetCard } from '@/components/files/AssetCard';
import { AssetListView } from '@/components/files/AssetListView';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import type { Asset, Folder, ReviewLink } from '@/types';
import Link from 'next/link';

interface ReviewLinkFolderBrowserProps {
  projectId: string;
  token: string;
}

export function ReviewLinkFolderBrowser({ projectId, token }: ReviewLinkFolderBrowserProps) {
  const router = useRouter();

  const viewModeKey = `view-mode-rl-${token}`;
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window === 'undefined') return 'grid';
    return (localStorage.getItem(viewModeKey) as 'grid' | 'list') ?? 'grid';
  });

  useEffect(() => {
    localStorage.setItem(viewModeKey, viewMode);
  }, [viewModeKey, viewMode]);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [reviewLink, setReviewLink] = useState<ReviewLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [crumbs, setCrumbs] = useState<Array<{ id: string | null; name: string }>>([{ id: null, name: 'All' }]);
  const currentFolderId = crumbs[crumbs.length - 1].id;

  const load = useCallback(async (folderId: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (folderId) qs.set('folder', folderId);
      const res = await fetch(`/api/review-links/${token}?${qs}`);
      if (res.status === 401) {
        setError('This review link is password-protected. Open the public link to view it.');
        return;
      }
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setReviewLink(data.reviewLink);
      setAssets(data.assets ?? []);
      setFolders(data.folders ?? []);
    } catch {
      setError('Failed to load review link contents.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(null); }, [load]);

  const enterFolder = async (folder: Folder) => {
    setCrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    await load(folder.id);
  };

  const jumpToCrumb = async (index: number) => {
    const crumb = crumbs[index];
    setCrumbs(crumbs.slice(0, index + 1));
    await load(crumb.id);
  };

  const scopeLabel = reviewLink
    ? reviewLink.assetIds?.length
      ? `Selection · ${reviewLink.assetIds.length} asset${reviewLink.assetIds.length !== 1 ? 's' : ''}`
      : reviewLink.folderIds?.length
      ? `Curated · ${reviewLink.folderIds.length} folder${reviewLink.folderIds.length !== 1 ? 's' : ''}`
      : reviewLink.folderId
      ? 'Folder share'
      : 'Project share'
    : '';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-4 border-b border-scope-border flex items-center justify-between gap-4">
        <nav className="flex items-center gap-1 text-sm overflow-x-auto min-w-0">
          <Link
            href={`/projects/${projectId}/review-links`}
            className="text-scope-textSecondary hover:text-white transition-colors flex-shrink-0"
          >
            Review Links
          </Link>
          <ChevronRight className="w-4 h-4 text-scope-textMuted flex-shrink-0" />
          <span className="text-white font-medium flex-shrink-0 truncate max-w-[20ch]">
            {reviewLink?.name ?? token}
          </span>
          {reviewLink && (
            <span className="ml-2 text-xs text-scope-textMuted flex-shrink-0">
              ({scopeLabel})
            </span>
          )}
        </nav>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            title="Grid view"
            className={cn(
              'p-1.5 rounded transition-colors',
              viewMode === 'grid' ? 'text-white bg-scope-border' : 'text-scope-textMuted hover:text-white'
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            title="List view"
            className={cn(
              'p-1.5 rounded transition-colors',
              viewMode === 'list' ? 'text-white bg-scope-border' : 'text-scope-textMuted hover:text-white'
            )}
          >
            <LayoutList className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Folder breadcrumbs (when navigated into a folder) */}
      {crumbs.length > 1 && (
        <div className="px-8 py-2 border-b border-scope-border flex items-center gap-1 text-sm flex-wrap">
          {crumbs.map((crumb, i) => (
            <div key={`${crumb.id ?? 'root'}-${i}`} className="flex items-center gap-1">
              <button
                onClick={() => i < crumbs.length - 1 && jumpToCrumb(i)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
                  i === crumbs.length - 1
                    ? 'text-white font-medium'
                    : 'text-scope-textSecondary hover:text-white hover:bg-scope-cardHover'
                }`}
              >
                {i === 0 && <Home className="w-3.5 h-3.5" />}
                {crumb.name}
              </button>
              {i < crumbs.length - 1 && <ChevronRight className="w-3 h-3 text-scope-textMuted" />}
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-scope-textMuted text-sm">{error}</p>
          </div>
        ) : assets.length === 0 && folders.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-scope-textMuted text-sm">
              {currentFolderId ? 'This folder is empty' : 'No assets in this review link'}
            </p>
          </div>
        ) : (
          <>
            {/* Folders */}
            {folders.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-scope-textMuted uppercase tracking-wider mb-3">
                  Folders ({folders.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => enterFolder(folder)}
                      className="group bg-scope-card hover:bg-scope-cardHover border border-scope-border hover:border-scope-borderLight rounded-xl p-4 transition-all text-left"
                    >
                      <FolderIcon className="w-8 h-8 text-scope-accent mb-2" />
                      <p className="text-sm font-medium text-white truncate">{folder.name}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Assets */}
            {assets.length > 0 && (
              viewMode === 'grid' ? (
                <div>
                  {folders.length > 0 && (
                    <h3 className="text-xs font-semibold text-scope-textMuted uppercase tracking-wider mb-3">
                      Assets ({assets.filter((a: any) => !a._deleted).length})
                    </h3>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {assets.map((asset: any) =>
                      asset._deleted ? (
                        <div
                          key={asset.id}
                          className="aspect-video bg-scope-card border border-dashed border-scope-border/50 rounded-xl flex flex-col items-center justify-center gap-2 opacity-40"
                        >
                          <p className="text-xs text-scope-textMuted">Asset removed</p>
                        </div>
                      ) : (
                        <AssetCard
                          key={asset.id}
                          asset={asset}
                          onClick={() => router.push(`/projects/${projectId}/assets/${asset.id}`)}
                          hideActions
                        />
                      )
                    )}
                  </div>
                </div>
              ) : (
                <AssetListView
                  assets={assets.filter((a: any) => !a._deleted)}
                  projectId={projectId}
                />
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
