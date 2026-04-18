'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import {
  Link as LinkIcon, Lock, ExternalLink, Copy, Trash2, ChevronRight,
  MessageSquare, Folder, Layers, X, Check, Users, Shield,
  Download, CheckCircle2, Sparkles, Eye, Plus, Film, Image as ImageIcon,
} from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { AddFromProjectModal } from '@/components/review/AddFromProjectModal';
import toast from 'react-hot-toast';

interface ContentsData {
  assetIds: string[];
  folderIds: string[];
  legacyFolderId: string | null;
  assets: any[];
  folders: any[];
  projectId: string;
}

interface ReviewLinkRow {
  id: string;
  token: string;
  name: string;
  projectId: string;
  projectName: string;
  folderId: string | null;
  assetIds?: string[];
  allowComments: boolean;
  allowDownloads?: boolean;
  allowApprovals?: boolean;
  password?: string;
  hasPassword?: boolean;
  createdAt: any;
  expiresAt?: any;
  _commentCount: number;
}

interface Viewer {
  name: string;
  email: string;
  commentCount: number;
  lastSeen: any;
}

function parseDate(raw: any): Date | null {
  if (!raw) return null;
  if (typeof raw.toDate === 'function') return raw.toDate();
  if (raw._seconds) return new Date(raw._seconds * 1000);
  return null;
}

function parseDateOrEpoch(raw: any): Date {
  return parseDate(raw) ?? new Date(0);
}

