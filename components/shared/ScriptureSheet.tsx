'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from './Icons';
import { apiFetch } from '@/lib/api-client';

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

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
      className="fixed inset-0 z-[60] flex justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Scripture: ${reference}`}
    >
      <div className="absolute inset-0 animate-fade-in bg-ink/50" onClick={onClose} aria-hidden />

      <div className="relative z-10 mt-auto w-full max-w-[430px] animate-sheet-up px-3 pb-3">
        <div
          className="grain-block relative flex max-h-[72vh] flex-col overflow-hidden rounded-3xl shadow-sheet ring-1 ring-black/10"
          style={{
            background:
              'radial-gradient(120% 80% at 50% 0%, #f8f1de 0%, #f1e7ca 55%, #e8dcbb 100%)',
            color: '#3a2f1d',
          }}
        >
          {/* drag handle */}
          <div className="relative z-10 flex justify-center pt-2.5">
            <span className="h-1 w-10 rounded-full" style={{ background: 'rgba(58,47,29,0.25)' }} />
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-full transition active:scale-95"
            style={{ background: 'rgba(58,47,29,0.08)', color: '#5b4a2e' }}
          >
            <X width={16} height={16} />
          </button>

          {/* reference header */}
          <header className="relative z-10 px-6 pt-3 text-center">
            <h2 className="font-display text-2xl font-semibold" style={{ color: '#2c2415' }}>
              {state.status === 'ok' ? state.passage.reference : reference}
            </h2>
            <div className="mx-auto mt-2 flex items-center justify-center gap-2">
              <span className="h-px w-8" style={{ background: 'rgba(58,47,29,0.3)' }} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: '#7a6743' }}>
                New Living Translation
              </span>
              <span className="h-px w-8" style={{ background: 'rgba(58,47,29,0.3)' }} />
            </div>
          </header>

          {/* body */}
          <div className="no-scrollbar relative z-10 flex-1 overflow-y-auto px-6 pb-5 pt-4">
            {state.status === 'loading' && (
              <p className="py-8 text-center font-display text-lg italic" style={{ color: '#8a7448' }}>
                Turning the page…
              </p>
            )}

            {state.status === 'notfound' && (
              <p className="py-6 text-center font-display text-base italic" style={{ color: '#6f5d3c' }}>
                We couldn’t find “{reference}.” Double-check the reference (e.g. “John 3:16”).
              </p>
            )}

            {state.status === 'error' && (
              <p className="py-6 text-center font-display text-base italic" style={{ color: '#8a4b3f' }}>
                {state.message || 'Couldn’t load this scripture right now.'}
              </p>
            )}

            {state.status === 'ok' && (
              <>
                <div
                  className="font-display text-[1.075rem] leading-[1.8]"
                  style={{ color: '#3a2f1d', textShadow: '0 1px 0 rgba(255,255,255,0.4)' }}
                >
                  {state.passage.verses.map((v, i) => (
                    <span key={i}>
                      {v.number != null && (
                        <sup
                          className="mr-0.5 align-super text-[0.62em] font-semibold"
                          style={{ color: '#9a7d3f' }}
                        >
                          {v.number}
                        </sup>
                      )}
                      {v.text}{' '}
                    </span>
                  ))}
                </div>

                <p
                  className="mt-5 border-t pt-3 text-[10px] leading-snug"
                  style={{ borderColor: 'rgba(58,47,29,0.18)', color: '#8a7448' }}
                >
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
