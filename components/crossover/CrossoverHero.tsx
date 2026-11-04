'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { crossoverCountdownTarget } from '@/lib/crossover-season';
import { formatEventDate } from '@/lib/dates';

type Unit = { value: string; label: string };

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * "Countdown to Crossover" units for the time left until Dec 31, 12:00 AM
 * Eastern: Months | Days | Hours while a month or more remains, then Days |
 * Hours | Minutes, then Hours | Minutes | Seconds on the final day.
 */
export function countdownUnits(now: number, target: number): Unit[] {
  const ms = Math.max(0, target - now);
  let months = 0;
  for (;;) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + months + 1);
    if (d.getTime() <= target) months++;
    else break;
  }
  if (months > 0) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + months);
    const rem = target - d.getTime();
    return [
      { value: String(months), label: months === 1 ? 'Month' : 'Months' },
      { value: pad(Math.floor(rem / 86_400_000)), label: 'Days' },
      { value: pad(Math.floor(rem / 3_600_000) % 24), label: 'Hours' },
    ];
  }
  if (ms >= 86_400_000) {
    return [
      { value: String(Math.floor(ms / 86_400_000)), label: 'Days' },
      { value: pad(Math.floor(ms / 3_600_000) % 24), label: 'Hours' },
      { value: pad(Math.floor(ms / 60_000) % 60), label: 'Minutes' },
    ];
  }
  return [
    { value: pad(Math.floor(ms / 3_600_000)), label: 'Hours' },
    { value: pad(Math.floor(ms / 60_000) % 60), label: 'Minutes' },
    { value: pad(Math.floor(ms / 1000) % 60), label: 'Seconds' },
  ];
}

/**
 * The Crossover home's hero card: the app's sage taken down to evergreen, slow
 * gold confetti, the season title and a live countdown to Dec 31. It sits under
 * the page header, in the slot the verse ribbon takes on Home.
 */
export function CrossoverHero({ year, serverNow }: { year: number; serverNow: number }) {
  const target = crossoverCountdownTarget(year);
  // Seeded with the server's clock so the first paint matches; ticks once mounted.
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = target - now;
  const label = left <= 0 ? "It's Crossover day" : left < 86_400_000 ? 'Almost here' : 'Countdown';
  const units = countdownUnits(now, target);

  return (
    <section
      aria-label={`Crossover ${year} countdown`}
      className="grain-block relative animate-rise overflow-hidden rounded-3xl p-4 text-crossover-champagne shadow-card-lg"
      style={{
        background:
          'radial-gradient(90% 70% at 100% 0%, rgb(226 190 110 / .30), transparent 60%),' +
          'radial-gradient(70% 60% at 0% 100%, rgb(174 190 138 / .18), transparent 60%),' +
          'linear-gradient(165deg, #3D4A2E, #222B1A)',
      }}
    >
      <Confetti />

      <div className="relative z-[2] flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.015em]">
          Crossover <em className="font-medium italic text-crossover-gold-hi">{year}</em>
        </h2>
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-crossover-champagne/80">
          {formatEventDate(new Date(Date.UTC(year, 11, 31)))}
        </span>
      </div>

      <div className="relative z-[2] mt-3 rounded-2xl border border-crossover-gold-hi/20 bg-black/20 px-2 py-2.5">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-crossover-gold-hi">{label}</p>
        {left > 0 && (
          <div className="mt-1.5 grid grid-cols-3" role="timer" aria-live="off">
            {units.map((u, i) => (
              <div
                key={u.label}
                className={cn('flex min-w-0 flex-col items-center gap-0.5', i > 0 && 'border-l border-crossover-gold-hi/25')}
              >
                <span
                  className="font-display text-[30px] font-semibold leading-[1.15] tracking-[-0.015em] text-crossover-gold-hi tabular-nums"
                  style={{ textShadow: '0 1px 0 rgb(0 0 0 / .25), 0 0 18px rgb(226 190 110 / .3)' }}
                  suppressHydrationWarning
                >
                  {u.value}
                </span>
                <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-crossover-champagne/85">
                  {u.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const CONFETTI_COLORS = ['#F2DDA4', '#E2BE6E', '#FBEFC9', '#C99B45', '#AEBE8A', '#F6EEDC'];

type Piece = { x: number; y: number; s: number; v: number; d: number; r: number; vr: number; c: string; dot: boolean; a: number };

function makePiece(anywhere: boolean): Piece {
  return {
    x: Math.random(),
    y: anywhere ? Math.random() : -0.06,
    s: 2.2 + Math.random() * 3.4,
    v: 0.03 + Math.random() * 0.05, // fraction of the hero's height per second
    d: (Math.random() - 0.5) * 0.02,
    r: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 2.4,
    c: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    dot: Math.random() < 0.35,
    a: 0.45 + Math.random() * 0.45,
  };
}

/** Slow gold confetti behind the hero's text. Drawn once, still, under reduced motion. */
function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pieces = Array.from({ length: 34 }, () => makePiece(true));
    let frame = 0;
    let last = 0;

    function paint(dt: number) {
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      if (!w || !h) return;
      const dpr = window.devicePixelRatio || 1;
      if (canvas!.width !== Math.round(w * dpr)) {
        canvas!.width = Math.round(w * dpr);
        canvas!.height = Math.round(h * dpr);
      }
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, w, h);
      pieces.forEach((p, i) => {
        p.y += p.v * dt;
        p.x += p.d * dt;
        p.r += p.vr * dt;
        if (p.y > 1.06) {
          pieces[i] = makePiece(false);
          return;
        }
        ctx!.save();
        ctx!.globalAlpha = p.a;
        ctx!.fillStyle = p.c;
        ctx!.translate(p.x * w, p.y * h);
        ctx!.rotate(p.r);
        if (p.dot) {
          ctx!.beginPath();
          ctx!.arc(0, 0, p.s * 0.45, 0, Math.PI * 2);
          ctx!.fill();
        } else {
          ctx!.scale(1, Math.cos(p.r * 1.3)); // flutter
          ctx!.fillRect(-p.s * 0.35, -p.s, p.s * 0.7, p.s * 2);
        }
        ctx!.restore();
      });
    }

    function loop(ts: number) {
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
      last = ts;
      paint(dt);
      frame = requestAnimationFrame(loop);
    }

    if (reduced) paint(0);
    else frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-[1] h-full w-full" />;
}
