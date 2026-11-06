'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { usePresence } from '@/lib/use-presence';
import { Check } from './Icons';

/**
 * Toast with undo (CMP-22). One at a time; a new toast replaces the old.
 *
 * Reversible deletes use the "delay" approach: the screen hides the item at
 * once, passes the real server call as `commit`, and a way to put it back as
 * `undo`. `commit` runs when the toast closes without Undo (timeout, replaced
 * by another toast, or the page being hidden), so no backend change is needed.
 */
type ToastInput = {
  message: string;
  /** Restore the item on screen. Shows the Undo button. */
  undo?: () => void;
  /** The deferred server call; runs unless Undo was pressed. */
  commit?: () => void | Promise<unknown>;
};
type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<{ show: (t: ToastInput) => void } | null>(null);
const ToastStateContext = createContext<{ toast: ToastItem | null; dismiss: (undo: boolean) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const current = useRef<ToastItem | null>(null);
  const timer = useRef(0);
  const seq = useRef(0);

  // Close the current toast: run its commit unless it was undone.
  const settle = useCallback((undo: boolean) => {
    const t = current.current;
    if (!t) return;
    current.current = null;
    window.clearTimeout(timer.current);
    if (undo) t.undo?.();
    else void Promise.resolve(t.commit?.()).catch(() => {});
  }, []);

  const dismiss = useCallback(
    (undo: boolean) => {
      settle(undo);
      setToast(null);
    },
    [settle],
  );

  const show = useCallback(
    (input: ToastInput) => {
      settle(false);
      const item = { ...input, id: ++seq.current };
      current.current = item;
      setToast(item);
      timer.current = window.setTimeout(() => dismiss(false), input.undo ? 8000 : 5000);
    },
    [settle, dismiss],
  );

  // Leaving the app (or closing it) must not lose a pending delete.
  useEffect(() => {
    const flush = () => document.visibilityState === 'hidden' && dismiss(false);
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, [dismiss]);

  const api = useMemo(() => ({ show }), [show]);
  const state = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      <ToastStateContext.Provider value={state}>{children}</ToastStateContext.Provider>
    </ToastContext.Provider>
  );
}

/** `toast.show({ message, undo?, commit? })`. Outside a provider it just commits. */
export function useToast() {
  return (
    useContext(ToastContext) ?? {
      show: (t: ToastInput) => void Promise.resolve(t.commit?.()).catch(() => {}),
    }
  );
}

/** Renders the live toast. Lives in the dock stack, right above the tab bar. */
export function ToastHost({ className }: { className?: string }) {
  const state = useContext(ToastStateContext);
  const toast = state?.toast ?? null;
  // Keep the last toast on screen while it fades out.
  const [shown, setShown] = useState<ToastItem | null>(toast);
  const { mounted, closing } = usePresence(!!toast, 180);
  useEffect(() => {
    if (toast) setShown(toast);
  }, [toast]);

  return (
    <div role="status" aria-live="polite" className={cn('pointer-events-none', className)}>
      {mounted && shown && (
        <div
          key={shown.id}
          className={cn(
            'glass pointer-events-auto mx-3.5 flex min-h-[52px] items-center gap-2.5 rounded-[24px] py-1 pl-[18px] pr-1.5',
            closing ? 'animate-fade-out' : 'animate-toast-in',
          )}
        >
          <Check width={18} height={18} className="shrink-0 text-good-ink" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-5 text-ink">{shown.message}</p>
          {shown.undo && !closing && (
            <button
              type="button"
              onClick={() => state?.dismiss(true)}
              className="h-11 shrink-0 rounded-full px-3 text-[15px] font-bold text-accent-ink active:scale-[0.97]"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
