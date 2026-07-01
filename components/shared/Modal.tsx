'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from './Icons';

/** Scale-in modal floating on a dimmed backdrop. Centered on wide screens;
 *  anchored to the bottom on phones so it rides just above the soft keyboard. */
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
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  // When a field inside the dialog gains focus, wait for the keyboard to animate
  // in, then scroll it to the middle of the (now shorter) viewport so it — and the
  // submit button below it — never end up hidden behind the keyboard.
  const onFocusCapture = (e: React.FocusEvent<HTMLDivElement>) => {
    const el = e.target;
    if (!el.matches('input, textarea, select')) return;
    window.setTimeout(() => {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 250);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Move focus into the dialog on open and restore it to the trigger on close,
  // so keyboard/screen-reader users aren't stranded behind the scrim.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => prev?.focus?.();
  }, [open]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-5">
      <div className="absolute inset-0 animate-fade-in bg-ink/40" onClick={onClose} aria-hidden />
      <div
        className="card relative z-10 max-h-[88%] w-full animate-scale-in overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        onFocusCapture={onFocusCapture}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id={titleId} className="font-display text-xl font-semibold">{title}</h2>
          <button
            ref={closeRef}
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
