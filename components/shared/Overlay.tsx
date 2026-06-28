'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft } from './Icons';

/** How far (px) the page must be dragged right before it commits to going back. */
const CLOSE_THRESHOLD = 80;
/** Touch must start within this many px of the left edge to begin a back-swipe. */
const EDGE_ZONE = 32;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * Shared stack of mounted overlays. Only the top-most one reacts to a back-swipe
 * (or Escape) so a single gesture can never pop more than one page — overlays
 * stack (an event → a song, etc.) and we must close exactly one at a time.
 */
let overlayStack: number[] = [];
let nextOverlayId = 1;

/**
 * Full-screen task overlay (forms, detail views) that covers the tab bar.
 * Rendered via a portal pinned to the viewport so it always reaches the very
 * top of the screen, regardless of any transformed ancestor (the phone shell
 * is translated, which would otherwise re-anchor an absolutely-positioned child).
 *
 * Appears with a simple fade (a "switch", not a slide). It can still be dragged
 * back out with a left-edge swipe on touch devices (the iOS "back" gesture); the
 * edge-zone start keeps it from hijacking horizontal scrollers inside the page.
 *
 * The drag is driven straight through the DOM (no per-frame React state) so it
 * tracks the finger smoothly. The listeners are attached natively as
 * { passive: false } so that, once a horizontal edge-drag is committed, we can
 * preventDefault() the browser's own left-edge back gesture — otherwise the
 * native gesture fires alongside ours and pops the route underneath.
 */
export function Overlay({
  title,
  onClose,
  children,
  action,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  action?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const closingRef = useRef(false);

  const vw = () => (typeof window === 'undefined' ? 430 : window.innerWidth);
  const isTop = () => overlayStack[overlayStack.length - 1] === idRef.current;

  // Register in the overlay stack and fade in on mount.
  useEffect(() => {
    const id = nextOverlayId++;
    idRef.current = id;
    overlayStack.push(id);
    setMounted(true);
    return () => {
      overlayStack = overlayStack.filter((x) => x !== id);
    };
  }, []);

  // Fade the panel out (the "switch" back), then unmount once it has played.
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (panel) {
      panel.style.animation = 'none';
      panel.style.transition = 'opacity 0.18s ease-out';
      panel.style.opacity = '0';
    }
    if (backdrop) {
      backdrop.style.animation = 'none';
      backdrop.style.transition = 'opacity 0.18s ease-out';
      backdrop.style.opacity = '0';
    }
    window.setTimeout(onClose, 180);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTop()) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // Edge swipe-back, wired with native non-passive listeners (see the note above).
  useEffect(() => {
    if (!mounted) return;
    const el = panelRef.current;
    if (!el) return;
    const backdrop = backdropRef.current;

    const drag = { active: false, startX: 0, startY: 0, dx: 0, horizontal: null as boolean | null };

    const onStart = (e: TouchEvent) => {
      // Only the top-most overlay responds — never pop two pages on one swipe.
      if (closingRef.current || !isTop()) return;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > EDGE_ZONE) return; // only the left edge starts a back-swipe
      drag.active = true;
      drag.startX = t.clientX;
      drag.startY = t.clientY;
      drag.dx = 0;
      drag.horizontal = null;
    };

    const onMove = (e: TouchEvent) => {
      if (!drag.active) return;
      const t = e.touches[0];
      const dx = t.clientX - drag.startX;
      const dy = t.clientY - drag.startY;
      if (drag.horizontal === null) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        drag.horizontal = Math.abs(dx) > Math.abs(dy);
        if (drag.horizontal) {
          // Take over from any entrance animation and track the finger 1:1.
          el.style.animation = 'none';
          el.style.transition = 'none';
          if (backdrop) backdrop.style.transition = 'none';
        }
      }
      if (!drag.horizontal) {
        drag.active = false; // vertical intent — let the content scroll
        return;
      }
      e.preventDefault(); // cancel the browser's native back-swipe + h-scroll
      drag.dx = Math.max(0, dx); // only rightward (toward "back")
      el.style.transform = `translateX(${drag.dx}px)`;
      if (backdrop) backdrop.style.opacity = String(Math.max(0, 1 - drag.dx / vw()));
    };

    const onEnd = () => {
      if (!drag.active) return;
      drag.active = false;
      if (!drag.horizontal) return;

      if (drag.dx > CLOSE_THRESHOLD) {
        // Commit: finish the slide off-screen, then unmount.
        closingRef.current = true;
        el.style.transition = `transform 0.2s ${EASE}`;
        el.style.transform = `translateX(${vw()}px)`;
        if (backdrop) {
          backdrop.style.transition = `opacity 0.2s ${EASE}`;
          backdrop.style.opacity = '0';
        }
        window.setTimeout(onClose, 200);
      } else {
        // Settle back into place.
        el.style.transition = `transform 0.2s ${EASE}`;
        el.style.transform = 'translateX(0)';
        if (backdrop) {
          backdrop.style.transition = `opacity 0.2s ${EASE}`;
          backdrop.style.opacity = '1';
        }
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-center">
      <div ref={backdropRef} className="absolute inset-0 animate-fade-in bg-ink/40" aria-hidden />
      <div
        ref={panelRef}
        className="relative flex h-full w-full max-w-[430px] flex-col animate-fade-in bg-app shadow-card-lg"
      >
        <header
          className="shrink-0 px-5 pb-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={close}
              className="row-press -ml-2 grid h-10 w-10 place-items-center rounded-xl text-ink-soft"
              aria-label="Back"
            >
              <ChevronLeft width={24} height={24} />
            </button>
            {action}
          </div>
          <h1 className="page-title mt-2">{title}</h1>
        </header>
        <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-10 pt-2">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
