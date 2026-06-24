'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft } from './Icons';

/**
 * Full-screen task overlay (forms, detail views) that covers the tab bar.
 * Rendered via a portal pinned to the viewport so it always reaches the very
 * top of the screen, regardless of any transformed ancestor (the phone shell
 * is translated, which would otherwise re-anchor an absolutely-positioned child).
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
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-center bg-ink/40">
      <div className="relative flex h-full w-full max-w-[430px] animate-fade-in flex-col bg-app">
        <header
          className="shrink-0 px-5 pb-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
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
