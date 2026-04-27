'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import type { Asset, Folder } from '@/types';

function formatDeletedAt(ts: unknown): string {
  if (!ts || typeof ts !== 'object') return '';
  const t = ts as { toDate?: () => Date; _seconds?: number; seconds?: number };
  if (typeof t.toDate === 'function') return t.toDate().toLocaleString();
  if (typeof t._seconds === 'number') return new Date(t._seconds * 1000).toLocaleString();
  if (typeof t.seconds === 'number') return new Date(t.seconds * 1000).toLocaleString();
  return '';
}

export default function TrashPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { getIdToken } = useAuth();
  const confirm = useConfirm();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/projects/${projectId}/trash`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets || []);
        setFolders(data.folders || []);
      } else {
        toast.error('Failed to load trash');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, getIdToken]);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  async function handleRestore(type: 'asset' | 'folder', id: string) {
    if (busy) return;
    setBusy(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/trash/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type, id }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.reparentedToRoot ? 'Restored to project root' : 'Restored');
        fetchTrash();
      } else {
        toast.error('Restore failed');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handlePermanentDelete(
    type: 'asset' | 'folder',
    id: string,
    name: string
  ) {
    if (busy) return;
    const ok = await confirm({
      title: `Permanently delete ${name}?`,
      message:
        type === 'folder'
          ? 'The folder and every asset inside it will be removed from storage. This cannot be undone.'
          : 'The file will be removed from storage. This cannot be undone.',
      destructive: true,
      confirmLabel: 'Delete forever',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/trash/permanent-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type, id }),
      });
      if (res.ok) {
        toast.success('Deleted');
        fetchTrash();
      } else {
        toast.error('Delete failed');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleEmptyTrash() {
    if (busy) return;
    const ok = await confirm({
      title: 'Empty Trash?',
      message: `Permanently delete ${folders.length} folder(s) and ${assets.length} asset(s). This cannot be undone.`,
      destructive: true,
      confirmLabel: 'Empty Trash',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/trash/empty', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId }),
      });
      if (res.ok) {
        toast.success('Trash emptied');
        fetchTrash();
      } else {
        toast.error('Empty trash failed');
      }
    } finally {
      setBusy(false);
    }
  }

  const isEmpty = assets.length === 0 && folders.length === 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-white">Trash</h1>
        <button
          onClick={handleEmptyTrash}
          disabled={isEmpty || busy}
          className="px-3 py-1.5 rounded bg-red-600 text-white text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700 transition-colors"
        >
          Empty Trash
        </button>
      </div>

      {loading && <p className="text-scope-textMuted">Loading…</p>}
      {!loading && isEmpty && (
        <p className="text-scope-textMuted">Trash is empty.</p>
      )}

      {folders.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg text-white mb-2">Folders</h2>
          <ul className="divide-y divide-white/10 border border-white/10 rounded">
            {folders.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between py-2 px-3"
              >
                <div className="min-w-0 pr-3">
                  <div className="text-white truncate">{f.name}</div>
                  <div className="text-xs text-scope-textMuted">
                    Deleted {formatDeletedAt((f as unknown as { deletedAt?: unknown }).deletedAt)}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleRestore('folder', f.id)}
                    disabled={busy}
                    className="px-3 py-1 rounded bg-white/10 text-white text-sm hover:bg-white/20 disabled:opacity-40 transition-colors"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => handlePermanentDelete('folder', f.id, f.name)}
                    disabled={busy}
                    className="px-3 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-40 transition-colors"
                  >
                    Delete forever
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {assets.length > 0 && (
        <section>
          <h2 className="text-lg text-white mb-2">Assets</h2>
          <ul className="divide-y divide-white/10 border border-white/10 rounded">
            {assets.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between py-2 px-3"
              >
                <div className="min-w-0 pr-3">
                  <div className="text-white truncate">{a.name}</div>
                  <div className="text-xs text-scope-textMuted">
                    Deleted {formatDeletedAt((a as unknown as { deletedAt?: unknown }).deletedAt)}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleRestore('asset', a.id)}
                    disabled={busy}
                    className="px-3 py-1 rounded bg-white/10 text-white text-sm hover:bg-white/20 disabled:opacity-40 transition-colors"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => handlePermanentDelete('asset', a.id, a.name)}
                    disabled={busy}
                    className="px-3 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-40 transition-colors"
                  >
                    Delete forever
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
