'use client';

import { cn } from '@/lib/utils';

/**
 * iOS-style toggle switch (CMP-9): accent track when on, surface-2 when off.
 * The thumb is white, except dark + on, where it takes `accent-fg` so it reads
 * on the light-sage track. Accessible: real button with role="switch".
 */
export function Switch({
  checked,
  onChange,
  disabled,
  id,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        // 44px hit area around the 28px track.
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 ease-soft',
        "after:absolute after:-inset-y-2 after:inset-x-0 after:content-['']",
        'focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]',
        checked ? 'border-accent bg-accent' : 'border-line bg-surface-2',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-transform duration-200 ease-soft',
          checked ? 'translate-x-[23px] dark:bg-accent-fg' : 'translate-x-[3px]',
        )}
      />
    </button>
  );
}
