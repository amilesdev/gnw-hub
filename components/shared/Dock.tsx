'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { ToastHost } from './Toast';

/**
 * The dock (CMP-1): the mini call bar, MiniPlayer and tab bar as one stack
 * pinned to the bottom of the column. `<main>` scrolls underneath it so the
 * glass shows content through it. Its measured height is published as
 * `--dock-h` on <html>, which pads the bottom of `<main>` and lifts toasts
 * above it, and updates as the MiniPlayer or call bar comes and goes.
 */
export function Dock({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const sync = () => root.style.setProperty('--dock-h', `${Math.round(el.getBoundingClientRect().height)}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--dock-h');
    };
  }, []);

  return (
    <div
      ref={ref}
      className="no-print pointer-events-none absolute inset-x-0 bottom-0 z-dock flex flex-col gap-2"
    >
      {children}
    </div>
  );
}

/**
 * Toasts sit right above the dock. Portaled to the top of the stacking order
 * (z-toast) rather than inside the dock, so an undo toast raised from inside a
 * full-screen overlay (Edit Setlist) still shows above it.
 */
export function DockToasts() {
  // The shell is a transformed column (its own stacking context), so the toast
  // layer goes to <body> to clear the z-50 overlays that are portaled there too.
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => setTarget(document.body), []);
  if (!target) return null;
  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 z-toast mx-auto w-full max-w-[430px]"
      // --ios-gap: this layer sits on the short standalone viewport (globals.css).
      style={{ bottom: 'calc(var(--dock-h, 28px) + 8px - var(--ios-gap, 0px))' }}
    >
      <ToastHost />
    </div>,
    target,
  );
}

// Tab roots + auth get the ambient glow behind the header; sub-pages reached
// from a tab (Suggestions, availability) get only the wash, like overlays.
const NO_GLOW = /\/(suggestions|availability)(\/|$)/;

/** The ambient glow + top wash behind `<main>` (CMP-1). Never scrolls. */
export function ShellBackdrop() {
  const pathname = usePathname();
  return (
    <>
      {!NO_GLOW.test(pathname) && <div className="app-glow" aria-hidden />}
      <div className="app-wash" aria-hidden />
    </>
  );
}
