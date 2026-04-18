'use client';

import { useEffect, useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { Folder as FolderIcon, ChevronRight, Check, Search, Film, Image as ImageIcon, Home } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import type { Asset, Folder } from '@/types';

interface AddFromProjectModalProps {
  projectId: string;
  token: string;                     // review link token
  /** IDs already in the link — shown as "Already added", disabled. */
  existingAssetIds: Set<string>;
  existingFolderIds: Set<string>;
  onClose: () => void;
  onSaved: () => void;               // called after successful PATCH
}

export function AddFromProjectModal({
  projectId, token, existingAssetIds, existingFolderIds, onClose, onSaved,
}: AddFromProjectModalProps) {
  const { getIdToken } = useAuth();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string | null; name: string }>>([{ id: null, name: 'Root' }]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pendingAssets, setPendingAssets] = useState<Set<string>>(new Set());
  const [pendingFolders, setPendingFolders] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const fetchLevel = useCallback(async (folderId: string | null) => {
    setLoading(true);
    try {
      const authToken = await getIdToken();
      const [foldersRes, assetsRes] = await Promise.all([
        fetch(`/api/folders?projectId=${projectId}${folderId ? `&parentId=${folderId}` : ''}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch(`/api/assets?projectId=${projectId}${folderId ? `&folderId=${folderId}` : ''}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
      ]);
      if (foldersRes.ok) {
        const d = await foldersRes.json();
        setFolders(d.folders ?? []);
      }
      if (assetsRes.ok) {
        const d = await assetsRes.json();
        setAssets(d.assets ?? []);
      }
    } catch {
      toast.error('Failed to load folder');
    } finally {
      setLoading(false);
    }
  }, [projectId, getIdToken]);

  useEffect(() => { fetchLevel(currentFolderId); }, [currentFolderId, fetchLevel]);

  const enterFolder = (f: Folder) => {
    setCurrentFolderId(f.id);
    setBreadcrumbs((prev) => [...prev, { id: f.id, name: f.name }]);
  };
  const jumpToCrumb = (index: number) => {
    const crumb = breadcrumbs[index];
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    setCurrentFolderId(crumb.id);
  };

  const toggleAsset = (id: string) => {
    if (existingAssetIds.has(id)) return;
    setPendingAssets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleFolder = (id: string) => {
    if (existingFolderIds.has(id)) return;
    setPendingFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const totalPending = pendingAssets.size + pendingFolders.size;

  const handleSave = async () => {
    if (!totalPending) return;
    setSaving(true);
    try {
      const authToken = await getIdToken();
      const res = await fetch(`/api/review-links/${token}/contents`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          addAssetIds: Array.from(pendingAssets),
          addFolderIds: Array.from(pendingFolders),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'Failed to add items');
      }
      toast.success(`Added ${totalPending} item${totalPending !== 1 ? 's' : ''}`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const filteredFolders = folders.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));
  const filteredAssets = assets.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal isOpen onClose={onClose} title="Add from project" size="lg">
      <div className="space-y-3">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-sm flex-wrap">
          {breadcrumbs.map((crumb, i) => (
            <div key={`${crumb.id ?? 'root'}-${i}`} className="flex items-center gap-1">
              <button
                onClick={() => jumpToCrumb(i)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded hover:bg-frame-cardHover transition-colors ${
                  i === breadcrumbs.length - 1 ? 'text-white font-medium' : 'text-frame-textSecondary'
                }`}
              >
                {i === 0 ? <Home className="w-3.5 h-3.5" /> : null}
                {crumb.name}
              </button>
              {i < breadcrumbs.length - 1 && <ChevronRight className="w-3 h-3 text-frame-textMuted" />}
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-frame-textMuted" />
          <input
            type="text"
            placeholder="Search this folder..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-frame-bg border border-frame-border rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-frame-textMuted focus:outline-none focus:border-frame-accent transition-colors"
          />
        </div>

        {/* Listing */}
        <div className="max-h-[50vh] overflow-y-auto -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner size="sm" />
            </div>
          ) : filteredFolders.length === 0 && filteredAssets.length === 0 ? (
            <div className="text-center py-10 text-xs text-frame-textMuted">
              {search ? 'Nothing matches your search' : 'This folder is empty'}
            </div>
          ) : (
            <div className="space-y-1">
              {/* Folders */}
              {filteredFolders.map((f) => {
                const alreadyAdded = existingFolderIds.has(f.id);
                const isPending = pendingFolders.has(f.id);
                return (
                  <div
                    key={f.id}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors ${
                      alreadyAdded
                        ? 'opacity-50'
                        : isPending
                        ? 'bg-frame-accent/10'
                        : 'hover:bg-frame-cardHover'
                    }`}
                  >
                    <button
                      onClick={() => toggleFolder(f.id)}
                      disabled={alreadyAdded}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        alreadyAdded
                          ? 'bg-frame-border border-frame-border'
                          : isPending
                          ? 'bg-frame-accent border-frame-accent'
                          : 'border-frame-borderLight hover:border-frame-accent'
                      }`}
                    >
                      {(alreadyAdded || isPending) && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </button>
                    <button
                      onClick={() => enterFolder(f)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    >
                      <FolderIcon className="w-4 h-4 text-frame-accent flex-shrink-0" />
                      <span className="text-sm text-white truncate">{f.name}</span>
                      {alreadyAdded && <span className="text-[10px] uppercase text-frame-textMuted ml-1">Already added</span>}
                      <ChevronRight className="w-3.5 h-3.5 text-frame-textMuted ml-auto" />
                    </button>
                  </div>
                );
              })}

              {/* Assets */}
              {filteredAssets.map((a) => {
                const alreadyAdded = existingAssetIds.has(a.id);
                const isPending = pendingAssets.has(a.id);
                const thumb = (a as any).thumbnailSignedUrl as string | undefined;
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleAsset(a.id)}
                    disabled={alreadyAdded}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left ${
                      alreadyAdded
                        ? 'opacity-50 cursor-not-allowed'
                        : isPending
                        ? 'bg-frame-accent/10'
                        : 'hover:bg-frame-cardHover'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        alreadyAdded
                          ? 'bg-frame-border border-frame-border'
                          : isPending
                          ? 'bg-frame-accent border-frame-accent'
                          : 'border-frame-borderLight'
                      }`}
                    >
                      {(alreadyAdded || isPending) && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                    <div className="w-10 h-7 rounded overflow-hidden bg-frame-bg flex-shrink-0 flex items-center justify-center">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="w-full h-full object-cover" />
                      ) : a.type === 'video' ? (
                        <Film className="w-3.5 h-3.5 text-frame-textMuted" />
                      ) : (
                        <ImageIcon className="w-3.5 h-3.5 text-frame-textMuted" />
                      )}
                    </div>
                    <span className="text-sm text-white truncate flex-1">{a.name}</span>
                    {alreadyAdded && <span className="text-[10px] uppercase text-frame-textMuted ml-1">Already added</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-frame-border">
          <p className="text-xs text-frame-textMuted">
            {totalPending > 0 ? `${totalPending} item${totalPending !== 1 ? 's' : ''} selected` : 'Select items to add'}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={!totalPending || saving} loading={saving}>
              Add {totalPending || ''}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
