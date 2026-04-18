'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { Link as LinkIcon, Lock, Plus, Folder as FolderIcon, Layers, Search, Check } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';

interface ReviewLinkRow {
  id: string;
  token: string;
  name: string;
  folderId?: string | null;
  folderIds?: string[] | null;
  assetIds?: string[] | null;
  hasPassword?: boolean;
  createdAt?: any;
}

interface AddToReviewLinkModalProps {
  projectId: string;
  /** Asset IDs to append */
  assetIds?: string[];
  /** Folder IDs to append */
  folderIds?: string[];
  onClose: () => void;
  /** Called after a successful add with the link's token, so callers can route/toast. */
  onAdded?: (token: string) => void;
  /** Called when user clicks "Create new review link" — parent should open CreateReviewLinkModal. */
  onCreateNew: () => void;
}

function parseDate(raw: any): Date | null {
  if (!raw) return null;
  if (typeof raw.toDate === 'function') return raw.toDate();
  if (raw._seconds) return new Date(raw._seconds * 1000);
  return null;
}

export function AddToReviewLinkModal({
  projectId,
  assetIds,
  folderIds,
  onClose,
  onAdded,
  onCreateNew,
}: AddToReviewLinkModalProps) {
  const { getIdToken } = useAuth();
  const [links, setLinks] = useState<ReviewLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const token = await getIdToken();
        const res = await fetch(`/api/review-links?projectId=${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setLinks(data.links ?? []);
        } else {
          toast.error('Failed to load review links');
        }
      } catch {
        toast.error('Failed to load review links');
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, getIdToken]);

  const handleAddTo = async (link: ReviewLinkRow) => {
    setSaving(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/review-links/${link.token}/contents`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          addAssetIds: assetIds ?? [],
          addFolderIds: folderIds ?? [],
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'Failed to add to review link');
      }
      const parts: string[] = [];
      if (assetIds?.length) parts.push(`${assetIds.length} asset${assetIds.length !== 1 ? 's' : ''}`);
      if (folderIds?.length) parts.push(`${folderIds.length} folder${folderIds.length !== 1 ? 's' : ''}`);
      toast.success(`Added ${parts.join(' + ')} to "${link.name}"`);
      onAdded?.(link.token);
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = links.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));

  const countLabel = (() => {
    const parts: string[] = [];
    if (assetIds?.length) parts.push(`${assetIds.length} asset${assetIds.length !== 1 ? 's' : ''}`);
    if (folderIds?.length) parts.push(`${folderIds.length} folder${folderIds.length !== 1 ? 's' : ''}`);
    return parts.join(' + ');
  })();

  return (
    <Modal isOpen onClose={onClose} title="Add to review link" size="md">
      <div className="space-y-3">
        <p className="text-sm text-frame-textSecondary">
          Choose a review link to append <span className="text-white font-medium">{countLabel || 'selected items'}</span>.
        </p>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-frame-textMuted" />
          <input
            type="text"
            autoFocus
            placeholder="Search review links..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-frame-bg border border-frame-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-frame-textMuted focus:outline-none focus:border-frame-accent transition-colors"
          />
        </div>

        {/* Create new */}
        <button
          onClick={onCreateNew}
          className="w-full flex items-center gap-2.5 p-3 rounded-xl border border-dashed border-frame-border hover:border-frame-accent hover:bg-frame-accent/5 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-frame-accent/15 flex items-center justify-center flex-shrink-0">
            <Plus className="w-4 h-4 text-frame-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white">Create new review link</p>
            <p className="text-xs text-frame-textMuted">Start a fresh link with these items</p>
          </div>
        </button>

        {/* Existing links */}
        <div className="max-h-80 overflow-y-auto -mx-6 px-6 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="sm" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <LinkIcon className="w-6 h-6 text-frame-textMuted mx-auto mb-2" />
              <p className="text-xs text-frame-textMuted">
                {search ? 'No links match your search' : 'No review links yet for this project'}
              </p>
            </div>
          ) : (
            filtered.map((link) => {
              const totalItems =
                (link.assetIds?.length ?? 0) + (link.folderIds?.length ?? 0) + (link.folderId ? 1 : 0);
              const date = parseDate(link.createdAt);
              return (
                <button
                  key={link.token}
                  onClick={() => handleAddTo(link)}
                  disabled={saving}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-frame-cardHover transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div className="w-8 h-8 rounded-lg bg-frame-accent/10 border border-frame-accent/20 flex items-center justify-center flex-shrink-0">
                    <LinkIcon className="w-4 h-4 text-frame-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-white truncate">{link.name}</p>
                      {link.hasPassword && <Lock className="w-3 h-3 text-yellow-400 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-frame-textMuted mt-0.5">
                      {(link.folderIds?.length || link.folderId) ? (
                        <span className="flex items-center gap-1">
                          <FolderIcon className="w-3 h-3" />
                          {(link.folderIds?.length ?? 0) + (link.folderId ? 1 : 0)}
                        </span>
                      ) : null}
                      {link.assetIds?.length ? (
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          {link.assetIds.length}
                        </span>
                      ) : null}
                      {totalItems === 0 && <span>Whole project</span>}
                      {date && <span>· {formatRelativeTime(date)}</span>}
                    </div>
                  </div>
                  <Check className="w-4 h-4 text-frame-textMuted opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })
          )}
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
