'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from './Icons';
import { apiFetch } from '@/lib/api-client';

/** Drag the sheet down this many px to dismiss it. */
const CLOSE_THRESHOLD = 90;

type Passage = {
  reference: string;
  translation: string;
  verses: { number: number | null; text: string }[];
  copyright: string;
};

type State =
  | { status: 'loading' }
  | { status: 'ok'; passage: Passage }
  | { status: 'notfound' }
  | { status: 'error'; message: string };

/**
 * A small "page of paper" sheet that slides up when a scripture chip is tapped.
 * Fetches the passage (NLT) from our server proxy and renders it on warm,
 * grain-textured paper in the app's serif display face. Stays light/paper in
 * both themes on purpose — that's the whole effect.
 */
export function ScriptureSheet({ reference, onClose }: { reference: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<State>({ status: 'loading' });
  // Vertical drag offset (>= 0) and whether a CSS transition smooths it.
  const [dragY, setDragY] = useState(0);
  const [animating, setAnimating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startY: 0, dy: 0 });

  useEffect(() => setMounted(true), []);

  // Slide the sheet down off-screen, then unmount once it has played.
  const close = useCallback(() => {
    setAnimating(true);
    setDragY(typeof window === 'undefined' ? 800 : window.innerHeight);
    window.setTimeout(onClose, 240);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    drag.current = { active: true, startY: e.touches[0].clientY, dy: 0 };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const d = drag.current;
    if (!d.active) return;
    const dy = e.touches[0].clientY - d.startY;
    // Only pull down, and only when the body is scrolled to the top — otherwise
    // the gesture belongs to the scrollable passage.
    if (dy <= 0 || (scrollRef.current?.scrollTop ?? 0) > 0) {
      d.dy = 0;
      if (dragY !== 0) setDragY(0);
      return;
    }
    setAnimating(false);
    d.dy = dy;
    setDragY(dy);
  };

  const onTouchEnd = () => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    setAnimating(true);
    if (d.dy > CLOSE_THRESHOLD) close();
    else setDragY(0);
  };

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    apiFetch<{ passage: Passage }>(`/api/scripture?ref=${encodeURIComponent(reference)}`)
      .then((d) => active && setState({ status: 'ok', passage: d.passage }))
      .catch((e: Error) => {
        if (!active) return;
        setState(
          e.message === 'not_found'
            ? { status: 'notfound' }
            : { status: 'error', message: e.message },
        );
      });
    return () => {
      active = false;
    };
  }, [reference]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-lightbox flex justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Scripture: ${reference}`}
    >
      <div className="absolute inset-0 animate-fade-in bg-scrim" onClick={close} aria-hidden />

      <div
        className="relative z-10 mt-auto w-full max-w-[430px] animate-sheet-up px-3 pb-3"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: animating ? 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {/* Follows the theme (EV-C4): surface + Literata, the Holy Talks hue as accent. */}
        <div className="grain-block relative flex max-h-[72vh] flex-col overflow-hidden rounded-sheet bg-surface text-ink shadow-sheet">
          {/* drag handle */}
          <div className="relative z-10 flex justify-center pt-2">
            <span className="h-[5px] w-10 rounded-[3px] bg-line" />
          </div>

          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="btn-icon absolute right-3 top-3 z-20 bg-surface-2"
          >
            <X width={20} height={20} />
          </button>

          {/* reference header */}
          <header className="relative z-10 px-14 pt-3 text-center">
            <h2 className="font-display text-2xl font-semibold text-ink">
              {state.status === 'ok' ? state.passage.reference : reference}
            </h2>
            <div className="mx-auto mt-2 flex items-center justify-center gap-2">
              <span className="h-px w-8 bg-line" />
              <span className="micro text-type-holytalks">New Living Translation</span>
              <span className="h-px w-8 bg-line" />
            </div>
          </header>

          {/* body */}
          <div ref={scrollRef} className="no-scrollbar relative z-10 flex-1 overflow-y-auto px-6 pb-5 pt-4">
            {state.status === 'loading' && (
              <p className="py-8 text-center font-display text-lg italic text-ink-faint">
                Turning the page…
              </p>
            )}

            {state.status === 'notfound' && (
              <p className="py-6 text-center font-display text-base italic text-ink-soft">
                We couldn’t find “{reference}.” Double-check the reference (e.g. “John 3:16”).
              </p>
            )}

            {state.status === 'error' && (
              <p className="py-6 text-center font-display text-base italic text-bad-ink">
                {state.message || 'Couldn’t load this scripture right now.'}
              </p>
            )}

            {state.status === 'ok' && (
              <>
                <div className="selectable font-display text-[1.075rem] leading-[1.8] text-ink">
                  {state.passage.verses.map((v, i) => (
                    <span key={i}>
                      {v.number != null && (
                        <sup className="mr-0.5 align-super text-[0.62em] font-semibold text-type-holytalks">
                          {v.number}
                        </sup>
                      )}
                      {v.text}{' '}
                    </span>
                  ))}
                </div>

                <p className="mt-5 border-t border-line pt-3 text-[11px] leading-snug text-ink-faint">
                  {state.passage.copyright}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
