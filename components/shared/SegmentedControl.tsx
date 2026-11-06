'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * The one segmented control (CMP-10) for every toggle in the app.
 * - `solid` (default): inside content (Appearance, All/My suggestions…). Equal
 *   `flex-1` segments on a surface-2 track.
 * - `glass`: the top-level view switch on a tab root (Events Agenda | Month,
 *   Songs Setlists | Library). Hugs its content.
 * The active background slides between segments. Pass `role="tablist"` when it
 * switches views; the default is a radio group (it sets a value).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  variant = 'solid',
  role = 'radiogroup',
  'aria-label': ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  variant?: 'solid' | 'glass';
  role?: 'radiogroup' | 'tablist';
  'aria-label'?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  // No slide on the very first placement, only on later changes.
  const [animate, setAnimate] = useState(false);
  const glass = variant === 'glass';
  const tabs = role === 'tablist';

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const el = track.querySelector<HTMLElement>(`[data-seg="${CSS.escape(value)}"]`);
      if (el) setThumb({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [value, options.length]);

  useLayoutEffect(() => {
    if (thumb && !animate) {
      const id = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(id);
    }
  }, [thumb, animate]);

  return (
    <div
      ref={trackRef}
      role={role}
      aria-label={ariaLabel}
      className={cn(
        'relative isolate flex h-11 rounded-[22px] p-1',
        glass ? 'glass inline-flex' : 'bg-surface-2',
        className,
      )}
    >
      {thumb && (
        <span
          aria-hidden
          className={cn(
            'absolute bottom-1 left-0 top-1 -z-10 rounded-[18px]',
            glass ? 'glass-thumb' : 'bg-surface shadow-card',
            animate && 'transition-[transform,width] duration-[260ms] ease-soft',
          )}
          style={{ width: thumb.w, transform: `translateX(${thumb.x}px)` }}
        />
      )}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            data-seg={o.value}
            role={tabs ? 'tab' : 'radio'}
            aria-selected={tabs ? active : undefined}
            aria-checked={tabs ? undefined : active}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-9 whitespace-nowrap rounded-[18px] px-[18px] text-sm transition-[color,transform] duration-150 active:scale-[0.97]',
              !glass && 'flex-1',
              active ? 'font-bold text-ink' : 'font-semibold text-ink-soft',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
