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
 * Full-screen task overlay (forms, detail views) that covers the tab bar.
 * Rendered via a portal pinned to the viewport so it always reaches the very
 * top of the screen, regardless of any transformed ancestor (the phone shell
 * is translated, which would otherwise re-anchor an absolutely-positioned child).
 *
 * Behaves like a pushed page: slides in from the right and can be dragged back
 * out with a left-edge swipe on touch devices (the iOS "back" gesture). The
 * edge-zone start keeps it from hijacking horizontal scrollers inside the page.
 *
 * The swipe listeners are attached natively as { passive: false } so that, once
 * a horizontal edge-drag is committed, we can preventDefault() the browser's own
 * left-edge back gesture. (React attaches touchmove passively, which can't.)
 * Without this, the native gesture fired alongside ours and popped the route
 * underneath — closing the overlay *and* navigating all the way back to Home.
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
  // Horizontal offset of the panel in px. Starts off-screen for the slide-in.
  const [offset, setOffset] = useState(0);
  // When true a CSS transition smooths the transform; off while finger-tracking.
  const [animating, setAnimating] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  const vw = () => (typeof window === 'undefined' ? 430 : window.innerWidth);

  // Slide out to the right, then unmount once the transition has played.
  const close = useCallback(() => {
    setAnimating(true);
    setOffset(vw());
    window.setTimeout(onClose, 240);
  }, [onClose]);

  useEffect(() => {
    setMounted(true);
    setOffset(vw()); // park off-screen before the first paint settles
    const id = requestAnimationFrame(() => setOffset(0)); // then slide into place
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // Edge swipe-back, wired with native non-passive listeners (see the note above).
  useEffect(() => {
    if (!mounted) return;
    const el = panelRef.current;
    if (!el) return;

    const drag = { active: false, startX: 0, startY: 0, dx: 0, horizontal: null as boolean | null };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > EDGE_ZONE) return; // only the left edge starts a back-swipe
      drag.active = true;
      drag.startX = t.clientX;
      drag.startY = t.clientY;
      drag.dx = 0;
      drag.horizontal = null;
      setAnimating(false);
    };

    const onMove = (e: TouchEvent) => {
      if (!drag.active) return;
      const t = e.touches[0];
      const dx = t.clientX - drag.startX;
      const dy = t.clientY - drag.startY;
      if (drag.horizontal === null) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        drag.horizontal = Math.abs(dx) > Math.abs(dy);
      }
      if (!drag.horizontal) {
        drag.active = false; // vertical intent — let the content scroll
        return;
      }
      e.preventDefault(); // cancel the browser's native back-swipe + h-scroll
      drag.dx = Math.max(0, dx); // only rightward (toward "back")
      setOffset(drag.dx);
    };

    const onEnd = () => {
      if (!drag.active) return;
      drag.active = false;
      setAnimating(true);
      if (drag.dx > CLOSE_THRESHOLD) close();
      else setOffset(0);
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
  }, [mounted, close]);

  if (!mounted) return null;

  // Backdrop dims as the page settles in and lightens as it's dragged away.
  const progress = Math.max(0, Math.min(1, 1 - offset / vw()));

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-center">
      <div className="absolute inset-0 bg-ink/40" style={{ opacity: progress }} aria-hidden />
      <div
        ref={panelRef}
        className="relative flex h-full w-full max-w-[430px] flex-col bg-app shadow-card-lg"
        style={{
          transform: `translateX(${offset}px)`,
          transition: animating ? `transform 0.24s ${EASE}` : 'none',
        }}
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
