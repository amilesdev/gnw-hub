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
 *
 * On phones a `sheet` can be swiped down to dismiss, like an iOS sheet: from the
 * grabber/header anywhere, or from the body only while it's scrolled to the top
 * (so the drag never fights the list's own scroll). Driven through the DOM with
 * native non-passive touch listeners, like Overlay's edge swipe.
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
  const scrimRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
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

  // Capture phase + stopPropagation: a sheet opened over an Overlay (the song
  // lead picker over Edit Setlist) closes alone instead of taking the page with it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  // A drag that snapped back left `animation: none` inline, which would mute the
  // exit classes — so if the sheet then closes another way (X, scrim, Esc),
  // slide it down by hand instead.
  useEffect(() => {
    if (!closing) return;
    const panel = panelRef.current;
    const scrim = scrimRef.current;
    if (panel?.style.animation === 'none' && panel.style.transform === 'translateY(0)') {
      panel.style.transition = 'transform 0.22s cubic-bezier(0.4, 0, 1, 1)';
      panel.style.transform = `translateY(${panel.offsetHeight + 24}px)`;
    }
    if (scrim?.style.animation === 'none') {
      scrim.style.transition = 'opacity 0.2s cubic-bezier(0.4, 0, 1, 1)';
      scrim.style.opacity = '0';
    }
  }, [closing]);

  // Swipe down to dismiss (phone sheets only — wider screens center the dialog).
  const sheet = placement === 'sheet';
  useEffect(() => {
    if (!open || !mounted || !sheet) return;
    const panel = panelRef.current;
    if (!panel) return;
    const scrim = scrimRef.current;
    const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
    const drag = { active: false, startX: 0, startY: 0, startT: 0, dy: 0, down: null as boolean | null };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || !window.matchMedia('(max-width: 639px)').matches) return;
      const target = e.target as HTMLElement;
      const body = bodyRef.current;
      // Inside a scrolled list the finger scrolls; at the top, a pull-down drags.
      if (body?.contains(target) && body.scrollTop > 0) return;
      // Never steal a drag that starts in a field (text selection, sliders).
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const t = e.touches[0];
      Object.assign(drag, { active: true, startX: t.clientX, startY: t.clientY, startT: performance.now(), dy: 0, down: null });
    };

    const onMove = (e: TouchEvent) => {
      if (!drag.active) return;
      const t = e.touches[0];
      const dx = t.clientX - drag.startX;
      const dy = t.clientY - drag.startY;
      if (drag.down === null) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        drag.down = dy > 0 && Math.abs(dy) > Math.abs(dx);
        if (!drag.down) {
          drag.active = false; // upward or sideways: let the content scroll
          return;
        }
        panel.style.animation = 'none';
        panel.style.transition = 'none';
        if (scrim) {
          scrim.style.animation = 'none';
          scrim.style.transition = 'none';
        }
      }
      e.preventDefault(); // no rubber-band scroll underneath the drag
      drag.dy = Math.max(0, dy);
      panel.style.transform = `translateY(${drag.dy}px)`;
      if (scrim) scrim.style.opacity = String(Math.max(0, 1 - drag.dy / panel.offsetHeight));
    };

    const onEnd = () => {
      if (!drag.active) return;
      drag.active = false;
      if (!drag.down) return;
      const velocity = drag.dy / Math.max(1, performance.now() - drag.startT); // px/ms
      const commit = drag.dy > 110 || (velocity > 0.5 && drag.dy > 30);
      panel.style.transition = `transform 0.2s ${EASE}`;
      if (scrim) scrim.style.transition = `opacity 0.2s ${EASE}`;
      if (commit) {
        // Finish the slide from where the finger let go. The inline
        // `animation: none` keeps the closing sheet-down class from replaying it.
        panel.style.transform = `translateY(${panel.offsetHeight + 24}px)`;
        if (scrim) scrim.style.opacity = '0';
        onCloseRef.current();
      } else {
        panel.style.transform = 'translateY(0)';
        if (scrim) scrim.style.opacity = '';
      }
    };

    panel.addEventListener('touchstart', onStart, { passive: true });
    panel.addEventListener('touchmove', onMove, { passive: false });
    panel.addEventListener('touchend', onEnd, { passive: true });
    panel.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      panel.removeEventListener('touchstart', onStart);
      panel.removeEventListener('touchmove', onMove);
      panel.removeEventListener('touchend', onEnd);
      panel.removeEventListener('touchcancel', onEnd);
    };
  }, [open, mounted, sheet]);

  // Move focus into the dialog on open and restore it to the trigger on close,
  // so keyboard/screen-reader users aren't stranded behind the scrim.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    (closeRef.current ?? panelRef.current)?.focus();
    return () => prev?.focus?.();
  }, [open]);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-overlay flex justify-center p-3 sm:p-5',
        sheet ? 'items-end sm:items-center' : 'items-center',
        closing && 'pointer-events-none',
      )}
    >
      <div
        ref={scrimRef}
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
        <div ref={bodyRef} className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="shrink-0 px-5 pb-5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
