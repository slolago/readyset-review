'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import type { Comment } from '@/types';

export function useComments(assetId?: string, reviewToken?: string) {
  const { getIdToken } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchComments = useCallback(async (signal?: AbortSignal) => {
    if (!assetId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ assetId });
      if (reviewToken) params.set('reviewToken', reviewToken);
      const headers: HeadersInit = {};
      if (!reviewToken) {
        const token = await getIdToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/comments?${params}`, { headers, signal });
      if (signal?.aborted) return;
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments);
      }
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      console.error('Failed to fetch comments:', err);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [assetId, reviewToken, getIdToken]);

  useEffect(() => {
    // Clear existing comments immediately so the previous asset's thread doesn't
    // flash while the new fetch is in flight (happens when switching versions).
    setComments([]);
    // Abort in-flight request if assetId changes — prevents setState on
    // unmounted component and ensures stale responses don't overwrite new data.
    const ctrl = new AbortController();
    fetchComments(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchComments]);

  const addComment = async (
    commentData: {
      text: string;
      timestamp?: number;
      inPoint?: number;
      outPoint?: number;
      annotation?: { shapes: string; frameTime?: number };
      parentId?: string | null;
      authorName?: string;
      authorEmail?: string;
      reviewLinkId?: string;
    },
    projectId: string
  ): Promise<boolean> => {
    if (!assetId) return false;

    // Build optimistic comment. Use a `temp-` prefixed id so reconciliation
    // can match by tempId and server-assigned ids never collide.
    const tempId = `temp-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
    const optimistic = {
      id: tempId,
      assetId,
      projectId,
      authorId: null,
      authorName: commentData.authorName ?? '',
      authorEmail: commentData.authorEmail,
      text: commentData.text,
      timestamp: commentData.timestamp,
      inPoint: commentData.inPoint,
      outPoint: commentData.outPoint,
      annotation: commentData.annotation,
      parentId: commentData.parentId ?? null,
      reviewLinkId: commentData.reviewLinkId,
      resolved: false,
      createdAt: new Date().toISOString(),
    } as unknown as Comment;

    setComments((prev) => [...prev, optimistic]);

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (!reviewToken) {
        const token = await getIdToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...commentData, assetId, projectId }),
      });
      if (!res.ok) {
        // Rollback the temp comment.
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        return false;
      }
      // POST returns `{ comment: { id, ...data } }` — swap the temp in place
      // so sibling order stays and thread/reply parentId survives.
      const body = (await res.json()) as { comment?: Comment };
      const real = body.comment;
      if (real) {
        setComments((prev) => prev.map((c) => (c.id === tempId ? real : c)));
      } else {
        // Defensive: if server didn't return a comment object, drop the temp
        // and refetch to reconcile from the server.
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        await fetchComments();
      }
      return true;
    } catch {
      // Network error / JSON parse error — same rollback.
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      return false;
    }
  };

  const resolveComment = async (commentId: string, resolved: boolean): Promise<boolean> => {
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ resolved }),
      });
      if (!res.ok) return false;
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, resolved } : c))
      );
      return true;
    } catch {
      return false;
    }
  };

  const deleteComment = async (commentId: string): Promise<boolean> => {
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return false;
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      return true;
    } catch {
      return false;
    }
  };

  const editComment = async (commentId: string, text: string): Promise<boolean> => {
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return false;
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, text } : c))
      );
      return true;
    } catch {
      return false;
    }
  };

  return {
    comments,
    loading,
    addComment,
    resolveComment,
    deleteComment,
    editComment,
    refetch: () => fetchComments(),
  };
}
