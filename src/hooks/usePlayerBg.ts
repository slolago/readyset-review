'use client';

import { useEffect, useState } from 'react';

/**
 * Background color behind the video in the player / compare view.
 * Black is traditional for video review, but some users prefer mid-gray
 * to evaluate tonal values without the deepest black crushing shadow detail.
 */
export const PLAYER_BG_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '#000000', label: 'Black' },
  { value: '#0a0a0a', label: 'Near Black' },
  { value: '#1a1a1a', label: 'Charcoal' },
  { value: '#2a2a2a', label: 'Dark Gray' },
  { value: '#404040', label: 'Gray' },
  { value: '#808080', label: 'Mid Gray' },
];

const DEFAULT_BG = '#000000';
const STORAGE_KEY = 'player-bg';

export function usePlayerBg(): [string, (v: string) => void] {
  const [bg, setBg] = useState<string>(DEFAULT_BG);

  // Read once on mount (SSR-safe).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && PLAYER_BG_OPTIONS.some((o) => o.value === stored)) {
        setBg(stored);
      }
    } catch {}
  }, []);

  const update = (v: string) => {
    setBg(v);
    try { localStorage.setItem(STORAGE_KEY, v); } catch {}
  };

  return [bg, update];
}
