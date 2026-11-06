'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { usePresence } from '@/lib/use-presence';
import { X } from './Icons';

/**
 * Solid sheet or dialog on a scrim (CMP-5). Rendered through a portal on
 * `document.body` so it covers the whole viewport — the app shell is a fixed,
 * transformed 430px column, which would otherwise trap the backdrop inside it
 * (leaving the dim as a "box" within the screen on wider viewports).
 *
 * Placement:
 * - `sheet` (default): slides up from the bottom on phones so it rides above the
 *   soft keyboard (and slides back down on close), centered on wider screens.
 * - `center`: always centered on screen — for short, keyboard-light dialogs.
 *
 * `hideClose` drops the X for dialogs that must be answered (ConfirmDialog).
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  placement = 'sheet',
  hideClose = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  placement?: 'sheet' | 'center';
  hideClose?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { mounted, closing } = usePresence(open, 220);

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
    (closeRef.current ?? panelRef.current)?.focus();
    return () => prev?.focus?.();
  }, [open]);

  if (!mounted || typeof document === 'undefined') return null;

  const sheet = placement === 'sheet';

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-overlay flex justify-center p-3 sm:p-5',
        sheet ? 'items-end sm:items-center' : 'items-center',
        closing && 'pointer-events-none',
      )}
    >
      <div
        className={cn('absolute inset-0 bg-scrim', closing ? 'animate-fade-out' : 'animate-fade-in')}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'relative z-10 flex max-h-[88dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-sheet bg-surface shadow-sheet outline-none',
          sheet
            ? closing
              ? 'animate-sheet-down sm:animate-scale-out'
              : 'animate-sheet-up sm:animate-scale-in'
            : closing
              ? 'animate-scale-out'
              : 'animate-scale-in',
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        onFocusCapture={onFocusCapture}
      >
        {sheet && <div className="mx-auto mt-2 h-[5px] w-10 shrink-0 rounded-[3px] bg-line sm:hidden" aria-hidden />}
        <div className={cn('flex shrink-0 items-start justify-between gap-3 pb-3 pl-5 pr-3', sheet ? 'pt-2 sm:pt-4' : 'pt-4')}>
          <div className="min-w-0 pt-2.5">
            <h2 id={titleId} className="font-display text-xl font-semibold leading-[26px]">{title}</h2>
            {subtitle && <p className="mt-1 text-[15px] leading-[22px] text-ink-soft">{subtitle}</p>}
          </div>
          {!hideClose && (
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="btn-icon bg-surface-2"
              aria-label="Close"
            >
              <X width={20} height={20} />
            </button>
          )}
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="shrink-0 px-5 pb-5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
