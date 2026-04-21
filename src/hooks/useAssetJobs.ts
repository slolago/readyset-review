'use client';

/**
 * Poll /api/assets/:id/jobs while any job is non-terminal, then stop.
 * Returns the raw job list plus latestByType for quick indicator lookups.
 * No SWR / react-query — a plain interval is enough for this surface.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import type { Job, JobType } from '@/types';

const POLL_INTERVAL_MS = 5000;

export interface UseAssetJobsResult {
  jobs: Job[];
  latestByType: Partial<Record<JobType, Job>>;
  refetch: () => void;
}

export function useAssetJobs(assetId: string, enabled: boolean): UseAssetJobsResult {
  const { getIdToken } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchOnce = useCallback(async () => {
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch(`/api/assets/${assetId}/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (mountedRef.current) setJobs(data.jobs ?? []);
    } catch {
      // Silent — polling retries next tick.
    }
  }, [assetId, getIdToken]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      setJobs([]);
      return () => { mountedRef.current = false; };
    }

    fetchOnce();

    const tick = async () => {
      await fetchOnce();
      // After fetch, decide whether to keep polling. If every job is
      // terminal, stop.
      if (!mountedRef.current) return;
    };

    timerRef.current = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [enabled, fetchOnce]);

  // If all known jobs are terminal, stop the interval to save requests.
  useEffect(() => {
    if (!timerRef.current) return;
    const anyLive = jobs.some((j) => j.status === 'queued' || j.status === 'running');
    if (!anyLive) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [jobs]);

  const latestByType: Partial<Record<JobType, Job>> = {};
  for (const j of jobs) {
    // jobs is newest-first from the API
    if (!latestByType[j.type]) latestByType[j.type] = j;
  }

  return { jobs, latestByType, refetch: fetchOnce };
}
