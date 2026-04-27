'use client';

import { formatTimestamp } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface CommentTimestampProps {
  timestamp: number;
  onClick?: () => void;
}

export function CommentTimestamp({ timestamp, onClick }: CommentTimestampProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-scope-accent/15 text-scope-accent rounded text-xs font-mono hover:bg-scope-accent/25 transition-colors"
    >
      <Clock className="w-3 h-3" />
      {formatTimestamp(timestamp)}
    </button>
  );
}
