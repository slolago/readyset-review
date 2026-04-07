'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useProjects } from './useProject';
import { useAuth } from './useAuth';
import type { Project, Folder } from '@/types';

export interface ProjectTreeNode {
  project: Project;
  folders: Folder[];          // top-level folders (parentId === null)
  foldersLoaded: boolean;     // true once fetch has completed for this project
  expanded: boolean;          // UI collapse/expand state
}

export function useProjectTree() {
  const { projects, loading } = useProjects();
  const { getIdToken } = useAuth();
  const [treeNodes, setTreeNodes] = useState<ProjectTreeNode[]>([]);
  const fetchingRef = useRef<Set<string>>(new Set());

  // Sync treeNodes when projects list changes — add new, preserve existing state
  useEffect(() => {
    setTreeNodes((prev) => {
      const prevMap = new Map(prev.map((n) => [n.project.id, n]));
      return projects.map((project) => {
        const existing = prevMap.get(project.id);
        if (existing) return { ...existing, project };
        return { project, folders: [], foldersLoaded: false, expanded: false };
      });
    });
  }, [projects]);

  const toggleProject = useCallback(
    async (projectId: string) => {
      setTreeNodes((prev) =>
        prev.map((node) => {
          if (node.project.id !== projectId) return node;
          return { ...node, expanded: !node.expanded };
        })
      );

      const node = treeNodes.find((n) => n.project.id === projectId);
      if (!node || node.foldersLoaded || fetchingRef.current.has(projectId)) return;
      if (!node.expanded) {
        // expanding — load folders via REST API
        fetchingRef.current.add(projectId);
        try {
          const token = await getIdToken();
          const res = await fetch(`/api/folders?projectId=${projectId}&parentId=null`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setTreeNodes((prev) =>
              prev.map((n) =>
                n.project.id === projectId
                  ? { ...n, folders: data.folders ?? [], foldersLoaded: true }
                  : n
              )
            );
          }
        } catch {
          setTreeNodes((prev) =>
            prev.map((n) =>
              n.project.id === projectId ? { ...n, foldersLoaded: true } : n
            )
          );
        } finally {
          fetchingRef.current.delete(projectId);
        }
      }
    },
    [treeNodes, getIdToken]
  );

  return { treeNodes, loading, toggleProject };
}
