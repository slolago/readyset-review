'use client';

import { useCallback, useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { RefreshCw, Ban, Trash2 } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import type { User } from '@/types';
import toast from 'react-hot-toast';

interface Props {
  getIdToken: () => Promise<string | null>;
}

function toDate(v: any): Date | null {
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  if (typeof v?._seconds === 'number') return new Date(v._seconds * 1000);
  return null;
}

export function OrphanUsersPanel({ getIdToken }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/admin/users/orphans', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error || 'Failed to load');
      }
      const data = await res.json();
      setUsers(data.users ?? []);
      setSelected(new Set());
      setConfirmBulkDelete(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.size === users.length ? new Set() : new Set(users.map((u) => u.id))));
  };

  const bulkSuspend = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const token = await getIdToken();
    const ids = Array.from(selected);
    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/admin/users/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ disabled: true }),
        }).then((r) => { if (!r.ok) throw new Error(); })
      )
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    const ok = ids.length - failed;
    if (ok > 0) toast.success(`${ok} user${ok === 1 ? '' : 's'} suspended`);
    if (failed > 0) toast.error(`${failed} failed`);
    setBulkBusy(false);
    load();
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirmBulkDelete) { setConfirmBulkDelete(true); return; }
    setBulkBusy(true);
    const token = await getIdToken();
    const ids = Array.from(selected);
    // Reuse the existing DELETE /api/admin/users endpoint (body: { userId })
    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch('/api/admin/users', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: id }),
        }).then((r) => { if (!r.ok) throw new Error(); })
      )
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    const ok = ids.length - failed;
    if (ok > 0) toast.success(`${ok} user${ok === 1 ? '' : 's'} deleted`);
    if (failed > 0) toast.error(`${failed} failed`);
    setBulkBusy(false);
    load();
  };

  const allSelected = users.length > 0 && selected.size === users.length;

  return (
    <div>
      {/* Header */}
      <div className="px-6 py-4 border-b border-frame-border flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-white font-medium">
            {loading ? 'Loading…' : `${users.length} orphan user${users.length === 1 ? '' : 's'}`}
          </p>
          <p className="text-xs text-frame-textMuted mt-0.5">
            Viewers never invited and not on any project.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={load} icon={<RefreshCw className="w-3.5 h-3.5" />}>
          Refresh
        </Button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="px-6 py-3 bg-frame-accent/5 border-b border-frame-border flex items-center justify-between gap-3">
          <span className="text-sm text-white">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={bulkSuspend}
              disabled={bulkBusy}
              icon={<Ban className="w-3.5 h-3.5" />}
            >
              Suspend selected
            </Button>
            {confirmBulkDelete ? (
              <span className="inline-flex items-center gap-2 text-xs">
                <span className="text-red-400">Delete {selected.size} permanently?</span>
                <button
                  onClick={bulkDelete}
                  disabled={bulkBusy}
                  className="text-red-400 hover:text-red-300 font-medium disabled:opacity-50"
                >
                  {bulkBusy ? '…' : 'Yes, delete'}
                </button>
                <button
                  onClick={() => setConfirmBulkDelete(false)}
                  className="text-frame-textMuted hover:text-white"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <Button
                variant="danger"
                size="sm"
                onClick={bulkDelete}
                disabled={bulkBusy}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Delete selected
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Spinner /></div>
      ) : users.length === 0 ? (
        <div className="py-16 text-center text-frame-textSecondary text-sm">
          No orphan users.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-frame-border">
                <th className="px-6 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="accent-frame-accent"
                  />
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-frame-textMuted uppercase tracking-wider">User</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-frame-textMuted uppercase tracking-wider">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const created = toDate(u.createdAt);
                return (
                  <tr
                    key={u.id}
                    className="border-b border-frame-border/50 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => toggleOne(u.id)}
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selected.has(u.id)}
                        onChange={() => toggleOne(u.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="accent-frame-accent"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar src={u.avatar} name={u.name} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-white">{u.name}</p>
                          <p className="text-xs text-frame-textMuted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-frame-textSecondary">
                        {created ? formatRelativeTime(created) : '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
