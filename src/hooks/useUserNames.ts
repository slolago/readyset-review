'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

// Resolves an array of user UIDs to { uid: displayName } map.
// Deduplicates, caches, and fetches in one batch call.
export function useUserNames(uids: string[]): Record<string, string> {
  const { getIdToken } = useAuth();
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const unique = uids.filter((uid, i, arr) => uid && arr.indexOf(uid) === i);
    if (unique.length === 0) return;

    // Only fetch UIDs we don't have yet
    const missing = unique.filter((uid) => !names[uid]);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const res = await fetch(`/api/users?ids=${missing.join(',')}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const resolved: Record<string, string> = {};
        for (const [uid, info] of Object.entries(data.users as Record<string, { name: string }>)) {
          resolved[uid] = info.name;
        }
        if (!cancelled) setNames((prev) => ({ ...prev, ...resolved }));
      } catch {}
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uids.join(',')]);

  return names;
}
