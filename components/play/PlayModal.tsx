'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from '@/components/shared/Icons';
import { haptics } from '@/lib/haptics';

/**
 * Gamified dialog for the Play world — bouncy scale-in on a blurred backdrop,
 * a colorful play-bg accent rail at the top, rounded-3xl shell and the bold
 * display type the rest of Play uses (vs. the plain Hub `Modal`).
 */
export function PlayModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-5">
      <div className="absolute inset-0 animate-fade-in bg-ink/45 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative z-10 max-h-[85%] w-full max-w-md animate-scale-in overflow-hidden rounded-[1.75rem] bg-app shadow-pop">
        {/* Colorful play accent rail. */}
        <div className="play-bg pointer-events-none absolute inset-x-0 top-0 h-24 opacity-90" aria-hidden />
        <div className="relative flex items-center justify-between px-5 pb-3 pt-5">
          <h2 className="font-display text-xl font-extrabold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="play-press grid h-9 w-9 place-items-center rounded-full bg-surface/85 text-ink-soft shadow-card backdrop-blur"
            aria-label="Close"
          >
            <X width={18} height={18} />
          </button>
        </div>
        <div className="no-scrollbar relative max-h-[70vh] overflow-y-auto px-5 pb-5 pt-1">{children}</div>
      </div>
    </div>
  );
}

/** Gamified confirm dialog (replaces the Hub `ConfirmDialog` inside Play). */
export function PlayConfirm({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onClose,
  busy,
  error,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  function confirm() {
    haptics.warn();
    onConfirm();
  }

  return (
    <PlayModal open={open} onClose={onClose} title={title}>
      <p className="text-ink-soft">{message}</p>
      {error && <p className="mt-3 text-sm font-semibold text-bad">{error}</p>}
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          className="play-press flex-1 rounded-2xl bg-surface-2 px-5 py-3.5 font-bold text-ink disabled:opacity-40"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="play-press flex-1 rounded-2xl bg-bad px-5 py-3.5 font-bold text-white shadow-pop disabled:opacity-40"
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </PlayModal>
  );
}