function ScopeLabel({ link }: { link: ReviewLinkRow }) {
  if (link.assetIds?.length) {
    return (
      <span className="flex items-center gap-1 text-xs text-frame-textSecondary">
        <Layers className="w-3 h-3" />
        {link.assetIds.length} asset{link.assetIds.length !== 1 ? 's' : ''}
      </span>
    );
  }
  if (link.folderId) {
    return (
      <span className="flex items-center gap-1 text-xs text-frame-textSecondary">
        <Folder className="w-3 h-3" />
        Folder
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-frame-textSecondary">
      <LinkIcon className="w-3 h-3" />
      Project
    </span>
  );
}

function InitialsAvatar({ name }: { name: string; email: string }) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const colors = ['bg-frame-accent', 'bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-purple-500'];
  const idx = (name.charCodeAt(0) || 0) % colors.length;
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${colors[idx]}`}>
      {initials || '?'}
    </div>
  );
}

function InspectPanel({
  link,
  onClose,
  getIdToken,
  onDeleted,
}: {
  link: ReviewLinkRow;
  onClose: () => void;
  getIdToken: () => Promise<string | null>;
  onDeleted: (token: string) => void;
}) {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [viewersLoading, setViewersLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [contents, setContents] = useState<ContentsData | null>(null);
  const [contentsLoading, setContentsLoading] = useState(true);
  const [showAddFromProject, setShowAddFromProject] = useState(false);
  const [mutating, setMutating] = useState<string | null>(null); // id being removed

  const loadContents = useCallback(async () => {
    setContentsLoading(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/review-links/${link.token}/contents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setContents(data);
      }
    } catch { /* non-fatal */ }
    finally { setContentsLoading(false); }
  }, [link.token, getIdToken]);

  useEffect(() => { loadContents(); }, [loadContents]);

  const handleRemove = async (opts: { assetId?: string; folderId?: string }) => {
    const id = opts.assetId ?? opts.folderId!;
    setMutating(id);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/review-links/${link.token}/contents`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          removeAssetIds: opts.assetId ? [opts.assetId] : [],
          removeFolderIds: opts.folderId ? [opts.folderId] : [],
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'Failed to remove');
      }
      await loadContents();
      toast.success('Removed');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setMutating(null);
    }
  };

  const reviewUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/review/${link.token}`;

  useEffect(() => {
    const load = async () => {
      setViewersLoading(true);
      try {
        const token = await getIdToken();
        const res = await fetch(`/api/review-links/${link.token}/viewers`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setViewers(data.viewers ?? []);
        }
      } catch { /* non-fatal */ }
      finally { setViewersLoading(false); }
    };
    load();
  }, [link.token, getIdToken]);

  const handleCopy = () => {
    navigator.clipboard.writeText(reviewUrl);
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/review-links/${link.token}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success('Review link deleted');
        onDeleted(link.token);
        onClose();
      } else {
        toast.error('Failed to delete');
      }
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const date = parseDateOrEpoch(link.createdAt);

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-frame-border flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <LinkIcon className="w-4 h-4 text-frame-accent flex-shrink-0" />
          <h3 className="text-sm font-semibold text-white truncate">{link.name}</h3>
        </div>
        <button onClick={onClose} className="text-frame-textMuted hover:text-white transition-colors flex-shrink-0 ml-2">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* URL + actions */}
        <div className="px-5 py-4 border-b border-frame-border space-y-2">
          <div className="flex items-center gap-2 bg-frame-bg border border-frame-border rounded-lg px-3 py-2">
            <span className="text-xs text-frame-textMuted flex-1 truncate font-mono">{reviewUrl}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-frame-accent hover:bg-frame-accentHover rounded-lg transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <a
              href={reviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-frame-textSecondary hover:text-white bg-frame-border hover:bg-frame-borderLight rounded-lg transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open
            </a>
          </div>
        </div>

        {/* Details */}
        <div className="px-5 py-4 border-b border-frame-border space-y-3">
          <h4 className="text-xs font-semibold text-frame-textMuted uppercase tracking-wider">Details</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-frame-textSecondary">Project</span>
              <Link
                href={`/projects/${link.projectId}`}
                className="text-frame-accent hover:underline text-xs font-medium flex items-center gap-1"
              >
                {link.projectName}
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-frame-textSecondary">Scope</span>
              <ScopeLabel link={link} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-frame-textSecondary">Created</span>
              <span className="text-xs text-frame-textSecondary" title={date.toLocaleDateString()}>
                {formatRelativeTime(date)}
              </span>
            </div>
          </div>
        </div>

        {/* Contents */}
        <div className="px-5 py-4 border-b border-frame-border space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-frame-textMuted uppercase tracking-wider">Contents</h4>
            <button
              onClick={() => setShowAddFromProject(true)}
              className="flex items-center gap-1 text-xs text-frame-accent hover:text-frame-accentHover font-medium transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add from project
            </button>
          </div>

          {contentsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : !contents || (contents.assets.length === 0 && contents.folders.length === 0) ? (
            <div className="text-center py-4">
              <p className="text-xs text-frame-textMuted">
                {contents?.projectId ? 'No items yet — this link shows the whole project. Add items to curate it.' : 'No items'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Folders */}
              {contents.folders.map((f: any) => (
                <div
                  key={`f-${f.id}`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-frame-cardHover group transition-colors"
                >
                  <Folder className="w-3.5 h-3.5 text-frame-accent flex-shrink-0" />
                  <span className="text-xs text-white truncate flex-1">
                    {f._deleted ? <span className="text-frame-textMuted italic">Deleted folder</span> : f.name}
                  </span>
                  <button
                    onClick={() => handleRemove({ folderId: f.id })}
                    disabled={mutating === f.id}
                    title="Remove folder from link"
                    className="opacity-0 group-hover:opacity-100 text-frame-textMuted hover:text-red-400 p-1 rounded transition-all disabled:opacity-50"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {/* Assets */}
              {contents.assets.map((a: any) => {
                const thumb = a.thumbnailSignedUrl as string | undefined;
                return (
                  <div
                    key={`a-${a.id}`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-frame-cardHover group transition-colors"
                  >
                    <div className="w-8 h-6 rounded overflow-hidden bg-frame-bg flex-shrink-0 flex items-center justify-center">
                      {a._deleted ? (
                        <X className="w-3 h-3 text-frame-textMuted" />
                      ) : thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="w-full h-full object-cover" />
                      ) : a.type === 'video' ? (
                        <Film className="w-3 h-3 text-frame-textMuted" />
                      ) : (
                        <ImageIcon className="w-3 h-3 text-frame-textMuted" />
                      )}
                    </div>
                    <span className="text-xs text-white truncate flex-1">
                      {a._deleted ? <span className="text-frame-textMuted italic">Deleted asset</span> : a.name}
                    </span>
                    <button
                      onClick={() => handleRemove({ assetId: a.id })}
                      disabled={mutating === a.id}
                      title="Remove asset from link"
                      className="opacity-0 group-hover:opacity-100 text-frame-textMuted hover:text-red-400 p-1 rounded transition-all disabled:opacity-50"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Permissions */}
        <div className="px-5 py-4 border-b border-frame-border space-y-3">
          <h4 className="text-xs font-semibold text-frame-textMuted uppercase tracking-wider">Permissions</h4>
          <div className="space-y-2">
            {[
              { label: 'Comments', enabled: link.allowComments, icon: MessageSquare },
              { label: 'Downloads', enabled: !!link.allowDownloads, icon: Download },
              { label: 'Approvals', enabled: !!link.allowApprovals, icon: CheckCircle2 },
              { label: 'Password protected', enabled: !!(link as any).hasPassword || !!link.password, icon: Shield },
            ].map(({ label, enabled, icon: Icon }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-frame-textSecondary">
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </span>
                <span className={`text-xs font-medium ${enabled ? 'text-emerald-400' : 'text-frame-textMuted'}`}>
                  {enabled ? 'On' : 'Off'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Viewers / Access */}
        <div className="px-5 py-4 border-b border-frame-border space-y-3">
          <h4 className="text-xs font-semibold text-frame-textMuted uppercase tracking-wider flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            People with access
          </h4>
          {viewersLoading ? (
            <div className="flex items-center justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : viewers.length === 0 ? (
            <div className="text-center py-4">
              <Users className="w-6 h-6 text-frame-textMuted mx-auto mb-2" />
              <p className="text-xs text-frame-textMuted">No activity yet</p>
              <p className="text-xs text-frame-textMuted mt-0.5">Share this link to get feedback</p>
            </div>
          ) : (
            <div className="space-y-3">
              {viewers.map((v, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <InitialsAvatar name={v.name} email={v.email} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{v.name}</p>
                    {v.email && (
                      <p className="text-xs text-frame-textMuted truncate">{v.email}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-frame-accent font-medium">{v.commentCount} comment{v.commentCount !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-frame-textMuted">
                      {v.lastSeen ? formatRelativeTime(parseDateOrEpoch(v.lastSeen)) : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className="px-5 py-4">
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-xs text-red-400">This will permanently delete the review link. Anyone with the URL will lose access.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Yes, delete'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-2 text-xs font-medium text-frame-textSecondary hover:text-white bg-frame-border rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleDelete}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-red-400 hover:text-white hover:bg-red-500/15 rounded-lg transition-colors border border-red-500/20 hover:border-red-500/40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete link
            </button>
          )}
        </div>
      </div>

      {showAddFromProject && contents && (
        <AddFromProjectModal
          projectId={contents.projectId}
          token={link.token}
          existingAssetIds={new Set(contents.assetIds)}
          existingFolderIds={new Set(contents.folderIds)}
          onClose={() => setShowAddFromProject(false)}
          onSaved={loadContents}
        />
      )}
    </div>
  );
}

export default function ReviewLinksPage() {
  const { getIdToken } = useAuth();
  const [links, setLinks] = useState<ReviewLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inspecting, setInspecting] = useState<ReviewLinkRow | null>(null);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/review-links/all', {
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
    }
    finally { setLoading(false); }
  }, [getIdToken]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  const handleDeleted = (token: string) => {
    setLinks(prev => prev.filter(l => l.token !== token));
  };

  const handleCopyLink = (link: ReviewLinkRow) => {
    const url = `${window.location.origin}/review/${link.token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied');
  };

  return (
    <div className="min-h-full flex flex-col">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-frame-border bg-frame-sidebar flex-shrink-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(122,0,223,0.12)_0%,transparent_60%)]" />
        <div className="relative px-8 py-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-frame-accent" />
            <span className="text-frame-accent text-xs font-semibold uppercase tracking-wider">Sharing</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Review Links</h1>
          <p className="text-frame-textSecondary mt-1 text-sm">
            All share links across your projects &mdash; see who&apos;s viewing and leave feedback.
          </p>
        </div>
      </div>

      {/* Content + inspect panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main table */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-8 py-6">
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Spinner size="lg" />
              </div>
            ) : links.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 bg-frame-accent/10 rounded-2xl flex items-center justify-center mb-4">
                  <LinkIcon className="w-8 h-8 text-frame-accent" />
                </div>
                <p className="text-white font-semibold text-lg">No review links yet</p>
                <p className="text-frame-textMuted text-sm mt-2 max-w-xs">
                  Create a review link from any project folder or asset selection to share with clients.
                </p>
              </div>
            ) : (
              <div className="bg-frame-card border border-frame-border rounded-xl overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_160px_120px_80px_100px_120px] gap-4 px-5 py-3 border-b border-frame-border text-xs font-semibold text-frame-textMuted uppercase tracking-wider">
                  <span>Name</span>
                  <span>Project</span>
                  <span>Scope</span>
                  <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /></span>
                  <span>Created</span>
                  <span />
                </div>

                {links.map(link => {
                  const date = parseDateOrEpoch(link.createdAt);
                  const isInspecting = inspecting?.token === link.token;
                  return (
                    <div
                      key={link.token}
                      className={`grid grid-cols-[1fr_160px_120px_80px_100px_120px] gap-4 px-5 py-3.5 border-b border-frame-border/50 hover:bg-frame-cardHover transition-colors ${isInspecting ? 'bg-frame-accent/5 border-l-2 border-l-frame-accent' : ''}`}
                    >
                      {/* Name */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <LinkIcon className="w-4 h-4 text-frame-accent flex-shrink-0" />
                        <span className="text-sm font-medium text-white truncate">{link.name}</span>
                        {((link as any).hasPassword || link.password) && (
                          <span title="Password protected" className="flex-shrink-0">
                            <Lock className="w-3 h-3 text-yellow-400" />
                          </span>
                        )}
                        {(() => {
                          const exp = parseDate(link.expiresAt);
                          if (!exp) return null;
                          const now = Date.now();
                          const ms = exp.getTime() - now;
                          if (ms < 0) {
                            return <span className="flex-shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-semibold">Expired</span>;
                          }
                          const days = ms / 86400000;
                          if (days < 3) {
                            return <span title={`Expires ${exp.toLocaleDateString()}`} className="flex-shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-semibold">Expiring</span>;
                          }
                          return null;
                        })()}
                      </div>

                      {/* Project */}
                      <div className="self-center min-w-0">
                        <Link
                          href={`/projects/${link.projectId}`}
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-frame-accent hover:underline truncate block"
                        >
                          {link.projectName}
                        </Link>
                      </div>

                      {/* Scope */}
                      <div className="self-center">
                        <ScopeLabel link={link} />
                      </div>

                      {/* Comments */}
                      <div className="self-center">
                        <span className={`flex items-center gap-1 text-xs ${link._commentCount > 0 ? 'text-frame-accent font-medium' : 'text-frame-textMuted'}`}>
                          <MessageSquare className="w-3 h-3" />
                          {link._commentCount}
                        </span>
                      </div>

                      {/* Created */}
                      <div className="self-center">
                        <span className="text-xs text-frame-textSecondary" title={date.toLocaleDateString()}>
                          {formatRelativeTime(date)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="self-center flex items-center gap-1 justify-end">
                        <button
                          onClick={() => handleCopyLink(link)}
                          title="Copy link"
                          className="p-1.5 rounded-lg text-frame-textMuted hover:text-white hover:bg-frame-border transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={`/review/${link.token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open review"
                          className="p-1.5 rounded-lg text-frame-textMuted hover:text-white hover:bg-frame-border transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => setInspecting(isInspecting ? null : link)}
                          title="Inspect"
                          className={`p-1.5 rounded-lg transition-colors ${isInspecting ? 'text-frame-accent bg-frame-accent/15' : 'text-frame-textMuted hover:text-white hover:bg-frame-border'}`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Inspect panel - slide in from right */}
        {inspecting && (
          <div className="w-80 flex-shrink-0 border-l border-frame-border bg-frame-sidebar overflow-hidden flex flex-col">
            <InspectPanel
              link={inspecting}
              onClose={() => setInspecting(null)}
              getIdToken={getIdToken}
              onDeleted={handleDeleted}
            />
          </div>
        )}
      </div>
    </div>
  );
}
