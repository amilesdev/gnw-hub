'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { playSfx } from '@/lib/play/audio';
import { haptics } from '@/lib/haptics';
import { TabBar } from '@/components/shared/TabBar';

const HOLD_MS = 1100;
const R = 102; // progress-ring radius
const C = 2 * Math.PI * R;

// The threshold into game mode. This screen deliberately stays *native* to the
// Hub — muted sage + paper grain, with the bottom nav still in place — so there's
// no jarring jump into the colorful game world. The player presses and HOLDS the
// sage button; a ring fills over ~1.1s, then a radiant white light blooms from the
// center — like an angel appearing — and hands off to the (gamified) game home.
export function EnterGate({ variant, onEnter }: { variant: 'member' | 'leader'; onEnter: () => void }) {
  const [holding, setHolding] = useState(false);
  const [entering, setEntering] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const start = () => {
    if (entering) return;
    setHolding(true);
    timer.current = setTimeout(complete, HOLD_MS);
  };

  const cancel = () => {
    if (entering) return;
    setHolding(false);
    if (timer.current) clearTimeout(timer.current);
  };

  const complete = () => {
    // Keep the ring full (don't unfill) — go straight into the flood.
    setEntering(true);
    setHolding(false);
    playSfx('game-start', { volume: 0.7 });
    haptics.press();
    setTimeout(onEnter, 860); // hands off while the white light still covers the screen
  };

  const ringFull = holding || entering;

  return (
    <div className="app-shell relative overflow-hidden">
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-14">
          <h1 className="font-display text-[3.25rem] font-semibold leading-[0.95] tracking-tight text-ink">
            GNW <span className="text-accent dark:text-accent-on">Play</span>
          </h1>
          <p className="mx-auto mt-4 max-w-[17rem] text-base leading-snug text-ink-soft">
            Tap and hold for head-to-head Bible trivia.
          </p>
        </div>

        <button
          type="button"
          aria-label="Hold to enter GNW Play"
          onPointerDown={start}
          onPointerUp={cancel}
          onPointerLeave={cancel}
          onPointerCancel={cancel}
          onContextMenu={(e) => e.preventDefault()}
          className="relative grid h-64 w-64 touch-none select-none place-items-center"
        >
          {/* Constant soft sage halo for depth. */}
          <span
            className="pointer-events-none absolute h-48 w-48 rounded-full"
            style={{ background: 'radial-gradient(circle, rgb(94 112 72 / 0.34), transparent 70%)', filter: 'blur(20px)' }}
          />

          {/* Resting glow — slow sage rings swelling outward and fading. */}
          {!ringFull && (
            <>
              {[0, 1.2, 2.4].map((d) => (
                <span
                  key={d}
                  className="play-glow absolute h-40 w-40 rounded-full"
                  style={{ animationDelay: `${d}s`, background: 'rgb(94 112 72 / 0.45)' }}
                />
              ))}
            </>
          )}

          {/* Hold progress ring (sage), thicker; slow ease-out unfill on release. */}
          <svg className="absolute -rotate-90" width="232" height="232" viewBox="0 0 232 232">
            <circle cx="116" cy="116" r={R} fill="none" stroke="rgb(94 112 72 / 0.16)" strokeWidth="12" />
            <circle
              cx="116"
              cy="116"
              r={R}
              fill="none"
              stroke="#5E7048"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={ringFull ? 0 : C}
              style={{
                transition: holding
                  ? `stroke-dashoffset ${HOLD_MS}ms linear`
                  : entering
                    ? 'none'
                    : 'stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </svg>

          {/* Core — sage, rich radial fill + glossy top sheen, no icon. */}
          <span
            className={cn(
              'relative grid h-40 w-40 place-items-center overflow-hidden rounded-full text-white',
              !ringFull && 'play-core-breathe-sage',
              holding && 'scale-95',
              'transition-transform',
            )}
            style={{
              background:
                'radial-gradient(130% 130% at 28% 22%, #8aa06b 0%, #5e7048 52%, #3f4d2f 100%)',
            }}
          >
            <span
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{ background: 'radial-gradient(65% 50% at 50% 20%, rgb(255 255 255 / 0.38), transparent 72%)' }}
            />
            <span className="relative flex flex-col items-center">
              <span className="font-display text-3xl font-semibold leading-none">Enter</span>
              <span className="mt-2 text-[0.7rem] font-bold uppercase tracking-[0.2em] text-white/75">
                {holding ? 'Keep holding…' : 'Hold'}
              </span>
            </span>
          </span>
        </button>
      </main>

      {/* Light on completion — the smooth bridge from the native Hub into game
          mode. A radiant white light blooms from the button center: light-rays
          sweep out around a brightening core, then a soft white wash takes the
          whole screen, like an angel appearing. */}
      {entering && (
        <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
          <span className="play-light-rays absolute left-1/2 top-1/2 h-[150vmax] w-[150vmax]" />
          <span className="play-light-bloom absolute left-1/2 top-1/2 h-44 w-44 rounded-full" />
          <span className="play-light-wash absolute inset-0" />
        </div>
      )}

      <TabBar variant={variant} />
    </div>
  );
}
