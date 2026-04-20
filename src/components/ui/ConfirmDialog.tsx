'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  /** Body text. Accepts multi-paragraph — split on \n\n for visual breaks. */
  message?: string;
  /** Defaults to "Confirm" (or "Delete" when destructive). */
  confirmLabel?: string;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
  /**
   * Renders the confirm button in the danger style (red) and shows a warning
   * icon. Use for delete / irreversible actions.
   */
  destructive?: boolean;
}

type Resolver = (ok: boolean) => void;

interface ConfirmCtx {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const Ctx = createContext<ConfirmCtx | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<Resolver | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setOpts(options);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = useCallback((result: boolean) => {
    const r = resolverRef.current;
    resolverRef.current = null;
    setOpts(null);
    r?.(result);
  }, []);

  return (
    <Ctx.Provider value={{ confirm }}>
      {children}
      <Modal
        isOpen={!!opts}
        onClose={() => close(false)}
        size="sm"
      >
        {opts && (
          <div className="flex gap-4">
            {opts.destructive && (
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-white mb-1.5">
                {opts.title}
              </h2>
              {opts.message && (
                <div className="text-sm text-frame-textSecondary leading-relaxed whitespace-pre-line">
                  {opts.message}
                </div>
              )}
              <div className="flex justify-end gap-2 mt-5">
                <Button variant="secondary" onClick={() => close(false)}>
                  {opts.cancelLabel ?? 'Cancel'}
                </Button>
                <Button
                  variant={opts.destructive ? 'danger' : 'primary'}
                  onClick={() => close(true)}
                  autoFocus
                >
                  {opts.confirmLabel ??
                    (opts.destructive ? 'Delete' : 'Confirm')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Ctx.Provider>
  );
}

export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return ctx.confirm;
}
