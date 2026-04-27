'use client';

import { useState, useRef, useEffect } from 'react';
import { Palette } from 'lucide-react';
import { PLAYER_BG_OPTIONS } from '@/hooks/usePlayerBg';

interface PlayerBgPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function PlayerBgPicker({ value, onChange }: PlayerBgPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Background color"
        className="text-white/60 hover:text-white transition-colors flex items-center"
      >
        <Palette className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 bg-[#1e1e1e] border border-white/10 rounded-lg shadow-xl p-2 z-50">
          <div className="flex items-center gap-1.5">
            {PLAYER_BG_OPTIONS.map((opt) => {
              const selected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  title={opt.label}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                    selected ? 'border-scope-accent' : 'border-white/20'
                  }`}
                  style={{ backgroundColor: opt.value }}
                  aria-label={opt.label}
                  aria-pressed={selected}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
