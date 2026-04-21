'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { Project } from '@/types';

interface ProjectsCtx {
  projects: Project[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const Ctx = createContext<ProjectsCtx | null>(null);

/**
 * PERF-06: single fetch of `/api/projects` shared by dashboard + sidebar.
 * Previously the dashboard (`useProjects`) and the sidebar's `useProjectTree`
 * each fired their own request on mount — this context dedupes them.
 */
export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const { getIdToken, user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('no token');
      const res = await fetch('/api/projects', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`projects fetch failed: ${res.status}`);
      const data = await res.json();
      setProjects(data.projects ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, user]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return <Ctx.Provider value={{ projects, loading, error, refetch }}>{children}</Ctx.Provider>;
}

export function useProjectsContext(): ProjectsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProjectsContext must be used within ProjectsProvider');
  return ctx;
}
