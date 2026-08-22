'use client';

import { useEffect, useRef, useState } from 'react';

// A number that travels to its new value instead of teleporting.
//
// Scores were static text before, which is the single biggest reason the round
// loop felt like a form submitting rather than a game scoring. Driven by rAF
// (not an interval) so it lands on a frame boundary and can be interrupted
// mid-flight when the next round's value arrives.
//
// Respects prefers-reduced-motion by snapping straight to the value — the
// information is the number, and the motion is decoration on top of it.
export function CountUp({
  value,
  duration = 900,
  delay = 0,
  prefix = '',
  className,
  style,
}: {
  value: number;
  duration?: number;
  delay?: number;
  prefix?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduce || duration <= 0) {
      from.current = value;
      setShown(value);
      return;
    }

    const start = from.current;
    const delta = value - start;
    if (delta === 0) return;

    let startedAt: number | null = null;
    const tick = (t: number) => {
      if (startedAt === null) startedAt = t + delay;
      const elapsed = t - startedAt;
      if (elapsed < 0) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      const p = Math.min(1, elapsed / duration);
      // easeOutExpo — fast off the line, long settle. Reads as a score
      // "landing" rather than a linear ramp.
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setShown(Math.round(start + delta * eased));
      if (p < 1) frame.current = requestAnimationFrame(tick);
      else from.current = value;
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      // Whatever was on screen becomes the next animation's origin, so an
      // interrupted count-up continues from where the eye left it.
      from.current = shown;
    };
    // `shown` is intentionally excluded: including it would restart the
    // animation on every frame it sets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, delay]);

  return (
    <span className={className} style={style}>
      {prefix}
      {shown.toLocaleString()}
    </span>
  );
}
