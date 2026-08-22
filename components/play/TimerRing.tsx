'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Pause } from '@/components/shared/Icons';

const R = 25;
const C = 2 * Math.PI * R;

// One clock, not two. The old screen had a seconds number in the header AND a
// separate progress bar under it, which split the most time-critical
// information across two places. This merges them: the ring IS the bar, and the
// number lives inside it.
//
// Urgency is carried on three channels, never colour alone — the digits count
// down, the ring empties, and the whole thing beats once per second under 3.
export function TimerRing({
  remainingMs,
  totalMs,
  paused = false,
}: {
  remainingMs: number;
  totalMs: number;
  paused?: boolean;
}) {
  const fraction = Math.max(0, Math.min(1, remainingMs / totalMs));
  const seconds = Math.ceil(remainingMs / 1000);
  const urgent = seconds <= 3 && seconds > 0 && !paused;

  // Re-key the beat animation once per second so it replays.
  const [beat, setBeat] = useState(0);
  const lastSecond = useRef<number | null>(null);
  useEffect(() => {
    if (urgent && lastSecond.current !== seconds) {
      lastSecond.current = seconds;
      setBeat((b) => b + 1);
    }
    if (!urgent) lastSecond.current = null;
  }, [urgent, seconds]);

  const stroke =
    fraction > 0.5
      ? 'rgb(var(--play-green))'
      : fraction > 0.2
        ? 'rgb(var(--play-yellow))'
        : 'rgb(var(--play-pink))';

  return (
    <div
      className="relative grid h-14 w-14 shrink-0 place-items-center"
      role="timer"
      aria-live="off"
      aria-label={`${seconds} seconds left`}
    >
      <svg className="absolute -rotate-90" width="56" height="56" viewBox="0 0 56 56" aria-hidden>
        <circle cx="28" cy="28" r={R} fill="none" stroke="rgb(var(--stage-line))" strokeWidth="4" />
        <circle
          cx="28"
          cy="28"
          r={R}
          fill="none"
          stroke={stroke}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - fraction)}
          // Matches the parent's 100ms clock tick, so the sweep is continuous
          // rather than stepping. Linear on purpose: an eased timer lies about
          // how much time is left.
          style={{ transition: 'stroke-dashoffset 100ms linear, stroke 300ms ease' }}
        />
      </svg>
      {paused ? (
        <Pause width={18} height={18} className="stage-soft" aria-hidden />
      ) : (
        <span
          key={beat}
          className={cn('font-display text-xl font-black tabular-nums', urgent && 'play-clock-beat')}
          style={{ color: stroke }}
        >
          {seconds}
        </span>
      )}
    </div>
  );
}
