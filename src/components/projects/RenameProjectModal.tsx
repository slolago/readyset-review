'use client';

import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import type { Project } from '@/types';
import toast from 'react-hot-toast';

interface Props {
  project: Project;
  onClose: () => void;
  onRenamed: (newName: string) => void;
}

export function RenameProjectModal({ project, onClose, onRenamed }: Props) {
  const { getIdToken } = useAuth();
  const [name, setName] = useState(project.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (el) { el.focus(); el.select(); }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === project.name) { onClose(); return; }
    setSaving(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.status === 409) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'A project with that name already exists');
        setSaving(false);
        return;
      }
      if (res.status === 403) {
        toast.error("You don't have permission to rename this project");
        setSaving(false);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || 'Failed to rename');
        setSaving(false);
        return;
      }
      toast.success('Renamed');
      onRenamed(trimmed);
      onClose();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to rename');
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Rename project" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-scope-textSecondary mb-1.5">Name</label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); if (error) setError(null); }}
            disabled={saving}
            className={`w-full bg-scope-bg border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-scope-accent ${
              error ? 'border-red-400/60' : 'border-scope-border'
            }`}
          />
          {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" loading={saving} disabled={saving || !name.trim()}>Rename</Button>
        </div>
      </form>
    </Modal>
  );
}
