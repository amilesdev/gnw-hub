'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from './Icons';

/** Centered, scale-in modal floating on a dimmed backdrop. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
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
      <div className="absolute inset-0 animate-fade-in bg-ink/40" onClick={onClose} aria-hidden />
      <div className="card relative z-10 max-h-[85%] w-full animate-scale-in overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="row-press grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink-soft"
            aria-label="Close"
          >
            <X width={18} height={18} />
          </button>
        </div>
        <div className="no-scrollbar max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
