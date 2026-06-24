'use client';

import { cn } from '@/lib/utils';

/** Pill / segmented toggle — a friendlier alternative to a dropdown for short option sets. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-1 rounded-2xl bg-surface-2 p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'flex-1 rounded-xl py-2 text-sm font-semibold transition active:scale-[0.97]',
              active ? 'bg-surface text-ink shadow-card' : 'text-ink-soft',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
